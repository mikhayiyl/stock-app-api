module.exports = function (error, req, res, next) {
  if (res.headersSent) return next(error);

  console.error("Unhandled API error", {
    method: req.method,
    path: req.originalUrl,
    stack: error.stack,
  });
  res.status(500).send("Internal Server Error");
};
