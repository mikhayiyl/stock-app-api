const { Receipt, validate } = require("../models/receipt");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const validator = require("../middleware/validator");
const admin = require("../middleware/admin");
const router = require("express").Router();
const queryStringCheck = require("../utils/queryStringsCheck");

router.get("/", async (req, res) => {
  const filter = queryStringCheck(req.query);
  const receipts = await Receipt.find(filter).sort("-date");
  res.send(receipts);
});

router.get("/:id", [objId], async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);

  if (!receipt)
    return res
      .status(404)
      .send("The receipt " + req.params.id + " does not exist");
  res.send(receipt);
});

router.post("/", auth, [validator(validate)], async (req, res) => {
  const receipt = new Receipt(req.body);

  await receipt.save();

  res.send(receipt);
});

router.put("/:id", [auth, objId, validator(validate)], async (req, res) => {
  const receipt = await Receipt.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!receipt)
    return res
      .status(404)
      .send("The receipt " + req.params.id + " does not exist");

  res.send(receipt);
});

router.patch("/:id", [auth, objId], async (req, res) => {
  const receipt = await Receipt.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!receipt)
    return res
      .status(404)
      .send("The receipt " + req.params.id + " does not exist");

  res.send(receipt);
});

router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const receipt = await Receipt.findByIdAndRemove(req.params.id);

  if (!receipt)
    return res
      .status(404)
      .send("The receipt " + req.params.id + " does not exist");

  res.send(receipt);
});

module.exports = router;
