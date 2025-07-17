const express = require('express');
const router = express.Router();
const Lecturer = require('../Models/Lecturers.js'); // Ensure this path is correct for Lecturer
const Student = require('../Models/Students.js'); // Ensure this path is correct for Student
const bcrypt = require('bcryptjs'); // For password comparison
const jwt = require('jsonwebtoken'); // Import jsonwebtoken

// Define a JWT secret key. In a real application, this should be
// loaded from environment variables (e.g., process.env.JWT_SECRET)
// and kept secret. DO NOT hardcode in production.
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';

// POST /api/lecturer/login
// This route handles lecturer login, authenticating credentials and returning profile on success.
router.post('/api/lecturer/login', async (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        // 1. Find the lecturer by email
        const lecturer = await Lecturer.findOne({ email: email.toLowerCase() }); // Ensure email is lowercased for consistent lookup
        if (!lecturer) {
            return res.status(401).json({ message: 'Invalid credentials.' }); // Use generic message for security
        }

        // 2. Compare the provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, lecturer.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' }); // Use generic message for security
        }

        // 3. If credentials are valid, generate a JWT
        // The payload typically includes user ID and role, but avoid sensitive data.
        const token = jwt.sign(
            { id: lecturer._id, role: 'lecturer' },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        // 4. Return the lecturer's profile (excluding sensitive info) and the token
        const lecturerResponse = lecturer.toObject(); // Convert Mongoose document to plain JavaScript object
        delete lecturerResponse.password; // Remove password for security
        delete lecturerResponse.__v; // Remove version key

        res.status(200).json({
            message: 'Login successful!',
            token: token, // Send the JWT to the client
            lecturer: lecturerResponse
        });

    } catch (error) {
        console.error('Error during lecturer login:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// NEW ROUTE: POST /api/student/login 
// This route handles student login, authenticating credentials and returning profile on success.
router.post('/api/student/login', async (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        // 1. Find the student by email
        // If your Student schema has `email: { select: false }`, you might also need to
        // explicitly select it here: `.select('+email')` after findOne.
        // For example: const student = await Student.findOne({ email: email.toLowerCase() }).select('+email');
        const student = await Student.findOne({ email: email.toLowerCase() });
        if (!student) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // 2. Compare the provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        } 

        // 3. If credentials are valid, generate a JWT
        const token = jwt.sign(
            { id: student._id, role: 'student' },
            process.env.JWT_SECRET || 'your_jwt_secret', // Using process.env.JWT_SECRET (recommended) or fallback
            { expiresIn: '1h' } // Token expires in 1 hour
        ); 

        // 4. Prepare the student response object
        const studentResponse = student.toObject(); // Convert Mongoose document to plain JavaScript object

        // Ensure sensitive data is removed
        delete studentResponse.password;
        delete studentResponse.__v; 
        
        // --- ADD THIS LINE TO EXPLICITLY INCLUDE EMAIL ---
        // This guarantees that the 'email' property is on the studentResponse object,
        // even if it was excluded by default by `toObject()` (e.g., due to `select: false` in schema).
        studentResponse.email = student.email; 
        // --- END EXPLICIT ADDITION ---

        res.status(200).json({
            message: 'Login successful!',
            token: token,
            student: studentResponse // Now guaranteed to contain _id and email
        });

    } catch (error) {
        console.error('Error during student login:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

module.exports = router;
