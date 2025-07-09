const mongoose = require("mongoose");
const Joi = require("joi");
Joi.objectId = require("joi-objectid")(Joi);

const damageSchema = new mongoose.Schema({
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
    min: 0,
    default: 0,
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
  status: {
    type: String,
    enum: ["pending", "replaced", "resold", "disposed"],
    default: "pending",
  },
  resolvedAt: {
    type: Date,
  },
});

function validateDamage(damage) {
  const schema = Joi.object({
    productId: Joi.objectId().required(),
    itemCode: Joi.string().min(5).max(50).required(),
    quantity: Joi.number().min(0).required(),
    notes: Joi.string().allow("", null).optional(),
    date: Joi.string().min(5).max(50).required(),
    status: Joi.string()
      .valid("pending", "replaced", "resold", "disposed")
      .optional(),
    resolvedAt: Joi.date().optional(),
  });

  return schema.validate(damage);
}

const Damage = mongoose.model("Damage", damageSchema);
exports.Damage = Damage;
exports.validate = validateDamage;
