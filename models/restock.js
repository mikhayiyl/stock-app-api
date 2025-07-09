const Joi = require("joi");
const mongoose = require("mongoose");

const restockSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  notes: {
    type: String,
    default: "—",
  },
  date: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 50,
  },
});

function validateRestock(restock) {
  const schema = Joi.object({
    productId: Joi.objectId().required(),
    quantity: Joi.number().min(1).required(),
    notes: Joi.string().allow("", null).optional(),
    date: Joi.string().min(5).max(50).required(),
  });

  return schema.validate(restock);
}

module.exports.validateRestock = validateRestock;
const Restock = mongoose.model("Restock", restockSchema);
module.exports = Restock;
