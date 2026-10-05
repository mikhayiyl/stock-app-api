jest.mock("../../../models/stockMovement", () =>
  jest.fn().mockImplementation(function (document) {
    this.document = document;
    this.save = jest.fn().mockResolvedValue(document);
  }),
);

const StockMovement = require("../../../models/stockMovement");
const recordStockMovement = require("../../../utils/recordStockMovement");

describe("recordStockMovement", () => {
  test("records a signed stock change and before/after balances in the transaction", async () => {
    const session = {};
    const product = {
      _id: "product-id",
      itemCode: "ITEM-001",
      numberInStock: 8,
    };

    await recordStockMovement({
      product,
      type: "order",
      quantity: 3,
      stockChange: -3,
      reason: "Order ORD-1",
      referenceType: "order",
      referenceId: "order-id",
      performedBy: "user-id",
      session,
    });

    const movement = StockMovement.mock.instances[0];
    expect(movement.document).toEqual({
      productId: product._id,
      itemCode: product.itemCode,
      type: "order",
      quantity: 3,
      stockChange: -3,
      balanceBefore: 11,
      balanceAfter: 8,
      reason: "Order ORD-1",
      referenceType: "order",
      referenceId: "order-id",
      performedBy: "user-id",
    });
    expect(movement.save).toHaveBeenCalledWith({ session });
  });
});
