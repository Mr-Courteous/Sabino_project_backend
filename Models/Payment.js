// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student', // Reference to your Student model
        required: true
    },
    paystackReference: { // Changed from stripePaymentIntentId to store Paystack's reference
        type: String,
        required: true,
        unique: true
    },
    amount: {
        type: Number, // Amount in kobo (Nigerian Naira's smallest unit)
        required: true
    },
    currency: {
        type: String,
        required: true,
        default: 'NGN' // Paystack uses 'NGN'
    },
    status: {
        type: String,
        required: true,
        default: 'pending' // e.g., 'pending', 'success', 'failed', 'abandoned'
    },
    semester: {
        type: String, // e.g., "Fall", "Spring", "Summer"
        required: true
    },
    academicYear: {
        type: String, // e.g., "2024/2025"
        required: true
    },
    description: {
        type: String // e.g., "Tuition Fee - Fall 2024"
    },
    paidAt: { // New field to store when payment was confirmed by webhook
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Payment', paymentSchema);
