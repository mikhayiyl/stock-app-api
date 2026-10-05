const mongoose = require("mongoose");
const {
  Product,
  validate,
  validatePatch,
} = require("../models/product");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const validator = require("../middleware/validator");
const admin = require("../middleware/admin");
const router = require("express").Router();
const queryStringCheck = require("../utils/queryStringsCheck");
const recordStockMovement = require("../utils/recordStockMovement");

router.get("/", auth, async (req, res) => {
  const filter = queryStringCheck(req.query);
  const products = await Product.find(filter).sort("-received");
  res.send(products);
});

router.get("/:id", [auth, objId], async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product)
    return res
      .status(404)
      .send("The product " + req.params.id + " does not exist");
  res.send(product);
});

router.post("/", [auth, admin, validator(validate)], async (req, res) => {
  if (req.body.damaged > 0) {
    return res
      .status(400)
      .send("Create the product first, then report damaged stock separately");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const product = new Product(req.body);
    await product.save({ session });
    await recordStockMovement({
      product,
      type: "opening_balance",
      quantity: product.numberInStock,
      stockChange: product.numberInStock,
      reason: "Initial stock balance",
      referenceType: "product",
      referenceId: product._id,
      performedBy: req.user._id,
      session,
    });

    await session.commitTransaction();
    res.send(product);
  } catch (err) {
    await session.abortTransaction();
    console.error("Product creation transaction failed:", err);
    res.status(500).send("Failed to create product and record its opening stock");
  } finally {
    session.endSession();
  }
});

router.put(
  "/:id",
  [auth, admin, objId, validator(validate)],
  async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .send("The product " + req.params.id + " does not exist");

    if (
      req.body.numberInStock !== product.numberInStock ||
      (req.body.damaged ?? 0) !== product.damaged
    ) {
      return res
        .status(400)
        .send("Stock quantities can only be changed through stock movements");
    }

    product.name = req.body.name;
    product.itemCode = req.body.itemCode;
    product.unit = req.body.unit;
    product.received = req.body.received;

    await product.save();
    return res.send(product);
  },
);

router.patch(
  "/:id",
  [auth, admin, objId, validator(validatePatch)],
  async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res
        .status(404)
        .send("The product " + req.params.id + " does not exist");

    Object.assign(product, req.body);
    await product.save();

    res.send(product);
  },
);
router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const product = await Product.findByIdAndRemove(req.params.id);

  if (!product)
    return res
      .status(404)
      .send("The product " + req.params.id + " does not exist");

  res.send(product);
});

module.exports = router;
