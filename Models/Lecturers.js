// models/Lecturer.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For password hashing

// Define the schema for the Lecturer model
const LecturerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    department: {
        type: String,
        required: [true, 'Department is required'],
        trim: true
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        unique: true // Assuming phone numbers should be unique
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true, // Emails should be unique
        lowercase: true,
        trim: true,
        match: [/.+@.+\..+/, 'Please enter a valid email address'] // Basic email validation
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    },
    // --- New fields for Lecturer details ---
    employeeId: { // Unique identifier for the lecturer (similar to registrationNumber)
        type: String,
        unique: true,
        required: [true, 'Employee ID is required'],
        trim: true
    },
    position: { // e.g., "Professor", "Associate Professor", "Lecturer", "Assistant Lecturer"
        type: String,
        required: [true, 'Position is required'],
        trim: true
    },
    qualifications: { // e.g., ["Ph.D. in Philosophy", "M.A. in History"]
        type: [String], // Array of strings
        default: []
    },
    coursesTaught: { // e.g., ["Introduction to Ethics", "Metaphysics"]
        type: [String], // Array of strings
        default: []
    },
    dateOfEmployment: {
        type: Date,
        required: [true, 'Date of employment is required']
    },
    officeLocation: { // e.g., "Building A, Room 305"
        type: String,
        trim: true
    },
    researchInterests: { // e.g., ["Epistemology", "Philosophy of Mind"]
        type: [String],
        default: []
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Pre-save hook to hash the password before saving a new lecturer
LecturerSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10); // Generate a salt
        this.password = await bcrypt.hash(this.password, salt); // Hash the password
        next();
    } catch (error) {
        next(error); // Pass any error to the next middleware
    }
});

module.exports = mongoose.model('Lecturer', LecturerSchema);
