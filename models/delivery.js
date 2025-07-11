const mongoose = require("mongoose");
const Joi = require("joi");

const deliverySchema = new mongoose.Schema({
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
  date: {
    type: String,
    required: true,
    maxlength: 50,
    minlength: 5,
  },
  client: {
    type: String,
    maxlength: 100,
    default: null,
  },
  source: {
    type: String,
    enum: ["Express", "Normal"],
    default: "Normal",
  },
  deliveryNote: {
    type: String,
    maxlength: 200,
    default: null,
  },
});

function validateDelivery(delivery) {
  const schema = Joi.object({
    itemCode: Joi.string().min(5).max(50).required(),
    quantity: Joi.number().min(1).required(),
    date: Joi.string().min(5).max(50).required(),
    client: Joi.string().max(100).optional().allow(null, ""),
    source: Joi.string().valid("Express", "Normal").optional(),
    deliveryNote: Joi.string().max(200).optional().allow(null, ""),
  });

  return schema.validate(delivery);
}

const Delivery = mongoose.model("Delivery", deliverySchema);
exports.Delivery = Delivery;
exports.validate = validateDelivery;
