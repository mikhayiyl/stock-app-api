const mongoose = require("mongoose");
const Joi = require("joi");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 50, minlength: 5 },
  itemCode: { type: String, required: true, maxlength: 50, minlength: 5 },
  unit: { type: String, required: true, maxlength: 50, minlength: 1 },
  numberInStock: { type: Number, required: true, min: 0 },
  damaged: { type: Number, default: 0 },
  received: { type: String, required: true, maxlength: 50, minlength: 5 },
});

function validateProduct(product) {
  const schema = Joi.object({
    name: Joi.string().min(5).max(50).required(),
    itemCode: Joi.string().min(5).max(50).required(),
    unit: Joi.string().min(1).max(50).required(),
    numberInStock: Joi.number().min(0).required(),
    received: Joi.string().min(5).max(50).required(),
    damaged: Joi.number().min(0).optional().default(0),
  });

  return schema.validate(product);
}

const Product = mongoose.model("Product", productSchema);
exports.Product = Product;
exports.validate = validateProduct;
