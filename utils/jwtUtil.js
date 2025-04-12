const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.generateToken = (user) => {
    return jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1h" });
};

exports.verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};
