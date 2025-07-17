const express = require('express');
const router = express.Router();
const Enrollment = require('../Models/Enrollments.js'); // Make sure this path is correct
const Student = require('../Models/Students.js'); // To validate student IDs if needed
const Course = require('../Models/Courses.js'); // To validate course IDs
const StudentsTokenCheck = require ('./ProtectionMiddlewares.js')

const jwt = require('jsonwebtoken');


// module.exports = StudentsTokenCheck;
// --- STUDENT DASHBOARD ROUTE ---
// GET /api/student/dashboard/:studentId
// This route retrieves a student's profile and a list of their enrolled courses
// with associated scores and status.
router.get('/api/student/dashboard/:studentId',StudentsTokenCheck, async (req, res) => {
    const { studentId } = req.params;

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

// GET ROUTE: Get all students enrolled in a particular course
// This route allows a lecturer to retrieve a list of students enrolled in a specific course.
// Optional query parameters: academicYear, semester
// Example: GET /api/grades/course/60d5ec49f8c7a3001c8a4d7c/students?academicYear=2025-2026&semester=Fall
router.get('/api/grades/course/:courseId/students', async (req, res) => {
    const { courseId } = req.params;
    const { academicYear, semester } = req.query; // Get academicYear and semester from query parameters

    try {
        // 1. Validate if the Course exists
        const courseExists = await Course.findById(courseId);
        if (!courseExists) {
            return res.status(404).json({ message: 'Course not found.' });
        }

        // Build the query object for enrollments
        let query = {
            course: courseId
        };

        if (academicYear) {
            query.academicYear = academicYear;
        }
        if (semester) {
            query.semester = semester;
        }

        // 2. Find all enrollments matching the criteria
        // Use .populate('student') to get the full student document details
        // Use .populate('course', 'title courseCode') to get specific course details
        const enrollments = await Enrollment.find(query)
            .populate('student', 'name email phoneNumber registrationNumber department') // Select specific student fields
            .populate('course', 'courseName courseId department') // Select specific course fields (updated field names)
            .lean(); // Use .lean() for faster query execution if you don't need Mongoose document methods

        if (!enrollments || enrollments.length === 0) {
            return res.status(404).json({ message: 'No students found enrolled in this course for the specified criteria.' });
        }

        // Extract student details from enrollments and include their scores
        const studentsEnrolled = enrollments.map(enrollment => ({
            studentId: enrollment.student._id,
            name: enrollment.student.name,
            email: enrollment.student.email,
            phoneNumber: enrollment.student.phoneNumber,
            registrationNumber: enrollment.student.registrationNumber,
            department: enrollment.student.department,
            courseTitle: enrollment.course.title,
            courseCode: enrollment.course.courseCode,
            enrollmentId: enrollment._id, // Include enrollment ID for reference
            academicYear: enrollment.academicYear,
            semester: enrollment.semester,
            caScore: enrollment.caScore,
            examScore: enrollment.examScore,
            finalGrade: enrollment.finalGrade,
            status: enrollment.status
        }));

        res.status(200).json({
            message: `Students enrolled in ${courseExists.courseName} (${courseExists.courseCode})`,
            totalStudents: studentsEnrolled.length,
            students: studentsEnrolled
        });

    } catch (error) {
        console.error('Error fetching enrolled students:', error);
        res.status(500).json({ message: 'Server error while fetching enrolled students.' });
    }
});


// GET /api/student/:studentId/results
// This route allows a student (or an authorized user) to retrieve all their course results
// for a particular academic year and semester.
//
// Path parameter: studentId (MongoDB _id of the student)
// Query parameters (optional): academicYear, semester
//
// Example: GET /api/student/654321098765432109876543/results?academicYear=2025-2026&semester=Fall
router.get('/api/student/:studentId/results', async (req, res) => {
    const { studentId } = req.params;
    const { academicYear, semester } = req.query; // Get academicYear and semester from query parameters

    try {
        // 1. Validate if the Student exists
        const student = await Student.findById(studentId).lean();
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Build the query object for enrollments
        let query = {
            student: studentId
        };

        if (academicYear) {
            query.academicYear = academicYear;
        }
        if (semester) {
            query.semester = semester;
        }

        // 2. Find all enrollments matching the criteria for this student
        // Populate course details to get courseName, courseId, etc.
        const enrollments = await Enrollment.find(query)
            .populate('course', 'courseName courseId department credits description') // Select specific course fields
            .lean(); // Use .lean() for faster query execution

        if (!enrollments || enrollments.length === 0) {
            let message = `No results found for student ${student.name}.`;
            if (academicYear && semester) {
                message = `No results found for student ${student.name} in ${semester} ${academicYear}.`;
            } else if (academicYear) {
                message = `No results found for student ${student.name} in academic year ${academicYear}.`;
            } else if (semester) {
                message = `No results found for student ${student.name} in ${semester} semester.`;
            }
            return res.status(404).json({ message: message });
        }

        // Format the results to be easily consumable by the frontend
        const studentResults = enrollments.map(enrollment => ({
            enrollmentId: enrollment._id,
            course: {
                _id: enrollment.course._id,
                courseId: enrollment.course.courseId, // Course code
                courseName: enrollment.course.courseName, // Course title
                department: enrollment.course.department,
                credits: enrollment.course.credits,
                description: enrollment.course.description
            },
            academicYear: enrollment.academicYear,
            semester: enrollment.semester,
            caScore: enrollment.caScore,
            examScore: enrollment.examScore,
            finalGrade: enrollment.finalGrade,
            status: enrollment.status // e.g., 'Enrolled', 'Completed'
        }));

        res.status(200).json({
            message: `Results for student ${student.name} retrieved successfully.`,
            studentId: student._id,
            studentName: student.name,
            totalCourses: studentResults.length,
            results: studentResults
        });

    } catch (error) {
        console.error('Error fetching student results:', error);
        res.status(500).json({ message: 'Server error while fetching student results.' });
    }
});



module.exports = router;
