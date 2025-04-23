const express = require('express');
const router = express.Router();
const StripePrice = require('../models/StripePrice');

// Get course by ID
router.get('/:id', async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await StripePrice.findOne({ course_id: courseId });
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    res.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all courses
router.get('/', async (req, res) => {
  try {
    const courses = await StripePrice.find({});
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;