const mongoose = require("mongoose");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const config = require("config");

// Joi.objectId = require("joi-objectid")(Joi);

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    maxlength: 50,
    minlength: 5,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    maxlength: 254, // per RFC standard
    minlength: 5,
  },
  password: {
    type: String,
    required: true,
    maxlength: 1050, // ideal for bcrypt
    minlength: 6,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
});

// Generate auth token method
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      username: this.username,
      email: this.email,
      isAdmin: this.isAdmin,
    },
    config.get("jwtPrivateKey")
  );
};

const User = mongoose.model("User", userSchema);

//  validation function
function validateUser(user) {
  const schema = Joi.object({
    username: Joi.string().min(5).max(50).required(),
    email: Joi.string().email().max(254).required(),
    password: Joi.string().min(6).max(72).required(), // 72-char limit ideal for bcrypt
  });

  return schema.validate(user);
}

exports.User = User;
exports.validate = validateUser;
