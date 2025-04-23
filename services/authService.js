const bcrypt = require("bcryptjs");
const userSchemarepo = require("../repositories/userRepository");
const { generateToken } = require("../utils/jwtUtil");

const createUser = async (email, password) => {
    const existingUser = await userSchemarepo.getUserByEmail(email);
    if (existingUser) {
        throw new Error("User already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    return await userSchemarepo.createUser(email, hashedPassword);
};

const loginUser = async (email, password) => {
    const user = await userSchemarepo.getUserByEmail(email);
    if (!user) {
        throw new Error("User not found");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error("Invalid credentials");
    }

    const token = generateToken(user);

    return { user, token };
};


module.exports = { loginUser, createUser };
