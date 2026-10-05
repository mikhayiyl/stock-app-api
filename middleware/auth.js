const config = require("config");
const jwt = require("jsonwebtoken");
const { User } = require("../models/user");

module.exports = async function (req, res, next) {
  const token = req.header("x-auth-token");
  if (!token) {
    return res.status(401).send("access denied: token is not provided");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.get("jwtPrivateKey"));
  } catch {
    return res.status(400).send("invalid token");
  }

  const user = await User.findById(decoded._id).select(
    "_id username email isAdmin",
  );
  if (!user) {
    return res.status(401).send("access denied: account no longer exists");
  }

  req.user = {
    ...decoded,
    _id: String(user._id),
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
  };
  return next();
};