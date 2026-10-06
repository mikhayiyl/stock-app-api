const express = require("express");
const request = require("supertest");

jest.mock("config", () => ({
  get: jest.fn(),
}));
jest.mock("../../../middleware/auth", () => (req, res, next) => next());
jest.mock("../../../models/product", () => ({
  Product: { find: jest.fn() },
}));
jest.mock("../../../models/order", () => ({
  Order: { find: jest.fn() },
}));
jest.mock("../../../models/receipt", () => ({
  Receipt: { find: jest.fn() },
}));
jest.mock("../../../utils/generateInventoryInsights", () => jest.fn());

const config = require("config");
const { Product } = require("../../../models/product");
const { Order } = require("../../../models/order");
const { Receipt } = require("../../../models/receipt");
const generateInventoryInsights = require("../../../utils/generateInventoryInsights");

const app = express();
app.use("/", require("../../../routes/insights"));

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  config.get.mockImplementation((key) =>
    key === "geminiApiKey" ? "test-key" : "gemini-test-model",
  );
  Product.find.mockResolvedValue([]);
  Order.find.mockResolvedValue([]);
  Receipt.find.mockResolvedValue([]);
  generateInventoryInsights.mockResolvedValue({
    summary: "Inventory is ready for review.",
    insights: [
      {
        priority: "watch",
        category: "operations",
        title: "Review stock activity",
        observation: "No order activity is recorded in the period.",
        recommendation: "Confirm records are up to date.",
        itemCodes: [],
      },
    ],
  });
});

test("returns a clear configuration error when no Gemini key is set", async () => {
  config.get.mockReturnValue("");

  const response = await request(app).get("/");

  expect(response.status).toBe(503);
  expect(response.text).toContain("GEMINI_API_KEY");
  expect(Product.find).not.toHaveBeenCalled();
});

test("returns generated insights and reuses identical recent results", async () => {
  const firstResponse = await request(app).get("/");
  const cachedResponse = await request(app).get("/");

  expect(firstResponse.status).toBe(200);
  expect(firstResponse.body).toMatchObject({
    periodDays: 30,
    cached: false,
    summary: "Inventory is ready for review.",
    metrics: { totalProducts: 0, totalUnitsOnHand: 0 },
  });
  expect(cachedResponse.status).toBe(200);
  expect(cachedResponse.body.cached).toBe(true);
  expect(generateInventoryInsights).toHaveBeenCalledTimes(1);
});

test("returns a service error when Gemini generation fails", async () => {
  Product.find.mockResolvedValue([
    {
      itemCode: "ITEM-002",
      name: "Second sample item",
      unit: "pcs",
      numberInStock: 1,
      damaged: 0,
    },
  ]);
  generateInventoryInsights.mockRejectedValue(new Error("provider unavailable"));
  jest.spyOn(console, "error").mockImplementation(() => {});

  const response = await request(app).get("/");

  expect(response.status).toBe(502);
  expect(response.text).toContain("Unable to generate AI insights");
});
