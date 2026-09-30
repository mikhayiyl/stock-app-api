require("express-async-errors");

const express = require("express");
const request = require("supertest");
const errorHandler = require("./errorHandler");

afterEach(() => {
  jest.restoreAllMocks();
});

describe("errorHandler", () => {
  test("handles rejected async route handlers without exposing details", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.get("/fail", async () => {
      throw new Error("database connection details");
    });
    app.use(errorHandler);

    const response = await request(app).get("/fail");

    expect(response.status).toBe(500);
    expect(response.text).toBe("Internal Server Error");
    expect(console.error).toHaveBeenCalled();
  });
});
