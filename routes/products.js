const { Product, validate } = require("../models/product");
const objId = require("../middleware/objectId");
const auth = require("../middleware/auth");
const validator = require("../middleware/validator");
const admin = require("../middleware/admin");
const router = require("express").Router();
const queryStringCheck = require("../utils/queryStringsCheck");

router.get("/", async (req, res) => {
  const filter = queryStringCheck(req.query);
  const products = await Product.find(filter).sort("-received");
  res.send(products);
});

router.get("/:id", [objId], async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product)
    return res
      .status(404)
      .send("The product " + req.params.id + " does not exist");
  res.send(product);
});

router.post("/", auth, [validator(validate)], async (req, res) => {
  const product = new Product(req.body);

  await product.save();

  res.send(product);
});

router.put("/:id", [auth, objId, validator(validate)], async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!product)
    return res
      .status(404)
      .send("The product " + req.params.id + " does not exist");

  res.send(product);
});

router.patch("/:id", [auth, objId], async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!product)
    return res
      .status(404)
      .send("The product " + req.params.id + " does not exist");

  res.send(product);
});

router.delete("/:id", [auth, admin, objId], async (req, res) => {
  const product = await Product.findByIdAndRemove(req.params.id);

  if (!product)
    return res
      .status(404)
      .send("The product " + req.params.id + " does not exist");

  res.send(product);
});

module.exports = router;
