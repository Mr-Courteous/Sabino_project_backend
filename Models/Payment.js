// models/Payment.js

const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student', // Reference to the Student model
        required: true
    },
    paymentIntentId: { // Stripe's unique Payment Intent ID
        type: String,
        required: true,
        unique: true
    },
    amount: { // Amount in the smallest currency unit (e.g., cents for USD)
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        default: 'USD' // Or your local currency like 'NGN' for Nigerian Naira
    },
    status: { // Status of the payment (e.g., 'requires_payment_method', 'succeeded', 'canceled')
        type: String,
        required: true,
        enum: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled', 'failed'],
        default: 'requires_payment_method'
    },
    description: { // Optional description for the payment (e.g., "Tuition Fee - Fall 2025")
        type: String,
        trim: true
    },
    // You might want to link this payment to a specific academic year/semester
    academicYear: {
        type: String,
        trim: true
    },
    semester: {
        type: String,
        trim: true
    },
    receiptUrl: { // URL to Stripe's hosted receipt (if applicable)
        type: String,
        trim: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Payment', PaymentSchema);
