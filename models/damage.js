const mongoose = require("mongoose");
const Joi = require("joi");

const damageSchema = new mongoose.Schema({
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
  notes: {
    type: String,
    default: "—",
  },
  date: {
    type: String,
    required: true,
    maxlength: 50,
    minlength: 5,
  },
});

function validateDamage(damage) {
  const schema = {
    productId: Joi.objectId().required(),
    itemCode: Joi.string().min(5).max(50).required(),
    quantity: Joi.number().min(0).required(),
    notes: Joi.string().allow("", null).optional(),
    date: Joi.string().required().min(5).max(50),
  };
  return Joi.validate(damage, schema);
}

const Damage = mongoose.model("Damage", damageSchema);
exports.Damage = Damage;
exports.validate = validateDamage;
