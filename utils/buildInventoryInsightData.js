const INSIGHT_WINDOW_DAYS = 30;
const REORDER_COVER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function isWithinWindow(value, start, end) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
}

function isWithinPreviousWindow(value, start, end) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
}

function round(value, decimals = 1) {
  const multiplier = 10 ** decimals;

  return Math.round(value * multiplier) / multiplier;
}

function calculatePercentageChange(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return round(((current - previous) / previous) * 100, 1);
}

function buildInventoryInsightData(
  products,
  orders,
  receipts,
  now = new Date(),
) {
  const end = now.getTime();

  /*
   * Current period:
   * Day 0 → Day 30
   *
   * Previous period:
   * Day 30 → Day 60
   *
   * Keeping these periods separate allows us to make legitimate
   * comparisons instead of asking Gemini to guess whether demand
   * is increasing or decreasing.
   */
  const start = end - INSIGHT_WINDOW_DAYS * DAY_MS;
  const previousStart = start - INSIGHT_WINDOW_DAYS * DAY_MS;

  const recentOrders = orders.filter((order) =>
    isWithinWindow(order.date, start, end),
  );

  const previousOrders = orders.filter((order) =>
    isWithinPreviousWindow(order.date, previousStart, start),
  );

  const recentReceipts = receipts.filter((receipt) =>
    isWithinWindow(receipt.date, start, end),
  );

  const recentExpressDeliveries = recentReceipts.filter(
    (receipt) => receipt.isExpress,
  );

  /*
   * Aggregate demand by product for both periods.
   */
  const salesByCode = new Map();
  const previousSalesByCode = new Map();

  for (const order of recentOrders) {
    salesByCode.set(
      order.itemCode,
      (salesByCode.get(order.itemCode) || 0) + order.quantity,
    );
  }

  for (const order of previousOrders) {
    previousSalesByCode.set(
      order.itemCode,
      (previousSalesByCode.get(order.itemCode) || 0) + order.quantity,
    );
  }

  /*
   * Build the product-level analytical model.
   *
   * This is the important layer between MongoDB and Gemini.
   * Gemini receives calculated business signals rather than raw
   * database records and is therefore much less likely to invent
   * conclusions.
   */
  const rankedProducts = products.map((product) => {
    const soldUnits30d = salesByCode.get(product.itemCode) || 0;

    const soldUnitsPrevious30d = previousSalesByCode.get(product.itemCode) || 0;

    const unitsOnHand = Math.max(0, Number(product.numberInStock) || 0);

    const damagedUnits = Math.max(0, Number(product.damaged) || 0);

    const averageDailyDemand = soldUnits30d / INSIGHT_WINDOW_DAYS;

    const daysOfCover =
      averageDailyDemand > 0
        ? round(unitsOnHand / averageDailyDemand, 1)
        : null;

    const sevenDayTargetUnits = Math.ceil(
      averageDailyDemand * REORDER_COVER_DAYS,
    );

    const sevenDayReorderGap = Math.max(0, sevenDayTargetUnits - unitsOnHand);

    const demandChangePercent = calculatePercentageChange(
      soldUnits30d,
      soldUnitsPrevious30d,
    );

    return {
      itemCode: product.itemCode,
      name: product.name,
      unit: product.unit,

      unitsOnHand,
      damagedUnits,

      soldUnits30d,
      soldUnitsPrevious30d,

      averageDailyDemand: round(averageDailyDemand, 2),

      daysOfCover,

      sevenDayTargetUnits,
      sevenDayReorderGap,

      demandChangePercent,
    };
  });

  /*
   * Products requiring immediate attention.
   */
  const outOfStockProducts = rankedProducts
    .filter((product) => product.unitsOnHand <= 0)
    .sort((a, b) => b.soldUnits30d - a.soldUnits30d)
    .slice(0, 10);

  /*
   * Products with positive demand but insufficient stock
   * for the configured 7-day coverage target.
   */
  const lowStockProducts = rankedProducts
    .filter(
      (product) =>
        product.unitsOnHand > 0 &&
        product.soldUnits30d > 0 &&
        product.unitsOnHand <=
          Math.ceil(
            (product.soldUnits30d / INSIGHT_WINDOW_DAYS) * REORDER_COVER_DAYS,
          ),
    )
    .sort((a, b) => (a.daysOfCover ?? 0) - (b.daysOfCover ?? 0))
    .slice(0, 10);

  /*
   * Products with stock but no recorded demand in the
   * current 30-day window.
   */
  const noRecentDemandProducts = rankedProducts
    .filter((product) => product.unitsOnHand > 0 && product.soldUnits30d === 0)
    .sort((a, b) => b.unitsOnHand - a.unitsOnHand)
    .slice(0, 10);

  /*
   * Products where current demand is materially higher
   * than the previous 30-day period.
   *
   * We only include products with actual current demand,
   * avoiding meaningless percentage changes from zero.
   */
  const risingDemandProducts = rankedProducts
    .filter(
      (product) =>
        product.soldUnits30d > 0 &&
        product.soldUnitsPrevious30d > 0 &&
        product.demandChangePercent > 0,
    )
    .sort((a, b) => b.demandChangePercent - a.demandChangePercent)
    .slice(0, 10);

  /*
   * Products where current demand is lower than the
   * previous 30-day period.
   */
  const fallingDemandProducts = rankedProducts
    .filter(
      (product) =>
        product.soldUnitsPrevious30d > 0 && product.demandChangePercent < 0,
    )
    .sort((a, b) => a.demandChangePercent - b.demandChangePercent)
    .slice(0, 10);

  /*
   * Highest-volume products during the current period.
   */
  const topDemandProducts = rankedProducts
    .filter((product) => product.soldUnits30d > 0)
    .sort((a, b) => b.soldUnits30d - a.soldUnits30d)
    .slice(0, 10);

  /*
   * Overall demand metrics.
   */
  const unitsOrderedLast30Days = recentOrders.reduce(
    (sum, order) => sum + order.quantity,
    0,
  );

  const unitsOrderedPrevious30Days = previousOrders.reduce(
    (sum, order) => sum + order.quantity,
    0,
  );

  const ordersLast30Days = recentOrders.length;
  const ordersPrevious30Days = previousOrders.length;

  const demandChangePercent = calculatePercentageChange(
    unitsOrderedLast30Days,
    unitsOrderedPrevious30Days,
  );

  const ordersChangePercent = calculatePercentageChange(
    ordersLast30Days,
    ordersPrevious30Days,
  );

  /*
   * Average stock coverage across products that have
   * recorded recent demand.
   *
   * Products with zero demand are excluded because their
   * theoretical coverage would be infinite rather than useful.
   */
  const productsWithDemand = rankedProducts.filter(
    (product) => product.daysOfCover !== null,
  );

  const averageDaysOfCover =
    productsWithDemand.length > 0
      ? round(
          productsWithDemand.reduce(
            (sum, product) => sum + product.daysOfCover,
            0,
          ) / productsWithDemand.length,
          1,
        )
      : null;

  const totalUnitsOnHand = products.reduce(
    (sum, product) => sum + Math.max(0, Number(product.numberInStock) || 0),
    0,
  );

  const totalDamagedUnits = products.reduce(
    (sum, product) => sum + Math.max(0, Number(product.damaged) || 0),
    0,
  );

  const unitsReceivedLast30Days = recentReceipts.reduce(
    (sum, receipt) => sum + receipt.quantity,
    0,
  );

  /*
   * Do NOT call this a "damage rate".
   *
   * Your current schema gives us damaged units on products,
   * but does not tell us how many units were damaged during
   * the current 30-day period.
   *
   * We therefore expose the raw damaged-unit count and let
   * the AI discuss it without inventing a rate.
   */
  const damagedStockSharePercent =
    totalUnitsOnHand + totalDamagedUnits > 0
      ? round(
          (totalDamagedUnits / (totalUnitsOnHand + totalDamagedUnits)) * 100,
          1,
        )
      : 0;

  /*
   * Products with the largest current stock positions.
   * Useful for identifying inventory tied up without recent demand.
   */
  const highestStockNoDemandProducts = noRecentDemandProducts
    .slice()
    .sort((a, b) => b.unitsOnHand - a.unitsOnHand)
    .slice(0, 10);

  /*
   * These are the products Gemini is allowed to reference.
   */
  const knownItemCodes = [
    ...new Set(
      [
        ...outOfStockProducts,
        ...lowStockProducts,
        ...noRecentDemandProducts,
        ...risingDemandProducts,
        ...fallingDemandProducts,
        ...topDemandProducts,
      ].map((product) => product.itemCode),
    ),
  ];

  return {
    periodDays: INSIGHT_WINDOW_DAYS,

    metrics: {
      totalProducts: products.length,

      totalUnitsOnHand,

      lowStockCount: rankedProducts.filter(
        (product) =>
          product.unitsOnHand > 0 &&
          product.soldUnits30d > 0 &&
          product.unitsOnHand <=
            Math.ceil(
              (product.soldUnits30d / INSIGHT_WINDOW_DAYS) * REORDER_COVER_DAYS,
            ),
      ).length,

      outOfStockCount: rankedProducts.filter(
        (product) => product.unitsOnHand <= 0,
      ).length,

      damagedUnits: totalDamagedUnits,

      ordersLast30Days,

      ordersPrevious30Days,

      ordersChangePercent,

      unitsOrderedLast30Days,

      unitsOrderedPrevious30Days,

      demandChangePercent,

      unitsReceivedLast30Days,

      expressDeliveriesLast30Days: recentExpressDeliveries.length,

      averageDaysOfCover,

      damagedStockSharePercent,
    },

    signals: {
      outOfStockProducts,

      lowStockProducts,

      noRecentDemandProducts,

      risingDemandProducts,

      fallingDemandProducts,

      topDemandProducts,

      highestStockNoDemandProducts,
    },

    knownItemCodes,
  };
}

module.exports = buildInventoryInsightData;
