// authMiddleware.js
const { verifyToken } = require("../utils/jwtUtil");

const protect = (req, res, next) => {
    try {
        const token = req.header("Authorization")?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ success: false, message: "Access Denied. No token provided." });
        }

        req.user = verifyToken(token);
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: "Invalid token" });
    }
};

module.exports = protect;
