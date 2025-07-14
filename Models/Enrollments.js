// models/Enrollment.js

const mongoose = require('mongoose');

const EnrollmentSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student', // Refers to your Student model
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course', // Refers to your Course model
        required: true
    },
    academicYear: { // e.g., "2024-2025"
        type: String,
        required: true,
        trim: true
    },
    semester: { // e.g., "Fall", "Spring", "Summer"
        type: String,
        required: true,
        enum: ['Fall', 'Spring', 'Summer', 'Winter'], // Example valid semesters
        trim: true
    },
    // --- Updated Grade Fields ---
    caScore: { // Continuous Assessment score (e.g., assignments, quizzes)
        type: Number,
        min: 0,
        max: 100, // Assuming scores are out of 100
        default: 0 // Changed default from null to 0
    },
    examScore: { // Final exam score
        type: Number,
        min: 0,
        max: 100,
        default: 0 // Changed default from null to 0
    },
    finalGrade: { // The calculated final letter grade (e.g., "A", "B+", "C")
        type: String,
        trim: true,
        default: null // Can be null until all scores are entered and calculated
    },
    // The original 'grade' field is now replaced by the detailed scores and finalGrade.
    // If you still need a generic 'grade' string for other purposes, you can keep it,
    // but it might be redundant with 'finalGrade'.
    // grade: { // Optional: to store the final grade (if different from finalGrade)
    //     type: String,
    //     trim: true
    // },
    status: { // e.g., "Enrolled", "Completed", "Dropped"
        type: String,
        enum: ['Enrolled', 'Completed', 'Dropped', 'Pending'],
        default: 'Enrolled'
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Ensure a student can only enroll in a specific course once per academic year and semester
// This prevents duplicate enrollments for the same course in the same term.
EnrollmentSchema.index({ student: 1, course: 1, academicYear: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', EnrollmentSchema);
