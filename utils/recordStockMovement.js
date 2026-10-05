const StockMovement = require("../models/stockMovement");

module.exports = function recordStockMovement({
  product,
  type,
  quantity,
  stockChange,
  reason = "",
  referenceType,
  referenceId,
  performedBy,
  session,
}) {
  const movement = new StockMovement({
    productId: product._id,
    itemCode: product.itemCode,
    type,
    quantity,
    stockChange,
    balanceBefore: product.numberInStock - stockChange,
    balanceAfter: product.numberInStock,
    reason,
    referenceType,
    referenceId,
    performedBy,
  });

  return movement.save({ session });
};
