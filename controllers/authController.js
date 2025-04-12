const express = require("express");
const { loginUser } = require("../services/authService");

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const token = await loginUser(email, password);
        res.json({ token });
    } catch (err) {
        res.status(401).json({ message: err.message });
    }
});

module.exports = router;
