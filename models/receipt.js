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
    min: 1,
  },
  date: {
    type: String,
    required: true,
    maxlength: 50,
    minlength: 5,
  },
  isExpress: {
    type: Boolean,
    default: false,
  },
  client: {
    type: String,
    maxlength: 100,
    default: null,
  },
  deliveryNote: {
    type: String,
    maxlength: 200,
    default: null,
  },
});

function validateReceipt(receipt) {
  const schema = Joi.object({
    itemCode: Joi.string().min(5).max(50).required(),
    quantity: Joi.number().min(1).required(),
    date: Joi.string().min(5).max(50).required(),
    isExpress: Joi.boolean().optional(),
    client: Joi.string().max(100).optional().allow(null, ""),
    deliveryNote: Joi.string().max(200).optional().allow(null, ""),

    //name and unit to make sure they are included in the product
    name: Joi.string()
      .min(2)
      .max(100)
      .when("isExpress", {
        is: false,
        then: Joi.required(),
        otherwise: Joi.optional().allow("", null),
      }),
    unit: Joi.string()
      .min(1)
      .max(20)
      .when("isExpress", {
        is: false,
        then: Joi.required(),
        otherwise: Joi.optional().allow("", null),
      }),
  });

  return schema.validate(receipt);
}

const Receipt = mongoose.model("Receipt", receiptSchema);
exports.Receipt = Receipt;
exports.validate = validateReceipt;
