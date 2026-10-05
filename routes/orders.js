const { Order, validate } = require("../models/order");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const validator = require("../middleware/validator");
const admin = require("../middleware/admin");
const router = require("express").Router();
const queryStringCheck = require("../utils/queryStringsCheck");

const mongoose = require("mongoose");
const { Product } = require("../models/product");
const recordStockMovement = require("../utils/recordStockMovement");

router.get("/", auth, async (req, res) => {
  const filter = queryStringCheck(req.query);
  const orders = await Order.find(filter).sort("-date");
  res.send(orders);
});

router.get("/:id", [auth, objId], async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order)
    return res
      .status(404)
      .send("The order " + req.params.id + " does not exist");
  res.send(order);
});

router.post("/", [auth, admin, validator(validate)], async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, itemCode, quantity, orderNumber, date } = req.body;

    const product = await Product.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).send("Product not found");
    }

    if (product.itemCode !== itemCode) {
      await session.abortTransaction();
      return res.status(400).send("Item code does not match product");
    }

    if (product.numberInStock < quantity) {
      await session.abortTransaction();
      return res.status(400).send("Not enough stock available");
    }

    const order = new Order({
      productId,
      itemCode,
      quantity,
      orderNumber,
      date,
    });

    await order.save({ session });

    product.numberInStock -= quantity;
    await product.save({ session });
    await recordStockMovement({
      product,
      type: "order",
      quantity,
      stockChange: -quantity,
      reason: `Order ${orderNumber}`,
      referenceType: "order",
      referenceId: order._id,
      performedBy: req.user._id,
      session,
    });

    await session.commitTransaction();
    res.send(order);
  } catch (err) {
    await session.abortTransaction();
    console.error("Order transaction failed:", err);
    res.status(400).send(err.message || "Order processing failed");
  } finally {
    session.endSession();
  }
});

router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) {
      await session.abortTransaction();
      return res
        .status(404)
        .send("The order " + req.params.id + " does not exist");
    }

    const product = await Product.findById(order.productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return res
        .status(409)
        .send("Cannot delete order because its product no longer exists");
    }

    product.numberInStock += order.quantity;
    await product.save({ session });
    await recordStockMovement({
      product,
      type: "order_reversal",
      quantity: order.quantity,
      stockChange: order.quantity,
      reason: `Order ${order.orderNumber} deleted`,
      referenceType: "order",
      referenceId: order._id,
      performedBy: req.user._id,
      session,
    });
    await order.deleteOne({ session });

    await session.commitTransaction();
    res.send(order);
  } catch (err) {
    await session.abortTransaction();
    console.error("Order deletion transaction failed:", err);
    res.status(500).send("Failed to delete order and restore its stock");
  } finally {
    session.endSession();
  }
});

module.exports = router;
