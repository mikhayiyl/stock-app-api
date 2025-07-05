const mongoose = require("mongoose");
const Joi = require("joi");
Joi.objectId = require("joi-objectid")(Joi);

const orderSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Product",
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
    min: 1,
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
  const schema = Joi.object({
    productId: Joi.objectId().required(),
    itemCode: Joi.string().min(5).max(50).required(),
    quantity: Joi.number().min(1).required(),
    orderNumber: Joi.string().max(50).required(),
    date: Joi.string().min(5).max(50).required(),
  });

  return schema.validate(order);
}

const Order = mongoose.model("Order", orderSchema);
exports.Order = Order;
exports.validate = validateOrder;
