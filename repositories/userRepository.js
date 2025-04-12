const UserSchema = require("../models/User");

class UserRepository {
    async createUser(email, password) {
        try {
            const user = new UserSchema({ email, password });
            return await user.save();
        } catch (error) {
            throw new Error(`Error creating user: ${error.message}`);
        }
    }

    async getUserByEmail(email) {
        try {
            return await UserSchema.findOne({ email });
        } catch (error) {
            throw new Error(`Failed to get user by email: ${error.message}`);
        }
    }

    async getUserById(id) {
        try {
            return await UserSchema.findById(id);
        } catch (error) {
            throw new Error(`Failed to get user by ID: ${error.message}`);
        }
    }
}

module.exports = new UserRepository();
