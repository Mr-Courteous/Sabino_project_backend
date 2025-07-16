const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student', // Reference to your Student model
        required: true
    },
    stripePaymentIntentId: {
        type: String,
        required: true,
        unique: true
    },
    amount: {
        type: Number, // Amount in cents
        required: true
    },
    currency: {
        type: String,
        required: true,
        default: 'usd'
    },
    status: {
        type: String,
        required: true,
        default: 'pending' // e.g., 'pending', 'succeeded', 'failed', 'requires_action'
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
