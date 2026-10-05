const Joi = require("joi");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const validator = require("../middleware/validator");
const { Product } = require("../models/product");
const StockMovement = require("../models/stockMovement");
const recordStockMovement = require("../utils/recordStockMovement");
const router = require("express").Router();

const validateAdjustment = (adjustment) =>
  Joi.object({
    productId: Joi.string()
      .custom((value, helpers) =>
        mongoose.Types.ObjectId.isValid(value)
          ? value
          : helpers.error("any.invalid"),
      )
      .required(),
    countedStock: Joi.number().min(0).required(),
    reason: Joi.string().trim().min(3).max(500).required(),
  }).validate(adjustment);

router.get("/", auth, async (req, res) => {
  const filter = {};
  const { productId, itemCode } = req.query;

  if (productId !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).send("Invalid productId");
    }
    filter.productId = productId;
  }

  if (itemCode !== undefined) {
    if (typeof itemCode !== "string" || itemCode.length > 50) {
      return res.status(400).send("Invalid itemCode");
    }
    filter.itemCode = itemCode;
  }

  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const pageSize =
    req.query.pageSize === undefined ? 50 : Number(req.query.pageSize);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 200
  ) {
    return res
      .status(400)
      .send("page must be positive and pageSize must be between 1 and 200");
  }

  const [items, total] = await Promise.all([
    StockMovement.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  res.send({ items, total, page, pageSize });
});

router.post(
  "/adjustments",
  [auth, admin, validator(validateAdjustment)],
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const product = await Product.findById(req.body.productId).session(
        session,
      );
      if (!product) {
        await session.abortTransaction();
        return res.status(404).send("Product not found");
      }

      const previousStock = product.numberInStock;
      const stockChange = req.body.countedStock - previousStock;
      product.numberInStock = req.body.countedStock;
      await product.save({ session });

      const movement = await recordStockMovement({
        product,
        type: "adjustment",
        quantity: Math.abs(stockChange),
        stockChange,
        reason: req.body.reason.trim(),
        referenceType: "stock_count",
        performedBy: req.user._id,
        session,
      });

      await session.commitTransaction();
      res.status(201).send(movement);
    } catch (err) {
      await session.abortTransaction();
      console.error("Stock adjustment transaction failed:", err);
      res.status(500).send("Failed to record stock adjustment");
    } finally {
      session.endSession();
    }
  },
);

module.exports = router;
