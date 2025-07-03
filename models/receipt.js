const mongoose = require("mongoose");
const Joi = require("joi");

const receiptSchema = new mongoose.Schema({
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

  date: {
    type: String,
    required: true,
    maxlength: 50,
    minlength: 5,
  },
});

function validateReceipt(receipt) {
  const schema = {
    itemCode: Joi.string().min(5).max(50).required(),
    quantity: Joi.number().min(1).required(),
    date: Joi.string().required().min(5).max(50),
  };
  return Joi.validate(receipt, schema);
}

const Receipt = mongoose.model("Receipt", receiptSchema);
exports.Receipt = Receipt;
exports.validate = validateReceipt;
