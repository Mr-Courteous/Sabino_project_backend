// routes/paymentRoutes.js (This is the file where this endpoint would reside)

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_STRIPE_SECRET_KEY'); // Replace with your actual secret key
const Payment = require('../Models/Payment.js'); // Ensure path is correct
const Student = require('../Models/Students.js'); // To validate student existence
const bodyParser = require('body-parser'); // Needed for raw body parsing for webhooks

// Middleware to protect routes (example - replace with your actual auth logic)
const protect = (req, res, next) => {
    // In a real app, you'd verify JWT token here
    // For this example, we'll assume studentId is passed and valid for simplicity
    // You should implement proper authentication and authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        const token = req.headers.authorization.split(' ')[1];
        // Decode token, verify, find user, attach to req.user
        // For now, we'll just proceed if a token is present.
        next();
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// @route   POST /api/create-payment-intent
// @desc    Create a Stripe Payment Intent
// @access  Private (Student)
router.post('/create-payment-intent', protect, async (req, res) => {
    const { amount, studentId, semester, academicYear, description } = req.body; // amount in cents

    // Basic validation
    if (!amount || !studentId || !semester || !academicYear) {
        return res.status(400).json({ message: 'Missing required payment details.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'Amount must be positive.' });
    }

    try {
        // Find the student to ensure they exist
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Create a Payment Intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, // amount in cents
            currency: 'usd', // or 'ngn' for Nigerian Naira, if supported by your Stripe account
            metadata: {
                studentId: student._id.toString(),
                semester: semester,
                academicYear: academicYear,
                description: description || `Payment for ${semester} ${academicYear}`
            },
            // Optional: add payment method types if you want to restrict (e.g., ['card'])
        });

        // Save the payment record as 'pending' in your database
        const newPayment = new Payment({
            studentId: studentId,
            stripePaymentIntentId: paymentIntent.id,
            amount: amount,
            currency: 'usd', // Match the currency used in Stripe
            status: paymentIntent.status, // Should be 'requires_payment_method' or 'requires_confirmation' initially
            semester: semester,
            academicYear: academicYear,
            description: description || `Payment for ${semester} ${academicYear}`
        });
        await newPayment.save();

        res.status(201).json({
            clientSecret: paymentIntent.client_secret,
            paymentId: newPayment._id // Return your internal payment ID
        });

    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ message: 'Failed to create payment intent.', error: error.message });
    }
});

// @route   POST /webhook
// @desc    Stripe Webhook for handling payment events
// @access  Public (Stripe will call this)
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntentSucceeded = event.data.object;
            console.log(`PaymentIntent for ${paymentIntentSucceeded.amount} was successful!`);

            // Retrieve metadata
            const { studentId, semester, academicYear } = paymentIntentSucceeded.metadata;

            try {
                // Update your internal payment record
                await Payment.findOneAndUpdate(
                    { stripePaymentIntentId: paymentIntentSucceeded.id },
                    {
                        status: 'succeeded',
                        updatedAt: Date.now()
                    },
                    { new: true }
                );

                // Update student's payment status for the current semester
                await Student.findByIdAndUpdate(studentId, {
                    currentSemesterPaymentStatus: 'paid',
                    lastPaidSemester: semester,
                    lastPaidAcademicYear: academicYear,
                    $addToSet: { paymentHistory: paymentIntentSucceeded.id } // Add to history if not already there
                });

                console.log(`Student ${studentId} payment status updated to paid for ${semester} ${academicYear}.`);

            } catch (dbError) {
                console.error('Error updating DB from webhook:', dbError);
                // In a real application, you might want to log this error
                // and have a retry mechanism or manual intervention.
                return res.status(500).json({ received: true, message: 'Database update failed' });
            }
            break;

        case 'payment_intent.payment_failed':
            const paymentIntentFailed = event.data.object;
            console.log(`PaymentIntent failed: ${paymentIntentFailed.last_payment_error?.message}`);

            try {
                // Update your internal payment record to 'failed'
                await Payment.findOneAndUpdate(
                    { stripePaymentIntentId: paymentIntentFailed.id },
                    {
                        status: 'failed',
                        updatedAt: Date.now()
                    },
                    { new: true }
                );
            } catch (dbError) {
                console.error('Error updating DB for failed payment from webhook:', dbError);
                return res.status(500).json({ received: true, message: 'Database update failed for failed payment' });
            }
            break;
        // ... handle other event types
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
});

module.exports = router;
