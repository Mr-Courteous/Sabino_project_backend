// routes/paymentRoutes.js (This is the file where this endpoint would reside)

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_STRIPE_SECRET_KEY'); // Replace with your actual secret key
const Payment = require('../Models/Payment.js'); // Ensure path is correct
const Student = require('../Models/Students.js'); // To validate student existence


// IMPORTANT: This webhook endpoint needs to parse the raw body, NOT JSON.
// So, it should be placed BEFORE app.use(bodyParser.json()) in your main app.js,
// or use a specific middleware for raw body parsing for this route only.
// The `express.raw({type: 'application/json'})` middleware below handles this for this specific route.

router.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature']; // Get the Stripe signature from the request headers

    let event;

    try {
        // Construct the event from the raw body and signature
        // This verifies that the webhook event is genuinely from Stripe
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event based on its type
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntentSucceeded = event.data.object; // Contains the PaymentIntent object
            console.log(`PaymentIntent succeeded: ${paymentIntentSucceeded.id}`);

            try {
                // Update your Payment record in the database to 'succeeded'
                const updatedPayment = await Payment.findOneAndUpdate(
                    { paymentIntentId: paymentIntentSucceeded.id },
                    {
                        status: 'succeeded',
                        receiptUrl: paymentIntentSucceeded.charges.data[0]?.receipt_url // Get receipt URL if available
                    },
                    { new: true } // Return the updated document
                );

                if (updatedPayment) {
                    console.log(`Payment record ${updatedPayment._id} updated to succeeded.`);
                    // Optionally, update the student's record (e.g., mark fees as paid)
                    // You might need to determine which fee was paid (e.g., tuition, specific semester fee)
                    // For example, if you have a 'feesPaid' array or a 'currentSemesterFeesPaid' flag on the Student model:
                    // await Student.findByIdAndUpdate(paymentIntentSucceeded.metadata.studentId, { $set: { 'fees.fall2025Paid': true } });
                    // Or simply mark a general 'hasPaidFees' if applicable:
                    // await Student.findByIdAndUpdate(paymentIntentSucceeded.metadata.studentId, { hasPaidFees: true });
                } else {
                    console.warn(`Payment record for PaymentIntent ${paymentIntentSucceeded.id} not found in DB.`);
                }
            } catch (dbError) {
                console.error('Error updating payment status in DB from webhook (succeeded):', dbError);
                // In a real app, you might log this to a monitoring system or retry
            }
            break;

        case 'payment_intent.payment_failed':
            const paymentIntentFailed = event.data.object; // Contains the PaymentIntent object
            console.log(`PaymentIntent failed: ${paymentIntentFailed.id}`);
            console.log(`Failure reason: ${paymentIntentFailed.last_payment_error?.message}`);

            try {
                // Update your Payment record in the database to 'failed'
                const updatedPayment = await Payment.findOneAndUpdate(
                    { paymentIntentId: paymentIntentFailed.id },
                    {
                        status: 'failed',
                        description: paymentIntentFailed.last_payment_error?.message || 'Payment failed'
                    },
                    { new: true }
                );
                if (updatedPayment) {
                    console.log(`Payment record ${updatedPayment._id} updated to failed.`);
                } else {
                    console.warn(`Payment record for PaymentIntent ${paymentIntentFailed.id} not found in DB.`);
                }
            } catch (dbError) {
                console.error('Error updating payment status in DB from webhook (failed):', dbError);
            }
            break;

        // Add more cases for other event types you want to handle (e.g., 'charge.refunded')
        // case 'charge.refunded':
        //     const chargeRefunded = event.data.object;
        //     console.log(`Charge refunded: ${chargeRefunded.id}`);
        //     // Update payment status to refunded
        //     break;

        default:
            // Log any unhandled event types
            console.log(`Unhandled event type received: ${event.type}`);
    }

    // Always return a 200 OK response to Stripe to acknowledge receipt of the event
    res.status(200).json({ received: true });
});



// POST /api/create-payment-intent
// This endpoint creates a PaymentIntent on Stripe's side and returns its client secret.
// The client secret is used by the frontend to confirm the payment.
router.post('/api/create-payment-intent', async (req, res) => {
    const { amount, currency, studentId, description, academicYear, semester } = req.body;

    // Basic validation
    if (!amount || amount <= 0 || !currency || !studentId) {
        return res.status(400).json({ message: 'Amount, currency, and studentId are required.' });
    }

    try {
        // 1. Validate student existence
        const studentExists = await Student.findById(studentId);
        if (!studentExists) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // 2. Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, // Amount in cents (or smallest currency unit)
            currency: currency,
            metadata: {
                studentId: studentId,
                description: description || 'EduPortal Payment',
                academicYear: academicYear || 'N/A',
                semester: semester || 'N/A'
            },
            // Add payment_method_types if you want to restrict payment methods
            // payment_method_types: ['card'],
        });

        // 3. Save a pending payment record in your database
        const newPayment = new Payment({
            student: studentId,
            paymentIntentId: paymentIntent.id,
            amount: amount,
            currency: currency,
            status: paymentIntent.status, // Initial status from Stripe
            description: description,
            academicYear: academicYear,
            semester: semester
        });
        await newPayment.save();

        // 4. Send the client secret back to the frontend
        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            paymentId: newPayment._id // Return your internal payment ID
        });

    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ message: 'Failed to create payment intent.', error: error.message });
    }
});

module.exports = router;
