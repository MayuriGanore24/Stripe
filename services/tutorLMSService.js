// tutorLMSService.js
require('dotenv').config();
const axios = require('axios');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const mongoose=require('mongoose')

class TutorLMSService {
    constructor() {
        this.apiUrl = process.env.WORDPRESS_API_URL;
    }

    // Configure Axios with WordPress API credentials
    getAxiosConfig() {
        const token = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64');
        return {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${token}`
            }
        };
    }

    // Enroll a user in a course
    async enrollUserInCourse(userId, courseId) {
        try {
            // Get user from your database
            const user = await User.findById(userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }

            // Try to find WordPress user ID
            let wpUserId = await this.findWordPressUserIdByEmail(user.email);

            // If WordPress user doesn't exist, create one
            if (!wpUserId) {
                wpUserId = await this.createWordPressUser(user);
                if (!wpUserId) {
                    throw new Error(`Failed to create WordPress user for ${user.email}`);
                }
            }

            // Make the enrollment request
            const response = await axios.post(
                `${this.apiUrl}/wp-json/tutor/v1/enrollments`,
                {
                    user_id: wpUserId,
                    course_id: courseId
                },
                this.getAxiosConfig()
            );

            return {
                success: true,
                enrollment_id: response.data.id,
                wordpress_user_id: wpUserId
            };
        } catch (error) {
        
            console.error('Error enrolling user in course:', error.message);
        //     if (error.response) {
        //         console.error('Status:', error.response.status);
        //         console.error('Headers:', error.response.headers);
        //         console.error('Data:', error.response.data); // <-- this helps a lot
            
        // }

            throw new Error(`Enrollment failed: ${error.message}`);
        }
    }

    // New method to create WordPress user
    async createWordPressUser(user) {
        try {
            // Generate a random password
            const tempPassword = Math.random().toString(36).slice(-10);

            // Log the exact request we're about to make
            const requestUrl = `${this.apiUrl}/wp-json/tutor/v1/enrollments`;
            const requestData = {
                username: user.email.split('@')[0] + Math.floor(Math.random() * 1000),
                email: user.email,
                password: tempPassword,
                role: 'subscriber'
            };

            console.log("Making WordPress API request to:", requestUrl);
            console.log("With data:", JSON.stringify(requestData));

            const config = this.getAxiosConfig();
            console.log("Using headers:", config.headers);

            // Make the request
            const response = await axios.post(requestUrl, requestData, config);

            console.log("WordPress API response status:", response.status);
            console.log("WordPress API response data:", response.data);

            // Return user ID if successful
            return response.data.id;
        } catch (error) {
            console.error('Error creating WordPress user:');
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Headers:', error.response.headers);
                console.error('Data:', error.response.data);
            } else {
                console.error('Error details:', error.message);
            }
            return null;
        }
    }

    // Find WordPress user by email
    async findWordPressUserIdByEmail(email) {
        try {
            // Use WordPress REST API to find user by email
            const response = await axios.get(
                `${this.apiUrl}/wp/v2/users?search=${encodeURIComponent(email)}`,
                this.getAxiosConfig()
            );

            if (response.data && response.data.length > 0) {
                return response.data[0].id;
            }

            return null;
        } catch (error) {
            console.error('Error finding WordPress user:', error);
            return null;
        }
    }

    // Verify course access
    async verifyCourseAccess(userId, courseId) {
        try {
            // First check subscription status in your database
            const user = await User.findById(userId);

            if (!user) {
                throw new Error(`User not found`);
            }

            // Check if user has an active subscription for this course
            const subscription = await Subscription.findOne({
                UserID: userId,
                Solution_id: courseId,
                sub_status: 'active',
                End_Date: { $gt: new Date().toISOString() }
            });

            if (subscription) {
                return { hasAccess: true, source: 'database' };
            }

            // If not found in database, check with WordPress
            const wpUserId = await this.findWordPressUserIdByEmail(user.email);

            if (!wpUserId) {
                return { hasAccess: false, reason: 'wordpress_user_not_found' };
            }

            const response = await axios.get(
                `${this.apiUrl}/tutor/v1/enrollments?user_id=${wpUserId}&course_id=${courseId}`,
                this.getAxiosConfig()
            );

            if (response.data && response.data.length > 0) {
                // User is enrolled according to WordPress
                // Create a subscription record in our database to sync the data
                const newSubscription = new Subscription({
                    _id: new mongoose.Types.ObjectId(),
                    UserID: userId,
                    email: user.email,
                    stripe_payment_id: 'wp_enrollment_' + response.data[0].id,
                    stripe_subscription_id: null,
                    plan_id: 'WordPress_Import',
                    Solution_id: courseId,
                    auto_renew: false,
                    sub_status: 'active',
                    payment_method: 'wordpress',
                    start_date: new Date(response.data[0].date_created).toISOString(),
                    End_Date: '31/12/9999', // No end date for WordPress enrollments
                    created_at: new Date(),
                    updated_at: new Date()
                });

                await newSubscription.save();

                return { hasAccess: true, source: 'wordpress' };
            }

            return { hasAccess: false, reason: 'not_enrolled' };
        } catch (error) {
            console.error('Error verifying course access:', error);
            throw new Error(`Access verification failed: ${error.message}`);
        }
    }
}

module.exports = new TutorLMSService();