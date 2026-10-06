const INSIGHT_WINDOW_DAYS = 30;
const REORDER_COVER_DAYS = 7;

function isWithinWindow(value, start, end) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
}

function buildInventoryInsightData(products, orders, receipts, now = new Date()) {
  const end = now.getTime();
  const start = end - INSIGHT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const salesByCode = new Map();
  const recentOrders = orders.filter((order) =>
    isWithinWindow(order.date, start, end),
  );

  for (const order of recentOrders) {
    salesByCode.set(
      order.itemCode,
      (salesByCode.get(order.itemCode) || 0) + order.quantity,
    );
  }

  const rankedProducts = products.map((product) => {
    const soldUnits30d = salesByCode.get(product.itemCode) || 0;
    const unitsOnHand = product.numberInStock;
    const averageDailyDemand = soldUnits30d / INSIGHT_WINDOW_DAYS;

    return {
      itemCode: product.itemCode,
      name: product.name,
      unit: product.unit,
      unitsOnHand,
      damagedUnits: product.damaged || 0,
      soldUnits30d,
      daysOfCover:
        averageDailyDemand > 0
          ? Math.round((unitsOnHand / averageDailyDemand) * 10) / 10
          : null,
      sevenDayReorderGap:
        averageDailyDemand > 0
          ? Math.max(
              0,
              Math.ceil(averageDailyDemand * REORDER_COVER_DAYS) -
                unitsOnHand,
            )
          : 0,
    };
  });

  const outOfStockProducts = rankedProducts
    .filter((product) => product.unitsOnHand <= 0)
    .sort((a, b) => b.soldUnits30d - a.soldUnits30d)
    .slice(0, 10);
  const lowStockProducts = rankedProducts
    .filter(
      (product) =>
        product.unitsOnHand > 0 &&
        product.soldUnits30d > 0 &&
        product.unitsOnHand <=
          Math.ceil((product.soldUnits30d / INSIGHT_WINDOW_DAYS) * REORDER_COVER_DAYS),
    )
    .sort((a, b) => (a.daysOfCover ?? 0) - (b.daysOfCover ?? 0))
    .slice(0, 10);
  const noRecentDemandProducts = rankedProducts
    .filter(
      (product) => product.unitsOnHand > 0 && product.soldUnits30d === 0,
    )
    .sort((a, b) => b.unitsOnHand - a.unitsOnHand)
    .slice(0, 10);
  const recentReceipts = receipts.filter(
    (receipt) =>
      !receipt.isExpress && isWithinWindow(receipt.date, start, end),
  );
  const recentExpressDeliveries = receipts.filter(
    (receipt) =>
      receipt.isExpress && isWithinWindow(receipt.date, start, end),
  );
  const knownItemCodes = [
    ...new Set(
      [
        ...outOfStockProducts,
        ...lowStockProducts,
        ...noRecentDemandProducts,
      ].map((product) => product.itemCode),
    ),
  ];

  return {
    periodDays: INSIGHT_WINDOW_DAYS,
    metrics: {
      totalProducts: products.length,
      totalUnitsOnHand: products.reduce(
        (sum, product) => sum + product.numberInStock,
        0,
      ),
      lowStockCount: rankedProducts.filter(
        (product) =>
          product.unitsOnHand > 0 &&
          product.soldUnits30d > 0 &&
          product.unitsOnHand <=
            Math.ceil(
              (product.soldUnits30d / INSIGHT_WINDOW_DAYS) *
                REORDER_COVER_DAYS,
            ),
      ).length,
      outOfStockCount: rankedProducts.filter(
        (product) => product.unitsOnHand <= 0,
      ).length,
      damagedUnits: products.reduce(
        (sum, product) => sum + (product.damaged || 0),
        0,
      ),
      ordersLast30Days: recentOrders.length,
      unitsOrderedLast30Days: recentOrders.reduce(
        (sum, order) => sum + order.quantity,
        0,
      ),
      unitsReceivedLast30Days: recentReceipts.reduce(
        (sum, receipt) => sum + receipt.quantity,
        0,
      ),
      expressDeliveriesLast30Days: recentExpressDeliveries.length,
    },
    signals: {
      outOfStockProducts,
      lowStockProducts,
      noRecentDemandProducts,
    },
    knownItemCodes,
  };
}

module.exports = buildInventoryInsightData;
