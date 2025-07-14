// routes/gradeRoutes.js

const express = require('express');
const router = express.Router();
const Enrollment = require('../Models/Enrollments.js'); // Make sure this path is correct
const Lecturer = require('../Models/Lecturers.js'); // For potential future authorization checks
const Student = require('../Models/Students.js'); // To validate student IDs if needed
const Course = require('../Models/Courses.js'); // To validate course IDs

// This route allows a lecturer to update detailed scores (CA, Exam) and/or final grade
// for multiple students in a specific course for a given academic year and semester.
//
// Request Body Example:
// {
//     "academicYear": "2025-2026",
//     "semester": "Fall",
//     "updates": [
//         { "studentId": "student_id_1", "caScore": 85, "examScore": 90, "finalGrade": "A" },
//         { "studentId": "student_id_2", "caScore": 60, "examScore": 75, "finalGrade": "B" },
//         { "studentId": "student_id_3", "caScore": 92, "examScore": 88 } // Can update partial scores
//     ]
// }
//
// Note: In a real application, you would add authentication and authorization middleware
// to ensure only the lecturer assigned to this course can update grades.
router.put('/api/grades/course/:courseId', async (req, res) => {
    const { courseId } = req.params;
    const { academicYear, semester, updates } = req.body;

    // Basic validation for required fields
    if (!academicYear || !semester || !updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: 'Academic year, semester, and a non-empty array of grade updates are required.' });
    }

    try {
        // 1. Validate if the Course exists
        const courseExists = await Course.findById(courseId);
        if (!courseExists) {
            return res.status(404).json({ message: 'Course not found.' });
        }

        const results = []; // To store the results of each individual grade update attempt

        // Iterate through each grade update provided in the request body
        for (const update of updates) {
            // Removed testScore from destructuring
            const { studentId, caScore, examScore, finalGrade } = update;

            // Basic validation for each update object: studentId is always required, at least one score field must be present
            // Removed testScore from validation check
            if (!studentId || (caScore === undefined && examScore === undefined && finalGrade === undefined)) {
                results.push({ studentId, status: 'failed', message: 'Missing studentId or any score/finalGrade for an update entry.' });
                continue; // Skip to the next update
            }

            try {
                // 2. Validate if the Student exists (optional but good practice)
                const studentExists = await Student.findById(studentId);
                if (!studentExists) {
                    results.push({ studentId, status: 'failed', message: 'Student not found for this update.' });
                    continue;
                }

                // 3. Find the specific enrollment record
                // We need studentId, courseId, academicYear, and semester to uniquely identify the enrollment
                const enrollment = await Enrollment.findOne({
                    student: studentId,
                    course: courseId,
                    academicYear: academicYear,
                    semester: semester
                });

                if (!enrollment) {
                    results.push({ studentId, status: 'failed', message: 'Enrollment not found for this student in the specified course, year, and semester.' });
                    continue; // Skip to the next update
                }

                // 4. Update the score fields if provided
                if (caScore !== undefined) {
                    enrollment.caScore = caScore;
                }
                // Removed testScore update block
                if (examScore !== undefined) {
                    enrollment.examScore = examScore;
                }
                if (finalGrade !== undefined) {
                    enrollment.finalGrade = finalGrade;
                }

                await enrollment.save(); // Save the updated enrollment record

                // Removed testScore from updatedScores object
                results.push({ studentId, status: 'success', updatedScores: { caScore, examScore, finalGrade }, enrollmentId: enrollment._id });

            } catch (innerError) {
                console.error(`Error updating grade for student ${studentId} in course ${courseId}:`, innerError);
                // Handle specific Mongoose validation errors for individual updates (e.g., score out of range)
                if (innerError.name === 'ValidationError') {
                    const messages = Object.values(innerError.errors).map(val => val.message);
                    results.push({ studentId, status: 'failed', message: `Validation error: ${messages.join(', ')}` });
                } else {
                    results.push({ studentId, status: 'failed', message: 'An unexpected error occurred during score update.' });
                }
            }
        }

        // Respond with a summary of all grade update attempts
        res.status(200).json({
            message: 'Score update process completed. See results for individual updates.',
            results: results
        });

    } catch (error) {
        console.error('Error during overall lecturer score update:', error);
        // Handle general server errors
        res.status(500).json({ message: 'Server error during overall score update process.' });
    }
});

module.exports = router;
