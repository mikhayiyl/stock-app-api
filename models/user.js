const mongoose = require('mongoose');
const Joi = require('joi');
const jwt = require("jsonwebtoken");
const config = require("config");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        maxlength: 50,
        minlength: 5
    },
    email: {
        type: String,
        required: true,
        unique: true,
        maxlength: 50,
        minlength: 5
    },
    password: {
        type: String,
        required: true,
        maxlength: 1050,
        minlength: 6
    },
    isAdmin: {
        type: Boolean,
        default: false
    }
});

userSchema.methods.generateAuthToken = function () {
    return jwt.sign({
        _id: this._id,
        username: this.username,
        email: this.email,
        password: this.password,
        isAdmin: this.isAdmin
    },
        config.get("jwtPrivateKey"))
}

const User = mongoose.model('User', userSchema);

function validateUser(user) {
    const schema = {
        username: Joi.string().min(5).max(50).required(),
        email: Joi.string().max(50).email().required(),
        password: Joi.string().min(6).max(50).required(),
    };
    return Joi.validate(user, schema);
};

exports.User = User;
exports.validate = validateUser;