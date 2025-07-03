const { Order, validate } = require("../models/order");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const validator = require("../middleware/validator");
const admin = require("../middleware/admin");
const router = require("express").Router();
const queryStringCheck = require("../utils/queryStringsCheck");

router.get("/", async (req, res) => {
  const filter = queryStringCheck(req.query);
  const orders = await Order.find(filter).sort("-date");
  res.send(orders);
});

router.get("/:id", [objId], async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order)
    return res
      .status(404)
      .send("The order " + req.params.id + " does not exist");
  res.send(order);
});

router.post("/", auth, [validator(validate)], async (req, res) => {
  const order = new Order(req.body);

  await order.save();

  res.send(order);
});

router.put("/:id", [auth, objId, validator(validate)], async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!order)
    return res
      .status(404)
      .send("The order " + req.params.id + " does not exist");

  res.send(order);
});

router.patch("/:id", [auth, objId], async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!order)
    return res
      .status(404)
      .send("The order " + req.params.id + " does not exist");

  res.send(order);
});

router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const order = await Order.findByIdAndRemove(req.params.id);

  if (!order)
    return res
      .status(404)
      .send("The order " + req.params.id + " does not exist");

  res.send(order);
});

module.exports = router;
