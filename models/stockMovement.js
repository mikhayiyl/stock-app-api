const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      immutable: true,
    },
    itemCode: {
      type: String,
      required: true,
      maxlength: 50,
      minlength: 5,
      immutable: true,
    },
    type: {
      type: String,
      enum: [
        "opening_balance",
        "receipt",
        "order",
        "damage",
        "damage_resolution",
        "damage_disposal",
        "receipt_reversal",
        "order_reversal",
        "damage_cancellation",
        "restock",
        "adjustment",
      ],
      required: true,
      immutable: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },
    stockChange: {
      type: Number,
      required: true,
      immutable: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
      immutable: true,
    },
    reason: {
      type: String,
      maxlength: 500,
      default: "",
      immutable: true,
    },
    referenceType: {
      type: String,
      maxlength: 40,
      immutable: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      immutable: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ itemCode: 1, createdAt: -1 });

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);

module.exports = StockMovement;
