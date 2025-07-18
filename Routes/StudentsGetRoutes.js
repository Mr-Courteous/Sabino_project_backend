const express = require('express');
const router = express.Router();
const Enrollment = require('../Models/Enrollments.js'); // Make sure this path is correct
const Student = require('../Models/Students.js'); // To validate student IDs if needed
const Course = require('../Models/Courses.js'); // To validate course IDs
const StudentsTokenCheck = require('./ProtectionMiddlewares.js'); // Ensure this path is correct for your middleware

const jwt = require('jsonwebtoken'); // Keep this if you use jwt directly elsewhere, otherwise it's implicitly used by StudentsTokenCheck


// --- STUDENT DASHBOARD ROUTE ---
// GET /api/student/dashboard/:studentId
// This route retrieves a student's profile and a list of their enrolled courses
// with associated scores and status.
router.get('/api/student/dashboard/:studentId', StudentsTokenCheck, async (req, res) => {
    const { studentId } = req.params;

    // Security check: Ensure the authenticated user (from token) matches the requested studentId
    // This prevents one student from viewing another student's dashboard by changing the URL ID.
    if (req.user !== studentId) {
        return res.status(403).json({ message: 'Forbidden: You can only view your own dashboard.' });
    }

    try {
        // 1. Find the student's profile
        const student = await Student.findById(studentId).lean(); // Use .lean() for faster retrieval
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // 2. Find all enrollments for this student
        const enrollments = await Enrollment.find({ student: studentId })
            .populate('course', 'courseName courseId department credits description semester capacity') // Populate course details
            .lean(); // Use .lean() for faster retrieval

        // Prepare the list of enrolled courses with their details and scores
        const enrolledCourses = enrollments.map(enrollment => ({
            enrollmentId: enrollment._id,
            academicYear: enrollment.academicYear,
            semester: enrollment.semester,
            course: {
                courseId: enrollment.course.courseId, // Assuming courseId is the code
                courseName: enrollment.course.courseName, // Assuming courseName is the title
                department: enrollment.course.department,
                credits: enrollment.course.credits,
                description: enrollment.course.description
            },
            caScore: enrollment.caScore,
            examScore: enrollment.examScore,
            finalGrade: enrollment.finalGrade,
            status: enrollment.status
        }));

        res.status(200).json({
            message: `Dashboard data for student: ${student.name}`,
            studentProfile: {
                _id: student._id,
                name: student.name,
                email: student.email,
                phoneNumber: student.phoneNumber,
                address: student.address,
                department: student.department,
                registrationNumber: student.registrationNumber
                // Exclude password and __v for security
            },
            enrolledCourses: enrolledCourses
        });

    } catch (error) {
        console.error('Error fetching student dashboard data:', error);
        res.status(500).json({ message: 'Server error while fetching student dashboard data.' });
    }
});



module.exports = router;