const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    courseCode: { // e.g., "CSC101", "PHI205"
        type: String,
        required: [true, 'Course code is required'],
        unique: true,
        trim: true,
        uppercase: true
    },
    title: { // e.g., "Introduction to Computer Science", "Ethics and Society"
        type: String,
        required: [true, 'Course title is required'],
        trim: true
    },
    department: { // e.g., "Computer Science", "Philosophy"
        type: String,
        required: [true, 'Department is required'],
        trim: true
    },
    credits: { // e.g., 3, 4
        type: Number,
        required: [true, 'Credits are required'],
        min: 1
    },
    description: {
        type: String,
        trim: true
    },
    // Reference to the lecturer(s) teaching this course (optional, can be array)
    lecturers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lecturer' // Refers to your Lecturer model
    }],
    // Prerequisite courses (optional)
    prerequisites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course' // Refers to itself for prerequisites
    }],
    // Other relevant details like semester offered, capacity, etc.
    semester: {
        type: String, // e.g., "Fall 2025", "Spring 2026"
        trim: true
    },
    capacity: {
        type: Number,
        min: 0,
        default: 50
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Course', CourseSchema);