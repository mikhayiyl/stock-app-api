const express = require("express");
const request = require("supertest");

jest.mock("../../../middleware/auth", () => (req, res, next) => {
  req.user = { _id: "000000000000000000000002", isAdmin: true };
  next();
});
jest.mock("../../../middleware/admin", () => (req, res, next) => next());
jest.mock("../../../models/user", () => {
  const actual = jest.requireActual("../../../models/user");
  return {
    ...actual,
    User: {
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
    },
  };
});

const { User } = require("../../../models/user");
const app = express();
app.use(express.json());
app.use("/", require("../../../routes/users"));

const adminId = "000000000000000000000002";
const userId = "000000000000000000000001";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("user administration", () => {
  test("lists users without passwords", async () => {
    const users = [{ _id: userId, username: "staff", isAdmin: false }];
    const sort = jest.fn().mockResolvedValue(users);
    const select = jest.fn().mockReturnValue({ sort });
    User.find.mockReturnValue({ select });

    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(users);
    expect(select).toHaveBeenCalledWith("-password");
    expect(sort).toHaveBeenCalledWith("username");
  });

  test("allows an administrator to promote a user", async () => {
    const user = {
      _id: userId,
      username: "staff",
      email: "staff@example.com",
      isAdmin: false,
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findById.mockResolvedValue(user);

    const response = await request(app)
      .patch(`/${userId}/role`)
      .send({ isAdmin: true });

    expect(response.status).toBe(200);
    expect(response.body.isAdmin).toBe(true);
    expect(user.isAdmin).toBe(true);
    expect(user.save).toHaveBeenCalled();
  });

  test("prevents removing the last administrator", async () => {
    const user = {
      _id: userId,
      username: "admin",
      email: "admin@example.com",
      isAdmin: true,
      save: jest.fn(),
    };
    User.findById.mockResolvedValue(user);
    User.countDocuments.mockResolvedValue(1);

    const response = await request(app)
      .patch(`/${userId}/role`)
      .send({ isAdmin: false });

    expect(response.status).toBe(409);
    expect(user.save).not.toHaveBeenCalled();
  });

  test("prevents administrators from demoting themselves", async () => {
    const user = {
      _id: adminId,
      isAdmin: true,
      save: jest.fn(),
    };
    User.findById.mockResolvedValue(user);

    const response = await request(app)
      .patch(`/${adminId}/role`)
      .send({ isAdmin: false });

    expect(response.status).toBe(409);
    expect(User.countDocuments).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  test("prevents deleting the last administrator", async () => {
    const user = {
      _id: userId,
      isAdmin: true,
      deleteOne: jest.fn(),
    };
    User.findById.mockResolvedValue(user);
    User.countDocuments.mockResolvedValue(1);

    const response = await request(app).delete(`/${userId}`);

    expect(response.status).toBe(409);
    expect(user.deleteOne).not.toHaveBeenCalled();
  });

  test("prevents an administrator from deleting their own account", async () => {
    const user = {
      _id: adminId,
      isAdmin: true,
      deleteOne: jest.fn(),
    };
    User.findById.mockResolvedValue(user);

    const response = await request(app).delete(`/${adminId}`);

    expect(response.status).toBe(409);
    expect(User.countDocuments).not.toHaveBeenCalled();
    expect(user.deleteOne).not.toHaveBeenCalled();
  });
});
