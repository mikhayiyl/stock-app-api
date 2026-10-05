const express = require("express");
const request = require("supertest");

jest.mock("../../../middleware/auth", () => (req, res, next) => next());
jest.mock("../../../middleware/admin", () => (req, res, next) => next());

const { Product } = require("../../../models/product");
const app = express();
app.use(express.json());
app.use("/", require("../../../routes/products"));

const productId = "000000000000000000000001";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("product stock updates", () => {
  test("rejects PATCH attempts to change stock outside the movement ledger", async () => {
    const findById = jest.spyOn(Product, "findById");

    const response = await request(app)
      .patch(`/${productId}`)
      .send({ numberInStock: 100 });

    expect(response.status).toBe(400);
    expect(findById).not.toHaveBeenCalled();
  });

  test("rejects PUT attempts to alter available or damaged stock", async () => {
    const product = {
      name: "Current product",
      itemCode: "ITEM-001",
      unit: "pcs",
      numberInStock: 10,
      damaged: 0,
      received: "2026-10-05",
      save: jest.fn(),
    };
    jest.spyOn(Product, "findById").mockResolvedValue(product);

    const response = await request(app)
      .put(`/${productId}`)
      .send({
        name: "Updated product",
        itemCode: "ITEM-001",
        unit: "pcs",
        numberInStock: 100,
        damaged: 0,
        received: "2026-10-05",
      });

    expect(response.status).toBe(400);
    expect(product.save).not.toHaveBeenCalled();
  });

  test("allows metadata-only PATCH requests", async () => {
    const product = {
      name: "Current product",
      itemCode: "ITEM-001",
      unit: "pcs",
      numberInStock: 10,
      damaged: 0,
      received: "2026-10-05",
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Product, "findById").mockResolvedValue(product);

    const response = await request(app)
      .patch(`/${productId}`)
      .send({ name: "Updated product" });

    expect(response.status).toBe(200);
    expect(product.name).toBe("Updated product");
    expect(product.numberInStock).toBe(10);
    expect(product.save).toHaveBeenCalled();
  });
});
