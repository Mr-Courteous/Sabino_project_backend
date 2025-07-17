// models/Student.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For password hashing

// Define the schema for the Student model
const StudentSchema = new mongoose.Schema({
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
    registrationNumber: {
        type: String,
        unique: true, // Registration numbers must be unique
        required: [true, 'Registration number is required']
    },
    // NEW FIELDS for payment tracking (integrated from previous discussions)
    currentSemesterPaymentStatus: {
        type: String,
        enum: ['paid', 'unpaid', 'pending'], // Define possible statuses
        default: 'unpaid'
    },
    lastPaidSemester: {
        type: String, // e.g., "Fall 2024"
        default: null
    },
    lastPaidAcademicYear: {
        type: String, // e.g., "2024/2025"
        default: null
    },
    paymentHistory: [{ // Array to store references to payment records
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment' // Reference to your Payment model
    }]
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Pre-save hook to hash the password before saving a new student
StudentSchema.pre('save', async function(next) {
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

module.exports = mongoose.model('Student', StudentSchema);
