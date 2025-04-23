const express = require("express");
const { loginUser, createUser } = require("../services/authService");

const router = express.Router();

router.post("/register", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await createUser(email, password);
        res.status(201).json({ success: true, message: "User created successfully", userId: user._id });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // ✅ FIX: Destructure { user, token } correctly
        const { user, token } = await loginUser(email, password);

        // ✅ Store session user info
        req.session.user = {
            id: user._id,
            email: user.email
        };

        res.json({ success: true, token, email: user.email });
    } catch (err) {
        res.status(401).json({ message: err.message });
    }
});

module.exports = router;
