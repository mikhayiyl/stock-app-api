jest.mock("config", () => ({
  get: jest.fn(() => "test-secret"),
}));
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));
jest.mock("../../../models/user", () => ({
  User: { findById: jest.fn() },
}));

const jwt = require("jsonwebtoken");
const { User } = require("../../../models/user");
const auth = require("../../../middleware/auth");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("auth middleware", () => {
  test("uses the current database role instead of a stale token role", async () => {
    jwt.verify.mockReturnValue({
      _id: "user-1",
      isAdmin: true,
      email: "user@example.com",
    });
    const select = jest.fn().mockResolvedValue({
      _id: "user-1",
      username: "staff",
      email: "user@example.com",
      isAdmin: false,
    });
    User.findById.mockReturnValue({ select });
    const req = { header: jest.fn().mockReturnValue("valid-token") };
    const res = createResponse();
    const next = jest.fn();

    await auth(req, res, next);

    expect(req.user.isAdmin).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("rejects tokens belonging to deleted users", async () => {
    jwt.verify.mockReturnValue({ _id: "deleted-user", isAdmin: true });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    const req = { header: jest.fn().mockReturnValue("valid-token") };
    const res = createResponse();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
