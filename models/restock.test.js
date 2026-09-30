const mongoose = require("mongoose");
const { Restock, validate } = require("./restock");

describe("restock model exports", () => {
  test("exports the model and Joi validator used by the route", () => {
    expect(typeof Restock.find).toBe("function");
    expect(typeof validate).toBe("function");
  });

  test("validates a restock record", () => {
    const result = validate({
      productId: new mongoose.Types.ObjectId().toString(),
      quantity: 2,
      date: "2026-09-30",
    });

    expect(result.error).toBeUndefined();
  });

  test("rejects a restock with a non-positive quantity", () => {
    const result = validate({
      productId: new mongoose.Types.ObjectId().toString(),
      quantity: 0,
      date: "2026-09-30",
    });

    expect(result.error).toBeDefined();
  });
});
