const express = require("express");
const mongoose = require("mongoose");
const config = require("config");
const winston = require("winston");
const cors = require("cors");
const morgan = require("morgan");
const Joi = require("joi");
Joi.objectId = require("joi-objectid")(Joi);

//routes
const products = require("./routes/products");
const auth = require("./routes/auth");
const damages = require("./routes/damages");
const orders = require("./routes/orders");
const receipts = require("./routes/receipts");
const users = require("./routes/users");

const app = express();
const port = process.env.PORT || config.get("port");

if (!config.get("jwtPrivateKey")) {
  winston.error("FATAL ERROR:jwtPrivateKey is not defined");
  process.exit(1);
}

//db
const db = process.env.MONGODB_URI || config.get("db");
mongoose
  .connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log(`connecting to ${db}...`))
  .catch((error) => console.log("failed to connect to mongodb", error.message));

app.use(express.json());
app.use(cors());
app.use(morgan("tiny"));
app.use("/api/products", products);
app.use("/api/damages", damages);
app.use("/api/users", users);
app.use("/api/auth", auth);
app.use("/api/orders", orders);
app.use("/api/receipts", receipts);

const server = app.listen(port, () =>
  console.log(`Listening on port ${port}...`)
);
module.exports = server;
