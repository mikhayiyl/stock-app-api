jest.mock("config", () => ({
  get: jest.fn(),
}));
jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(),
}));

const config = require("config");
const { GoogleGenAI } = require("@google/genai");
const generateInventoryInsights = require("../../../utils/generateInventoryInsights");
const { parseInsights } = generateInventoryInsights;

beforeEach(() => {
  jest.clearAllMocks();
  config.get.mockImplementation((key) =>
    key === "geminiApiKey" ? "test-key" : "gemini-test-model",
  );
});

describe("parseInsights", () => {
  test("removes item codes not present in the inventory snapshot", () => {
    const parsed = parseInsights(
      JSON.stringify({
        summary: "A short inventory summary.",
        insights: [
          {
            priority: "urgent",
            category: "replenishment",
            title: "Replenish stock",
            observation: "One item is low.",
            recommendation: "Review a reorder.",
            itemCodes: ["ITEM-001", "UNKNOWN-1", "ITEM-001"],
          },
        ],
      }),
      ["ITEM-001"],
    );

    expect(parsed.insights[0].itemCodes).toEqual(["ITEM-001"]);
  });

  test("rejects malformed or incomplete model output", () => {
    expect(() => parseInsights("not json", [])).toThrow();
    expect(() =>
      parseInsights(JSON.stringify({ summary: "", insights: [] }), []),
    ).toThrow("invalid inventory insights response");
  });

  test("calls the official SDK with structured inventory output", async () => {
    const create = jest.fn().mockResolvedValue({
      output_text: JSON.stringify({
        summary: "Review one low-stock product.",
        insights: [
          {
            priority: "urgent",
            category: "replenishment",
            title: "Review stock",
            observation: "One item has low cover.",
            recommendation: "Check the reorder quantity.",
            itemCodes: ["ITEM-001"],
          },
        ],
      }),
    });
    GoogleGenAI.mockImplementation(() => ({
      interactions: { create },
    }));

    const result = await generateInventoryInsights({
      metrics: { lowStockCount: 1 },
      signals: {},
      knownItemCodes: ["ITEM-001"],
    });

    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-test-model",
        response_format: expect.objectContaining({
          type: "text",
          mime_type: "application/json",
        }),
      }),
    );
    expect(result.insights[0].itemCodes).toEqual(["ITEM-001"]);
  });
});
