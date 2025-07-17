// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios'); // For making HTTP requests to Paystack
const crypto = require('crypto'); // For webhook verification
const Payment = require('../Models/Payment');
const Student = require("../Models/Students.js") // Assuming this path is correct

// Middleware to protect routes (example - replace with your actual auth logic)
const protect = (req, res, next) => {
    // In a real app, you'd verify JWT token here (e.g., using jsonwebtoken)
    // For this example, we'll assume studentId is passed and valid for simplicity
    // You should implement proper authentication and authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        const token = req.headers.authorization.split(' ')[1];
        // TODO: Implement actual JWT verification here
        // e.g., jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => { ... });
        next();
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Paystack API Base URL
const PAYSTACK_API_BASE_URL = 'https://api.paystack.co';

// @route   POST /api/initiate-payment
// @desc    Initiate a Paystack transaction
// @access  Private (Student)
router.post('/initiate-payment', protect, async (req, res) => {
    const { amount, studentId, semester, academicYear, description, email } = req.body; // amount in Naira

    // Basic validation
    if (!amount || !studentId || !semester || !academicYear || !email) {
        return res.status(400).json({ message: 'Missing required payment details (amount, studentId, semester, academicYear, email).' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'Amount must be positive.' });
    }

    try {
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Paystack requires amount in kobo (amount * 100)
        const amountInKobo = Math.round(amount * 100);

        // Initiate transaction with Paystack
        const paystackResponse = await axios.post(
            `${PAYSTACK_API_BASE_URL}/transaction/initialize`,
            {
                email: email,
                amount: amountInKobo,
                currency: 'NGN',
                metadata: {
                    student_id: student._id.toString(),
                    semester: semester,
                    academic_year: academicYear,
                    description: description || `Fee payment for ${semester} ${academicYear}`
                },
                // callback_url: 'YOUR_FRONTEND_PAYMENT_SUCCESS_URL' // Optional: Paystack can redirect here after payment
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (paystackResponse.data && paystackResponse.data.status) {
            const paystackData = paystackResponse.data.data;

            // Save a pending payment record in your database
            const newPayment = new Payment({
                studentId: student._id,
                paystackReference: paystackData.reference, // Paystack's transaction reference
                amount: amountInKobo,
                currency: 'NGN',
                status: 'pending', // Initial status
                semester: semester,
                academicYear: academicYear,
                description: description || `Fee payment for ${semester} ${academicYear}`
            });
            await newPayment.save();

            res.status(200).json({
                authorization_url: paystackData.authorization_url, // URL to redirect user to
                access_code: paystackData.access_code, // Access code for inline payment
                reference: paystackData.reference, // Paystack's transaction reference
                paymentId: newPayment._id // Your internal payment ID
            });
        } else {
            console.error('Paystack initiation failed:', paystackResponse.data);
            res.status(500).json({ message: 'Failed to initiate payment with Paystack.', details: paystackResponse.data.message });
        }

    } catch (error) {
        console.error('Error initiating payment:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Failed to initiate payment.', error: error.response ? error.response.data.message : error.message });
    }
});

// @route   GET /api/verify-payment/:reference
// @desc    Verify a Paystack transaction after completion (called from frontend)
// @access  Private (Student)
router.get('/verify-payment/:reference', protect, async (req, res) => {
    const { reference } = req.params;

    try {
        const paystackResponse = await axios.get(
            `${PAYSTACK_API_BASE_URL}/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        const paystackData = paystackResponse.data.data;

        if (paystackData && paystackData.status === 'success') {
            const { student_id, semester, academic_year } = paystackData.metadata;

            // Update your internal payment record
            const updatedPayment = await Payment.findOneAndUpdate(
                { paystackReference: reference },
                {
                    status: 'success',
                    paidAt: paystackData.paid_at,
                    updatedAt: Date.now()
                },
                { new: true }
            );

            // Update student's payment status
            await Student.findByIdAndUpdate(student_id, {
                currentSemesterPaymentStatus: 'paid',
                lastPaidSemester: semester,
                lastPaidAcademicYear: academic_year,
                $addToSet: { paymentHistory: updatedPayment._id }
            });

            res.status(200).json({ message: 'Payment verified successfully.', payment: updatedPayment });
        } else {
            res.status(400).json({ message: 'Payment verification failed.', details: paystackData.gateway_response || 'Unknown status' });
        }

    } catch (error) {
        console.error('Error verifying payment:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Failed to verify payment.', error: error.response ? error.response.data.message : error.message });
    }
});


// @route   POST /webhook
// @desc    Paystack Webhook for handling payment events (called by Paystack)
// @access  Public
router.post('/webhook', express.json(), async (req, res) => { // Use express.json() for Paystack webhooks
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');

    if (hash == req.headers['x-paystack-signature']) {
        const event = req.body;

        if (event.event === 'charge.success') {
            const paystackData = event.data;
            const reference = paystackData.reference;
            const { student_id, semester, academic_year } = paystackData.metadata;

            try {
                // Find and update the payment record
                const updatedPayment = await Payment.findOneAndUpdate(
                    { paystackReference: reference },
                    {
                        status: 'success',
                        paidAt: paystackData.paid_at,
                        updatedAt: Date.now()
                    },
                    { new: true }
                );

                if (updatedPayment) {
                    // Update student's payment status
                    await Student.findByIdAndUpdate(student_id, {
                        currentSemesterPaymentStatus: 'paid',
                        lastPaidSemester: semester,
                        lastPaidAcademicYear: academic_year,
                        $addToSet: { paymentHistory: updatedPayment._id }
                    });
                    console.log(`Webhook: Student ${student_id} payment status updated to paid for ${semester} ${academic_year}.`);
                } else {
                    console.warn(`Webhook: Payment record with reference ${reference} not found. Creating new one.`);
                    // If for some reason the payment record wasn't created before webhook (unlikely with initiate-payment flow)
                    const newPayment = new Payment({
                        studentId: student_id,
                        paystackReference: reference,
                        amount: paystackData.amount, // amount from webhook is in kobo
                        currency: paystackData.currency,
                        status: 'success',
                        semester: semester,
                        academicYear: academic_year,
                        description: paystackData.metadata.description || `Fee payment for ${semester} ${academicYear}`,
                        paidAt: paystackData.paid_at,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                    await newPayment.save();
                    await Student.findByIdAndUpdate(student_id, {
                        currentSemesterPaymentStatus: 'paid',
                        lastPaidSemester: semester,
                        lastPaidAcademicYear: academic_year,
                        $addToSet: { paymentHistory: newPayment._id }
                    });
                }

            } catch (dbError) {
                console.error('Webhook: Error updating DB from webhook:', dbError);
                return res.status(500).json({ received: true, message: 'Database update failed' });
            }
        } else if (event.event === 'charge.failed') {
            const paystackData = event.data;
            const reference = paystackData.reference;

            try {
                await Payment.findOneAndUpdate(
                    { paystackReference: reference },
                    {
                        status: 'failed',
                        updatedAt: Date.now()
                    },
                    { new: true }
                );
                console.log(`Webhook: Payment with reference ${reference} failed.`);
            } catch (dbError) {
                console.error('Webhook: Error updating DB for failed payment:', dbError);
                return res.status(500).json({ received: true, message: 'Database update failed for failed payment' });
            }
        }
        // Always return 200 to Paystack to acknowledge receipt
        res.status(200).json({ received: true });
    } else {
        // Invalid signature
        console.error('Webhook: Invalid Paystack signature!');
        res.status(400).send('Invalid signature');
    }
});

module.exports = router;
