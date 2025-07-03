const mongoose = require("mongoose");
const Joi = require("joi");

const orderSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
  },
  itemCode: {
    type: String,
    required: true,
    maxlength: 50,
    minlength: 5,
  },

  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  orderNumber: {
    type: String,
    required: true,
    maxlength: 50,
  },
  date: {
    type: String,
    required: true,
    maxlength: 50,
    minlength: 5,
  },
});

function validateOrder(order) {
  const schema = {
    productId: Joi.objectId().required(),
    itemCode: Joi.string().min(5).max(50).required(),
    quantity: Joi.number().min(1).required(),
    orderNumber: Joi.string().required().max(50),
    date: Joi.string().required().min(5).max(50),
  };
  return Joi.validate(order, schema);
}

const Order = mongoose.model("Order", orderSchema);
exports.Order = Order;
exports.validate = validateOrder;
