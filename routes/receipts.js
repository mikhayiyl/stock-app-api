const { Receipt, validate } = require("../models/receipt");
const { Delivery } = require("../models/delivery");
const { Product } = require("../models/product");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const validator = require("../middleware/validator");
const queryStringCheck = require("../utils/queryStringsCheck");
const router = require("express").Router();

router.get("/", async (req, res) => {
  const filter = queryStringCheck(req.query);

  if (req.query.expressOnly === "true") {
    filter.isExpress = true;
  }

  const receipts = await Receipt.find(filter).sort("-date");
  res.send(receipts);
});

router.get("/:id", [objId], async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt)
    return res
      .status(404)
      .send("The receipt " + req.params.id + " does not exist");
  res.send(receipt);
});

const mongoose = require("mongoose");

router.post("/", [auth, admin, validator(validate)], async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      itemCode,
      quantity,
      date,
      name,
      unit,
      isExpress,
      client,
      deliveryNote,
    } = req.body;

    const receipt = new Receipt({
      itemCode,
      quantity,
      date,
      isExpress: isExpress || false,
      client: client || null,
      deliveryNote: deliveryNote || null,
    });

    await receipt.save({ session });

    if (isExpress) {
      const delivery = new Delivery({
        itemCode,
        quantity,
        date,
        client,
        source: "Express",
        deliveryNote,
      });

      await delivery.save({ session });
    } else {
      const product = await Product.findOne({ itemCode }).session(session);

      if (product) {
        product.numberInStock += quantity;
        product.received = date;
        await product.save({ session });
      } else {
        const newProduct = new Product({
          itemCode,
          name,
          unit,
          numberInStock: quantity,
          damaged: 0,
          received: date,
        });

        await newProduct.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.send(receipt);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Transaction failed:", err);
    res.status(500).send("Failed to save receipt with linked data.");
  }
});

router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const receipt = await Receipt.findByIdAndRemove(req.params.id);
  if (!receipt)
    return res
      .status(404)
      .send("The receipt " + req.params.id + " does not exist");
  res.send(receipt);
});

module.exports = router;
