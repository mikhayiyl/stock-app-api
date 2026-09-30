module.exports = function (req, res, next) {
  const isOwner = String(req.user._id) === req.params.id;
  if (!req.user.isAdmin && !isOwner) {
    return res.status(403).send("Access denied");
  }
  next();
};
