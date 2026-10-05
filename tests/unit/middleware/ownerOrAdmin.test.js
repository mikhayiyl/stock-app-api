const ownerOrAdmin = require("../../../middleware/ownerOrAdmin");

describe("ownerOrAdmin", () => {
  const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  });

  test("allows the user to update their own account", () => {
    const req = {
      user: { _id: "user-1", isAdmin: false },
      params: { id: "user-1" },
    };
    const res = createResponse();
    const next = jest.fn();

    ownerOrAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("allows admins to update another account", () => {
    const req = {
      user: { _id: "admin-1", isAdmin: true },
      params: { id: "user-1" },
    };
    const res = createResponse();
    const next = jest.fn();

    ownerOrAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("denies users access to another account", () => {
    const req = {
      user: { _id: "user-2", isAdmin: false },
      params: { id: "user-1" },
    };
    const res = createResponse();
    const next = jest.fn();

    ownerOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
