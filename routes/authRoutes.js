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

// In authRoutes.js, your login route should be:
// In your authRoutes.js file
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        
        const { user, token } = await loginUser(email, password);
        
        // Check if user exists and has an email
        if (!user || !user.email) {
            return res.status(400).json({ message: "Invalid user data" });
        }
        
        // Set session data properly
        req.session.user = {
            id: user._id,
            email: user.email
        };
        
        // Save the session explicitly
        req.session.save(err => {
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({ message: "Session error" });
            }
            
            // Log session for debugging
            console.log("Session after login:", req.session);
            
            res.json({ message: "Login successful", token });
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(401).json({ message: err.message });
    }
});

module.exports = router;
