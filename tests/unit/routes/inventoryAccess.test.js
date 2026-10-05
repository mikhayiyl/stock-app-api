const express = require("express");
const request = require("supertest");

const app = express();
app.use("/products", require("../../../routes/products"));
app.use("/receipts", require("../../../routes/receipts"));
app.use("/orders", require("../../../routes/orders"));
app.use("/damages", require("../../../routes/damages"));
app.use("/restocks", require("../../../routes/restocks"));
app.use("/stock-movements", require("../../../routes/stockMovements"));

describe("inventory read access", () => {
  test.each([
    "/products",
    "/receipts",
    "/orders",
    "/damages",
    "/restocks",
    "/products/000000000000000000000000",
    "/receipts/000000000000000000000000",
    "/orders/000000000000000000000000",
    "/damages/000000000000000000000000",
    "/restocks/000000000000000000000000",
    "/stock-movements",
  ])("requires authentication for GET %s", async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(401);
  });
});
