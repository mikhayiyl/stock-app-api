const mongoose = require("mongoose");
const { Restock, validate } = require("../models/restock");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const validator = require("../middleware/validator");
const admin = require("../middleware/admin");
const router = require("express").Router();
const queryStringCheck = require("../utils/queryStringsCheck");
const { Product } = require("../models/product");

router.get("/", async (req, res) => {
  const filter = queryStringCheck(req.query);
  const restocks = await Restock.find(filter).sort("-date");
  res.send(restocks);
});

router.get("/:id", [objId], async (req, res) => {
  const restock = await Restock.findById(req.params.id);

  if (!restock)
    return res
      .status(404)
      .send("The restock " + req.params.id + " does not exist");
  res.send(restock);
});

router.post("/", [auth, admin, validator(validate)], async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, quantity, notes, date } = req.body;

    const product = await Product.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).send("The product does not exist");
    }

    // Update stock
    product.numberInStock += quantity;
    await product.save({ session });

    // Create restock record
    const restock = new Restock({
      productId,
      quantity,
      notes,
      date,
    });

    await restock.save({ session });

    await session.commitTransaction();
    res.send(restock);
  } catch (err) {
    await session.abortTransaction();
    console.error("Restock error:", err);
    res.status(500).send("Failed to restock product");
  } finally {
    session.endSession();
  }
});

module.exports = router;
