const { User } = require("../models/user");
const Joi = require('joi');
const validator = require("../middleware/validator");
const router = require("express").Router();
const bcrypt = require("bcrypt");


router.post('/', validator(validateAuth), async (req, res) => {

    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).send("Invalid credentials");

    const password = await bcrypt.compare(req.body.password, user.password);
    if (!password) return res.status(400).send("Invalid credentials");

    const token = user.generateAuthToken();

    res.send(token);
});



function validateAuth(auth) {
    const schema = {
        email: Joi.string().max(50).email().required(),
        password: Joi.string().min(6).max(50).required(),
    };
    return Joi.validate(auth, schema);
};



module.exports = router;