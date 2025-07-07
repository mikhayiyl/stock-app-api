const { User } = require("../models/user");
const Joi = require("joi");
const validator = require("../middleware/validator");
const router = require("express").Router();
const bcrypt = require("bcrypt");

router.post("/", validator(validateAuth), async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send("Invalid credentials");

  const password = await bcrypt.compare(req.body.password, user.password);
  if (!password) return res.status(400).send("Invalid credentials");

  const token = user.generateAuthToken();

  res.send(token);
});

function validateAuth(auth) {
  const schema = Joi.object({
    email: Joi.string().email().max(254).required(),
    password: Joi.string().min(6).max(72).required(),
  });

  return schema.validate(auth);
}

module.exports = router;
