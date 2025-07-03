const { User, validate } = require("../models/user");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const router = require("express").Router();
const _ = require("lodash");
const bcrypt = require("bcrypt");
const validator = require("../middleware/validator");

router.get("/", async (req, res) => {
  const users = await User.find().sort("name");
  res.send(users);
});

router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  if (!user)
    return res
      .status(404)
      .send("The user " + req.params.id + " does not exist");
  res.send(user);
});

router.post("/", validator(validate), async (req, res) => {
  let user = await User.findOne({ email: req.body.email });
  if (user) return res.status(400).send("Email Already Registered");

  user = new User(_.pick(req.body, ["username", "email", "password"]));
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);

  await user.save();
  const token = user.generateAuthToken();

  res
    .header("x-auth-token", token)
    .header("access-control-expose-headers", "x-auth-token")
    .send(_.pick(user, ["_id", "username", "email"]));
});

router.put("/:id", auth, validator(validate), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    _.pick(req.body, ["username", "email", "password"]),
    { new: true }
  );

  if (!user)
    return res
      .status(404)
      .send("The user " + req.params.id + " does not exist");

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);

  await user.save();

  res.send(_.pick(user, ["_id", "username", "email"]));
});

router.patch("/:id", auth, async (req, res) => {
  const allowedUpdates = ["username", "email", "password"];
  const updates = Object.keys(req.body);
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation)
    return res.status(400).send("Invalid fields in update.");

  const user = await User.findById(req.params.id);
  if (!user)
    return res
      .status(404)
      .send("The user " + req.params.id + " does not exist");

  try {
    for (let key of updates) {
      if (key === "password") {
        const salt = await bcrypt.genSalt(10);
        user[key] = await bcrypt.hash(req.body[key], salt);
      } else {
        user[key] = req.body[key];
      }
    }

    await user.save();

    res.send(_.pick(user, ["_id", "username", "email"]));
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
});

router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const user = await User.findByIdAndRemove(req.params.id);
  if (!user)
    return res
      .status(404)
      .send("The user " + req.params.id + " does not exist");
  res.send(user);
});

module.exports = router;
