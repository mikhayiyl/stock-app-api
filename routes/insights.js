const { createHash } = require("crypto");
const config = require("config");
const { Product } = require("../models/product");
const { Order } = require("../models/order");
const { Receipt } = require("../models/receipt");
const auth = require("../middleware/auth");
const buildInventoryInsightData = require("../utils/buildInventoryInsightData");
const generateInventoryInsights = require("../utils/generateInventoryInsights");
const router = require("express").Router();

const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedResponse = null;

router.get("/", auth, async (req, res) => {
  if (!config.get("geminiApiKey")) {
    return res
      .status(503)
      .send("AI insights are not configured. Set GEMINI_API_KEY on the API server.");
  }

  const [products, orders, receipts] = await Promise.all([
    Product.find({}),
    Order.find({}),
    Receipt.find({}),
  ]);
  const data = buildInventoryInsightData(products, orders, receipts);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");

  if (
    cachedResponse &&
    cachedResponse.fingerprint === fingerprint &&
    Date.now() - cachedResponse.createdAt < CACHE_TTL_MS
  ) {
    return res.send({ ...cachedResponse.response, cached: true });
  }

  let generated;
  try {
    generated = await generateInventoryInsights(data);
  } catch (error) {
    console.error(
      "Gemini inventory insight generation failed:",
      error instanceof Error ? error.message : "Unknown provider error",
    );
    return res
      .status(502)
      .send("Unable to generate AI insights. Check the Gemini API configuration and try again.");
  }

  const response = {
    periodDays: data.periodDays,
    generatedAt: new Date().toISOString(),
    cached: false,
    metrics: data.metrics,
    ...generated,
  };
  cachedResponse = {
    fingerprint,
    createdAt: Date.now(),
    response,
  };

  return res.send(response);
});

module.exports = router;
