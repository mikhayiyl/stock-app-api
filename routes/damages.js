const { Damage, validate } = require("../models/damage");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const validator = require("../middleware/validator");
const admin = require("../middleware/admin");
const router = require("express").Router();
const queryStringCheck = require("../utils/queryStringsCheck");

router.get("/", async (req, res) => {
  const filter = queryStringCheck(req.query);
  const damages = await Damage.find(filter).sort("-date");
  res.send(damages);
});

router.get("/:id", [objId], async (req, res) => {
  const damage = await Damage.findById(req.params.id);

  if (!damage)
    return res
      .status(404)
      .send("The damage " + req.params.id + " does not exist");
  res.send(damage);
});

router.post("/", auth, [validator(validate)], async (req, res) => {
  const damage = new Damage(req.body);

  await damage.save();

  res.send(damage);
});

router.put("/:id", [auth, objId, validator(validate)], async (req, res) => {
  const damage = await Damage.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!damage)
    return res
      .status(404)
      .send("The damage " + req.params.id + " does not exist");

  res.send(damage);
});

router.patch("/:id", [auth, objId], async (req, res) => {
  const damage = await Damage.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!damage)
    return res
      .status(404)
      .send("The damage " + req.params.id + " does not exist");

  res.send(damage);
});

router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const damage = await Damage.findByIdAndRemove(req.params.id);

  if (!damage)
    return res
      .status(404)
      .send("The damage " + req.params.id + " does not exist");

  res.send(damage);
});

module.exports = router;
