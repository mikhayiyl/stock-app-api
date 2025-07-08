const { Order, validate } = require("../models/order");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const validator = require("../middleware/validator");
const admin = require("../middleware/admin");
const router = require("express").Router();
const queryStringCheck = require("../utils/queryStringsCheck");

const mongoose = require("mongoose");
const { Product } = require("../models/product");

router.get("/", async (req, res) => {
  const filter = queryStringCheck(req.query);
  const orders = await Order.find(filter).sort("-date");
  res.send(orders);
});

router.get("/:id", [objId], async (req, res) => {
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
    if (!product) return res.status(404).send("Product not found");

    if (product.numberInStock < quantity) {
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
  const order = await Order.findByIdAndRemove(req.params.id);

  if (!order)
    return res
      .status(404)
      .send("The order " + req.params.id + " does not exist");

  res.send(order);
});

module.exports = router;
