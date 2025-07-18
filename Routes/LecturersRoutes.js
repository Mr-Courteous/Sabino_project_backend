const express = require('express');
const router = express.Router();
const Enrollment = require('../Models/Enrollments.js'); // Make sure this path is correct
const Student = require('../Models/Students.js'); // To validate student IDs if needed
const Course = require('../Models/Courses.js'); // To validate course IDs
const StudentsTokenCheck = require('./ProtectionMiddlewares.js'); // Ensure this path is correct for your middleware
const { stringify } = require('csv-stringify'); // <--- Add this line!
const multer = require('multer'); // <--- NEW: Import multer
const csv = require('csv-parser'); // <--- NEW: Import csv-parser
const stream = require('stream'); // <--- NEW: Node.js built-in stream module


const jwt = require('jsonwebtoken'); // Keep this if you use jwt directly elsewhere, otherwise it's implicitly used by StudentsTokenCheck

// Configure Multer for file uploads
// We'll store the file in memory for parsing, which is suitable for small-medium CSVs.
// For very large files, consider storing to disk temporarily.
const upload = multer({
    storage: multer.memoryStorage(), // Store file in memory as a Buffer
    fileFilter: (req, file, cb) => {
        // Accept only CSV files
        if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') { // Common MIME types for CSV
            cb(null, true);
        } else {
            cb(new Error('Invalid file type, only CSV is allowed!'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB file size limit
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
            courseTitle: enrollment.course.courseName, // Changed from .title
            courseCode: enrollment.course.courseId,    // Changed from .courseCode
            enrollmentId: enrollment._id, // Include enrollment ID for reference
            academicYear: enrollment.academicYear,
            semester: enrollment.semester,
            caScore: enrollment.caScore,
            examScore: enrollment.examScore,
            finalGrade: enrollment.finalGrade,
            status: enrollment.status
        }));

        res.status(200).json({
            message: `Students enrolled in ${courseExists.courseName} (${courseExists.courseId})`, // Changed from .courseCode
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


// --- NEW ROUTE: Get all students in a particular department ---
// GET /api/students/department/:departmentName
// This route retrieves a list of all students belonging to a specified department.
// Access: Protected (e.g., by admin or authorized lecturer)
router.get('/api/students/department/:departmentName', async (req, res) => {
    const { departmentName } = req.params;

    // Optional: Add role-based access control here if you have roles (e.g., only 'admin' or 'lecturer' can access)
    // if (req.user.role !== 'admin' && req.user.role !== 'lecturer') {
    //     return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
    // }

    try {
        // Find students by department name (case-insensitive search is often good here)
        // Using a regex for case-insensitive search
        const students = await Student.find({
            department: { $regex: new RegExp(departmentName, 'i') }
        })
            .select('name email phoneNumber registrationNumber department') // Select relevant fields
            .lean(); // Use .lean() for faster retrieval

        if (!students || students.length === 0) {
            return res.status(404).json({ message: `No students found in the ${departmentName} department.` });
        }

        res.status(200).json({
            message: `Students in ${departmentName} department retrieved successfully.`,
            totalStudents: students.length,
            students: students
        });

    } catch (error) {
        console.error(`Error fetching students for department ${departmentName}:`, error);
        res.status(500).json({ message: 'Server error while fetching students by department.' });
    }
});


// GET /api/students/search
// This route allows authorized users (lecturers, admins) to search for students
// by name or registration number.
// Query parameters: name (partial match), registrationNumber (exact or partial match)
// Example: GET /api/students/search?name=john&registrationNumber=REG123
router.get('/api/students/search', StudentsTokenCheck, async (req, res) => {
    const { name, registrationNumber } = req.query;

    // Optional: Implement role-based access control here.
    // Assuming 'req.user.role' is available from StudentsTokenCheck middleware.
    // If you have different roles (e.g., 'student', 'lecturer', 'admin'),
    // you might only allow 'lecturer' or 'admin' to perform searches.
    // Example:
    // if (req.user.role !== 'lecturer' && req.user.role !== 'admin') {
    //     return res.status(403).json({ message: 'Forbidden: You do not have permission to search students.' });
    // }

    // Build the search query object
    let searchQuery = {};

    if (name) {
        // Case-insensitive partial match for name
        searchQuery.name = { $regex: new RegExp(name, 'i') };
    }

    if (registrationNumber) {
        // Case-insensitive partial match for registrationNumber
        searchQuery.registrationNumber = { $regex: new RegExp(registrationNumber, 'i') };
    }

    // If no search parameters are provided, return a bad request or all students (be careful with returning all)
    if (Object.keys(searchQuery).length === 0) {
        return res.status(400).json({ message: 'Please provide a search parameter (name or registrationNumber).' });
    }

    try {
        const students = await Student.find(searchQuery)
            .select('name email phoneNumber registrationNumber department') // Select relevant fields
            .lean(); // Use .lean() for faster retrieval

        if (!students || students.length === 0) {
            return res.status(404).json({ message: 'No students found matching your search criteria.' });
        }

        res.status(200).json({
            message: 'Students retrieved successfully.',
            totalStudents: students.length,
            students: students
        });

    } catch (error) {
        console.error('Error searching for students:', error);
        res.status(500).json({ message: 'Server error while searching for students.' });
    }
});



// --- NEW ROUTE: Export Course Grades to CSV ---
// GET /api/grades/course/:courseId/students/export
// This route allows authorized users (lecturers, admins) to download an Excel-compatible CSV
// of student names and their scores for a particular course.
// Optional query parameters: academicYear, semester
// Example: GET /api/grades/course/60d5ec49f8c7a3001c8a4d7c/students/export?academicYear=2025-2026&semester=Fall
router.get('/api/grades/course/:courseId/students/export', async (req, res) => {
    const { courseId } = req.params;
    const { academicYear, semester } = req.query;

    // Optional: Implement role-based access control here.
    // Only lecturers or admins should typically be able to download grade sheets.
    // Assuming 'req.user.role' is available from StudentsTokenCheck middleware.
    // if (req.user.role !== 'lecturer' && req.user.role !== 'admin') {
    //     return res.status(403).json({ message: 'Forbidden: You do not have permission to export grades.' });
    // }

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
        const enrollments = await Enrollment.find(query)
            .populate('student', 'name email registrationNumber') // Get student name, email, reg number
            .populate('course', 'courseName courseId') // Get course name and ID for filename
            .lean();

        if (!enrollments || enrollments.length === 0) {
            return res.status(404).json({ message: 'No students found enrolled in this course for the specified criteria to export.' });
        }

        // 3. Prepare data for CSV
        const records = [];
        // Add CSV Headers
        records.push([
            'Student Name',
            'Registration Number',
            'Email',
            'CA Score',
            'Exam Score',
            'Final Grade',
            'Academic Year',
            'Semester',
            'Enrollment ID', // Useful for matching records on upload
            'Course ID',
            'Course Name'
        ]);

        // Add data rows
        enrollments.forEach(enrollment => {
            records.push([
                enrollment.student ? enrollment.student.name : 'N/A',
                enrollment.student ? enrollment.student.registrationNumber : 'N/A',
                enrollment.student ? enrollment.student.email : 'N/A',
                enrollment.caScore !== undefined ? enrollment.caScore : '',
                enrollment.examScore !== undefined ? enrollment.examScore : '',
                enrollment.finalGrade || '',
                enrollment.academicYear,
                enrollment.semester,
                enrollment._id.toString(), // Convert ObjectId to string
                enrollment.course ? enrollment.course.courseId : 'N/A',
                enrollment.course ? enrollment.course.courseName : 'N/A'
            ]);
        });

        // 4. Generate CSV string
        stringify(records, (err, output) => {
            if (err) {
                console.error('Error generating CSV:', err);
                return res.status(500).json({ message: 'Failed to generate CSV file.' });
            }

            // 5. Set response headers for file download
            res.header('Content-Type', 'text/csv');
            const filename = `grades_${courseExists.courseId}_${academicYear || 'all'}_${semester || 'all'}.csv`;
            res.attachment(filename); // This sets Content-Disposition to attachment

            // 6. Send the CSV output
            res.send(output);
        });

    } catch (error) {
        console.error('Error exporting course grades:', error);
        res.status(500).json({ message: 'Server error while exporting course grades.' });
    }
});

// --- NEW ROUTE: Upload Grades from CSV ---
// POST /api/grades/course/:courseId/upload-grades
// This route allows authorized users (lecturers, admins) to upload a CSV file
// to update student scores for a particular course.
// It expects a file upload with the field name 'gradesFile'.
router.post('/api/grades/course/:courseId/upload-grades', upload.single('gradesFile'), StudentsTokenCheck, async (req, res) => {
    const { courseId } = req.params;

    // Optional: Implement role-based access control here.
    // Ensure only authorized roles (e.g., 'lecturer', 'admin') can upload grades.
    // if (req.user.role !== 'lecturer' && req.user.role !== 'admin') {
    //     return res.status(403).json({ message: 'Forbidden: You do not have permission to upload grades.' });
    // }

    // Check if a file was uploaded
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded. Please upload a CSV file.' });
    }

    // Check if the file is a CSV
    if (req.file.mimetype !== 'text/csv' && req.file.mimetype !== 'application/vnd.ms-excel') {
        return res.status(400).json({ message: 'Invalid file type. Only CSV files are allowed.' });
    }

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer); // Convert buffer to a readable stream

    const updatedRecords = [];
    const errors = [];
    let processedCount = 0;

    try {
        const courseExists = await Course.findById(courseId);
        if (!courseExists) {
            return res.status(404).json({ message: 'Course not found.' });
        }

        // Parse the CSV file
        bufferStream
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim(), // Trim whitespace from headers
                skipEmptyLines: true // Skip any empty rows
            }))
            .on('data', async (row) => {
                // Pause the stream to process data asynchronously
                bufferStream.pause();

                processedCount++;
                const enrollmentId = row['Enrollment ID'];
                const caScore = row['CA Score'] ? parseFloat(row['CA Score']) : undefined;
                const examScore = row['Exam Score'] ? parseFloat(row['Exam Score']) : undefined;
                const finalGrade = row['Final Grade'] ? row['Final Grade'].trim() : undefined;

                if (!enrollmentId) {
                    errors.push(`Row ${processedCount}: Missing 'Enrollment ID'. Skipping.`);
                    bufferStream.resume(); // Resume after error
                    return;
                }

                // Basic validation for scores
                if (caScore !== undefined && (isNaN(caScore) || caScore < 0 || caScore > 100)) {
                    errors.push(`Row ${processedCount} (Enrollment ID: ${enrollmentId}): Invalid CA Score. Must be a number between 0 and 100.`);
                    bufferStream.resume();
                    return;
                }
                if (examScore !== undefined && (isNaN(examScore) || examScore < 0 || examScore > 100)) {
                    errors.push(`Row ${processedCount} (Enrollment ID: ${enrollmentId}): Invalid Exam Score. Must be a number between 0 and 100.`);
                    bufferStream.resume();
                    return;
                }
                // Add more validation for finalGrade if needed (e.g., must be A, B, C, D, F)

                try {
                    const updateFields = {};
                    if (caScore !== undefined) updateFields.caScore = caScore;
                    if (examScore !== undefined) updateFields.examScore = examScore;
                    if (finalGrade !== undefined) updateFields.finalGrade = finalGrade;

                    if (Object.keys(updateFields).length > 0) {
                        const updatedEnrollment = await Enrollment.findOneAndUpdate(
                            { _id: enrollmentId, course: courseId }, // Ensure enrollment belongs to this course
                            { $set: updateFields },
                            { new: true } // Return the updated document
                        );

                        if (updatedEnrollment) {
                            updatedRecords.push({
                                enrollmentId: updatedEnrollment._id,
                                studentName: updatedEnrollment.student ? updatedEnrollment.student.name : 'N/A', // If student was populated
                                caScore: updatedEnrollment.caScore,
                                examScore: updatedEnrollment.examScore,
                                finalGrade: updatedEnrollment.finalGrade
                            });
                        } else {
                            errors.push(`Row ${processedCount} (Enrollment ID: ${enrollmentId}): Enrollment not found or does not belong to this course.`);
                        }
                    } else {
                        errors.push(`Row ${processedCount} (Enrollment ID: ${enrollmentId}): No valid score or grade fields provided for update.`);
                    }
                } catch (dbError) {
                    errors.push(`Row ${processedCount} (Enrollment ID: ${enrollmentId}): Database error - ${dbError.message}`);
                } finally {
                    bufferStream.resume(); // Always resume the stream
                }
            })
            .on('end', () => {
                // All data processed
                if (errors.length > 0) {
                    return res.status(200).json({
                        message: `Grade upload completed with ${updatedRecords.length} updates and ${errors.length} errors.`,
                        updatedCount: updatedRecords.length,
                        errorCount: errors.length,
                        errors: errors,
                        updatedRecords: updatedRecords // Optionally return successful updates too
                    });
                } else {
                    return res.status(200).json({
                        message: `Successfully updated ${updatedRecords.length} student grades.`,
                        updatedCount: updatedRecords.length,
                        updatedRecords: updatedRecords
                    });
                }
            })
            .on('error', (csvError) => {
                console.error('CSV Parsing Error:', csvError);
                return res.status(400).json({ message: `CSV parsing failed: ${csvError.message}` });
            });

    } catch (error) {
        console.error('Error during grade upload:', error);
        if (error.message === 'Invalid file type, only CSV is allowed!') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error during grade upload.' });
    }
});


module.exports = router;