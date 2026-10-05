const mongoose = require("mongoose");
const { Damage, validate } = require("../models/damage");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const validator = require("../middleware/validator");
const admin = require("../middleware/admin");
const router = require("express").Router();
const queryStringCheck = require("../utils/queryStringsCheck");
const { Product } = require("../models/product");
const recordStockMovement = require("../utils/recordStockMovement");

router.get("/", auth, async (req, res) => {
  const filter = queryStringCheck(req.query);
  const damages = await Damage.find(filter).sort("-date");
  res.send(damages);
});

router.get("/:id", [auth, objId], async (req, res) => {
  const damage = await Damage.findById(req.params.id);

  if (!damage)
    return res
      .status(404)
      .send("The damage " + req.params.id + " does not exist");
  res.send(damage);
});

router.post("/", [auth, admin, validator(validate)], async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, itemCode, quantity, notes, date } = req.body;

    const product = await Product.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).send("The product does not exist");
    }

    if (product.itemCode !== itemCode) {
      await session.abortTransaction();
      return res.status(400).send("Item code does not match product");
    }

    if (product.numberInStock < quantity) {
      await session.abortTransaction();
      return res.status(400).send("Not enough stock to report this damage");
    }

    const damage = new Damage({ productId, itemCode, quantity, notes, date });
    await damage.save({ session });

    product.damaged += quantity;
    product.numberInStock -= quantity;

    await product.save({ session });
    await recordStockMovement({
      product,
      type: "damage",
      quantity,
      stockChange: -quantity,
      reason: notes || "Damage reported",
      referenceType: "damage",
      referenceId: damage._id,
      performedBy: req.user._id,
      session,
    });

    await session.commitTransaction();
    res.send(damage);
  } catch (err) {
    await session.abortTransaction();
    console.error("Transaction failed:", err);
    res.status(500).send("Failed to log damage");
  } finally {
    session.endSession();
  }
});

router.patch("/resolve/:id", [auth, admin, objId], async (req, res) => {
  const { type, quantity, notes } = req.body;
  const validTypes = ["resolved", "disposed"];

  if (!validTypes.includes(type)) {
    return res.status(400).send("Invalid resolution type");
  }

  if (typeof quantity !== "number" || quantity <= 0) {
    return res.status(400).send("Quantity must be a positive number");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const damage = await Damage.findById(req.params.id).session(session);
    if (!damage) {
      await session.abortTransaction();
      return res.status(404).send("Damage not found");
    }

    const resolvedSoFar = damage.resolutionHistory.reduce(
      (sum, entry) => sum + entry.quantity,
      0
    );
    const remaining = damage.quantity - resolvedSoFar;

    if (quantity > remaining) {
      await session.abortTransaction();
      return res.status(400).send("Quantity exceeds unresolved amount");
    }

    // Record resolution entry
    damage.resolutionHistory.push({
      type,
      quantity,
      notes: notes || "—",
      date: new Date(),
    });

    // Optionally update status if fully resolved
    if (resolvedSoFar + quantity === damage.quantity) {
      damage.status = "completed";
    }

    await damage.save({ session });

    // Update product inventory
    const product = await Product.findById(damage.productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).send("Associated product not found");
    }

    if (type === "resolved") {
      product.numberInStock += quantity;
    }
    //avoid a negative value
    product.damaged = Math.max(product.damaged - quantity, 0);
    await product.save({ session });
    await recordStockMovement({
      product,
      type: type === "resolved" ? "damage_resolution" : "damage_disposal",
      quantity,
      stockChange: type === "resolved" ? quantity : 0,
      reason: notes || `Damage ${type}`,
      referenceType: "damage",
      referenceId: damage._id,
      performedBy: req.user._id,
      session,
    });

    await session.commitTransaction();
    res.send(damage);
  } catch (err) {
    await session.abortTransaction();
    console.error("Resolution failed:", err);
    res.status(500).send("Could not resolve damage");
  } finally {
    session.endSession();
  }
});

router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const damage = await Damage.findById(req.params.id).session(session);
    if (!damage) {
      await session.abortTransaction();
      return res
        .status(404)
        .send("The damage " + req.params.id + " does not exist");
    }

    const processedQuantity = damage.resolutionHistory.reduce(
      (sum, entry) => sum + entry.quantity,
      0,
    );
    const unresolvedQuantity = Math.max(damage.quantity - processedQuantity, 0);
    const product = await Product.findById(damage.productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).send("Associated product not found");
    }

    product.numberInStock += unresolvedQuantity;
    product.damaged = Math.max(product.damaged - unresolvedQuantity, 0);
    await product.save({ session });
    await recordStockMovement({
      product,
      type: "damage_cancellation",
      quantity: damage.quantity,
      stockChange: unresolvedQuantity,
      reason: "Damage report deleted",
      referenceType: "damage",
      referenceId: damage._id,
      performedBy: req.user._id,
      session,
    });
    await damage.deleteOne({ session });

    await session.commitTransaction();
    res.send(damage);
  } catch (err) {
    await session.abortTransaction();
    console.error("Damage deletion failed:", err);
    res.status(500).send("Failed to delete damage report");
  } finally {
    session.endSession();
  }
});

module.exports = router;
