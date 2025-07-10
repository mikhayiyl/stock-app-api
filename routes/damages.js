const mongoose = require("mongoose");
const { Damage, validate } = require("../models/damage");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const validator = require("../middleware/validator");
const admin = require("../middleware/admin");
const router = require("express").Router();
const queryStringCheck = require("../utils/queryStringsCheck");
const { Product } = require("../models/product");

router.get("/", async (req, res) => {
  const filter = queryStringCheck(req.query);
  const damages = await Damage.find(filter).sort("-date");
  res.send(damages);
});

router.get("/:id", [objId], async (req, res) => {
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
    if (!product) return res.status(404).send("The product does not exist");

    if (product.numberInStock < quantity) {
      await session.abortTransaction();
      return res.status(400).send("Not enough stock to report this damage");
    }

    const damage = new Damage({ productId, itemCode, quantity, notes, date });
    await damage.save({ session });

    product.damaged += quantity;
    product.numberInStock -= quantity;

    await product.save({ session });

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
  const { status, resolvedQuantity } = req.body;
  const validStatuses = ["resolved", "disposed"];

  if (!validStatuses.includes(status)) {
    return res.status(400).send("Invalid status value");
  }

  if (typeof resolvedQuantity !== "number" || resolvedQuantity <= 0) {
    return res.status(400).send("Resolved quantity must be a positive number");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const damage = await Damage.findById(req.params.id).session(session);
    if (!damage) {
      await session.abortTransaction();
      return res
        .status(404)
        .send(`The damage with ID ${req.params.id} does not exist`);
    }

    if (resolvedQuantity > damage.quantity) {
      await session.abortTransaction();
      return res
        .status(400)
        .send("Resolved quantity cannot exceed damaged quantity");
    }

    damage.status = status;
    damage.resolvedQuantity = resolvedQuantity;
    damage.resolvedAt = new Date();
    await damage.save({ session });

    if (status === "resolved" || status === "disposed") {
      const product = await Product.findById(damage.productId).session(session);
      if (!product) {
        await session.abortTransaction();
        return res.status(404).send("Associated product does not exist");
      }

      if (status === "resolved") {
        product.numberInStock += resolvedQuantity;
      }

      product.damaged -= resolvedQuantity;
      await product.save({ session });
    }

    await session.commitTransaction();
    res.send(damage);
  } catch (err) {
    await session.abortTransaction();
    console.error("Failed to resolve damage:", err);
    res.status(500).send("Resolution failed");
  } finally {
    session.endSession();
  }
});

router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const damage = await Damage.findByIdAndRemove(req.params.id);

  if (!damage)
    return res
      .status(404)
      .send("The damage " + req.params.id + " does not exist");

  res.send(damage);
});

module.exports = router;
