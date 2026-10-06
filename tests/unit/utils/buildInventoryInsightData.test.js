const buildInventoryInsightData = require("../../../utils/buildInventoryInsightData");

describe("buildInventoryInsightData", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");

  test("calculates inventory risks and excludes out-of-window and express receipts", () => {
    const data = buildInventoryInsightData(
      [
        {
          itemCode: "STEEL-01",
          name: "Steel sheet",
          unit: "pcs",
          numberInStock: 2,
          damaged: 1,
        },
        {
          itemCode: "BOLT-001",
          name: "Steel bolt",
          unit: "pcs",
          numberInStock: 0,
          damaged: 0,
        },
        {
          itemCode: "PAINT-01",
          name: "Blue paint",
          unit: "tins",
          numberInStock: 12,
          damaged: 0,
        },
      ],
      [
        { itemCode: "STEEL-01", quantity: 10, date: "2026-10-01" },
        { itemCode: "BOLT-001", quantity: 3, date: "2026-08-01" },
      ],
      [
        { quantity: 8, date: "2026-10-02", isExpress: false },
        { quantity: 2, date: "2026-10-03", isExpress: true },
      ],
      now,
    );

    expect(data.metrics).toEqual({
      totalProducts: 3,
      totalUnitsOnHand: 14,
      lowStockCount: 1,
      outOfStockCount: 1,
      damagedUnits: 1,
      ordersLast30Days: 1,
      unitsOrderedLast30Days: 10,
      unitsReceivedLast30Days: 8,
      expressDeliveriesLast30Days: 1,
    });
    expect(data.signals.lowStockProducts[0]).toMatchObject({
      itemCode: "STEEL-01",
      daysOfCover: 6,
      sevenDayReorderGap: 1,
    });
    expect(data.signals.outOfStockProducts.map((product) => product.itemCode))
      .toEqual(["BOLT-001"]);
    expect(data.signals.noRecentDemandProducts.map((product) => product.itemCode))
      .toEqual(["PAINT-01"]);
  });
});
