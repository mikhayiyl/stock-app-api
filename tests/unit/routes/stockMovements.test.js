const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../../../middleware/auth", () => (req, res, next) => {
  req.user = { _id: "test-user" };
  next();
});
jest.mock("../../../middleware/admin", () => (req, res, next) => next());
jest.mock("../../../models/product", () => ({
  Product: { findById: jest.fn() },
}));
jest.mock("../../../models/stockMovement", () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock("../../../utils/recordStockMovement", () =>
  jest.fn().mockResolvedValue({ _id: "movement-id" }),
);

const { Product } = require("../../../models/product");
const StockMovement = require("../../../models/stockMovement");
const recordStockMovement = require("../../../utils/recordStockMovement");
const app = express();
app.use(express.json());
app.use("/", require("../../../routes/stockMovements"));

const productId = "000000000000000000000001";
const session = {
  startTransaction: jest.fn(),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("stock movement listing", () => {
  test("returns a paginated history filtered by product", async () => {
    const items = [{ _id: "movement-id" }];
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(items),
    };
    StockMovement.find.mockReturnValue(query);
    StockMovement.countDocuments.mockResolvedValue(1);

    const response = await request(app)
      .get("/")
      .query({ productId, page: 2, pageSize: 10 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items,
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(StockMovement.find).toHaveBeenCalledWith({ productId });
    expect(query.skip).toHaveBeenCalledWith(10);
  });

  test("rejects invalid pagination", async () => {
    const response = await request(app).get("/?pageSize=201");

    expect(response.status).toBe(400);
  });
});

describe("stock count adjustments", () => {
  test("records a count variance and updates stock atomically", async () => {
    const product = {
      _id: productId,
      itemCode: "ITEM-001",
      numberInStock: 12,
      save: jest.fn().mockResolvedValue(undefined),
    };
    Product.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue(product),
    });

    const response = await request(app).post("/adjustments").send({
      productId,
      countedStock: 9,
      reason: "Physical stock count",
    });

    expect(response.status).toBe(201);
    expect(product.numberInStock).toBe(9);
    expect(product.save).toHaveBeenCalledWith({ session });
    expect(recordStockMovement).toHaveBeenCalledWith({
      product,
      type: "adjustment",
      quantity: 3,
      stockChange: -3,
      reason: "Physical stock count",
      referenceType: "stock_count",
      performedBy: "test-user",
      session,
    });
    expect(session.commitTransaction).toHaveBeenCalled();
  });

  test("rejects adjustments without a reason or valid product ID", async () => {
    const missingReason = await request(app).post("/adjustments").send({
      productId,
      countedStock: 9,
    });
    const invalidProductId = await request(app).post("/adjustments").send({
      productId: "not-an-id",
      countedStock: 9,
      reason: "Physical count",
    });

    expect(missingReason.status).toBe(400);
    expect(invalidProductId.status).toBe(400);
    expect(mongoose.startSession).not.toHaveBeenCalled();
  });
});
