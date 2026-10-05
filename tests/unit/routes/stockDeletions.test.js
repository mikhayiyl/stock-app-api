const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../../../middleware/auth", () => (req, res, next) => {
  req.user = { _id: "test-user" };
  next();
});
jest.mock("../../../middleware/admin", () => (req, res, next) => next());
jest.mock("../../../models/order", () => ({
  Order: { findById: jest.fn() },
}));
jest.mock("../../../models/receipt", () => ({
  Receipt: { findById: jest.fn() },
}));
jest.mock("../../../models/product", () => ({
  Product: { findById: jest.fn(), findOne: jest.fn() },
}));
jest.mock("../../../models/delivery", () => ({
  Delivery: { deleteOne: jest.fn() },
}));
jest.mock("../../../utils/recordStockMovement", () =>
  jest.fn().mockResolvedValue({ _id: "movement-id" }),
);

const { Order } = require("../../../models/order");
const { Receipt } = require("../../../models/receipt");
const { Product } = require("../../../models/product");
const { Delivery } = require("../../../models/delivery");
const recordStockMovement = require("../../../utils/recordStockMovement");

const app = express();
app.use("/orders", require("../../../routes/orders"));
app.use("/receipts", require("../../../routes/receipts"));

const recordId = "000000000000000000000001";
const session = {
  startTransaction: jest.fn(),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn(),
};

const setSessionQueryResult = (query, value) => {
  query.mockReturnValue({
    session: jest.fn().mockResolvedValue(value),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("order deletion", () => {
  test("restores product stock and deletes the order in one transaction", async () => {
    const product = { numberInStock: 3, save: jest.fn() };
    const order = {
      productId: "product-id",
      quantity: 2,
      deleteOne: jest.fn(),
    };
    setSessionQueryResult(Order.findById, order);
    setSessionQueryResult(Product.findById, product);

    const response = await request(app).delete(`/orders/${recordId}`);

    expect(response.status).toBe(200);
    expect(product.numberInStock).toBe(5);
    expect(product.save).toHaveBeenCalledWith({ session });
    expect(recordStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        product,
        type: "order_reversal",
        quantity: 2,
        stockChange: 2,
        referenceType: "order",
        performedBy: "test-user",
        session,
      }),
    );
    expect(order.deleteOne).toHaveBeenCalledWith({ session });
    expect(session.commitTransaction).toHaveBeenCalled();
  });

  test("preserves the order if its product no longer exists", async () => {
    const order = { productId: "missing-product", quantity: 2 };
    setSessionQueryResult(Order.findById, order);
    setSessionQueryResult(Product.findById, null);

    const response = await request(app).delete(`/orders/${recordId}`);

    expect(response.status).toBe(409);
    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.commitTransaction).not.toHaveBeenCalled();
  });
});

describe("receipt deletion", () => {
  test("reverses received stock and deletes the receipt in one transaction", async () => {
    const product = { numberInStock: 9, save: jest.fn() };
    const receipt = {
      isExpress: false,
      itemCode: "ITEM-001",
      quantity: 4,
      deleteOne: jest.fn(),
    };
    setSessionQueryResult(Receipt.findById, receipt);
    setSessionQueryResult(Product.findOne, product);

    const response = await request(app).delete(`/receipts/${recordId}`);

    expect(response.status).toBe(200);
    expect(product.numberInStock).toBe(5);
    expect(product.save).toHaveBeenCalledWith({ session });
    expect(recordStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        product,
        type: "receipt_reversal",
        quantity: 4,
        stockChange: -4,
        referenceType: "receipt",
        performedBy: "test-user",
        session,
      }),
    );
    expect(receipt.deleteOne).toHaveBeenCalledWith({ session });
    expect(session.commitTransaction).toHaveBeenCalled();
  });

  test("preserves receipt if reversing it would make stock negative", async () => {
    const product = { numberInStock: 2, save: jest.fn() };
    const receipt = {
      isExpress: false,
      itemCode: "ITEM-001",
      quantity: 4,
      deleteOne: jest.fn(),
    };
    setSessionQueryResult(Receipt.findById, receipt);
    setSessionQueryResult(Product.findOne, product);

    const response = await request(app).delete(`/receipts/${recordId}`);

    expect(response.status).toBe(409);
    expect(product.save).not.toHaveBeenCalled();
    expect(receipt.deleteOne).not.toHaveBeenCalled();
    expect(session.abortTransaction).toHaveBeenCalled();
  });

  test("removes the matching express delivery without changing stock", async () => {
    const receipt = {
      isExpress: true,
      itemCode: "ITEM-001",
      quantity: 4,
      date: "2026-10-05",
      client: "Client",
      deliveryNote: "Note",
      deleteOne: jest.fn(),
    };
    setSessionQueryResult(Receipt.findById, receipt);
    Delivery.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const response = await request(app).delete(`/receipts/${recordId}`);

    expect(response.status).toBe(200);
    expect(Delivery.deleteOne).toHaveBeenCalledWith(
      {
        itemCode: receipt.itemCode,
        quantity: receipt.quantity,
        date: receipt.date,
        client: receipt.client,
        deliveryNote: receipt.deliveryNote,
        source: "Express",
      },
      { session },
    );
    expect(Product.findOne).not.toHaveBeenCalled();
    expect(session.commitTransaction).toHaveBeenCalled();
  });
});
