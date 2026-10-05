const {
  User,
  validate,
  validatePatch,
  validateRole,
} = require("../models/user");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const ownerOrAdmin = require("../middleware/ownerOrAdmin");
const router = require("express").Router();
const _ = require("lodash");
const bcrypt = require("bcrypt");
const validator = require("../middleware/validator");

router.get("/", [auth, admin], async (req, res) => {
  const users = await User.find().select("-password").sort("username");
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

router.put(
  "/:id",
  [auth, objId, ownerOrAdmin, validator(validate)],
  async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user)
      return res
        .status(404)
        .send("The user " + req.params.id + " does not exist");

    user.username = req.body.username;
    user.email = req.body.email;
    user.password = await bcrypt.hash(
      req.body.password,
      await bcrypt.genSalt(10),
    );

    await user.save();

    res.send(_.pick(user, ["_id", "username", "email"]));
  },
);

router.patch(
  "/:id",
  [auth, objId, ownerOrAdmin, validator(validatePatch)],
  async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .send("The user " + req.params.id + " does not exist");

    if (req.body.username !== undefined) user.username = req.body.username;
    if (req.body.email !== undefined) user.email = req.body.email;
    if (req.body.password !== undefined) {
      user.password = await bcrypt.hash(
        req.body.password,
        await bcrypt.genSalt(10),
      );
    }
    await user.save();

    res.send(_.pick(user, ["_id", "username", "email"]));
  },
);

router.patch(
  "/:id/role",
  [auth, admin, objId, validator(validateRole)],
  async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send(`The user ${req.params.id} does not exist`);
    }

    if (
      String(user._id) === String(req.user._id) &&
      req.body.isAdmin === false
    ) {
      return res
        .status(409)
        .send("You cannot remove your own administrator role");
    }

    if (user.isAdmin && req.body.isAdmin === false) {
      const adminCount = await User.countDocuments({ isAdmin: true });
      if (adminCount <= 1) {
        return res
          .status(409)
          .send("The last administrator cannot be demoted");
      }
    }

    user.isAdmin = req.body.isAdmin;
    await user.save();

    res.send(_.pick(user, ["_id", "username", "email", "isAdmin"]));
  },
);

router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user)
    return res
      .status(404)
      .send("The user " + req.params.id + " does not exist");

  if (String(user._id) === String(req.user._id)) {
    return res.status(409).send("You cannot delete your own account");
  }

  if (user.isAdmin) {
    const adminCount = await User.countDocuments({ isAdmin: true });
    if (adminCount <= 1) {
      return res.status(409).send("The last administrator cannot be deleted");
    }
  }

  await user.deleteOne();
  res.send(_.pick(user, ["_id", "username", "email", "isAdmin"]));
});

module.exports = router;
