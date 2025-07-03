const config = require("config");
const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {

    try {
        const token = req.header("x-auth-token");
        if (!token) return res.status(401).send("access denied:  token is not provided");

        req.user = jwt.verify(token, config.get("jwtPrivateKey"));
        next();
    } catch (ex) {
        res.status(400).send("invalid token");
    };
};