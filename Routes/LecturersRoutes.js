const express = require('express');
const router = express.Router();
const Enrollment = require('../Models/Enrollments.js'); // Make sure this path is correct
const Student = require('../Models/Students.js'); // To validate student IDs if needed
const Course = require('../Models/Courses.js'); // To validate course IDs
const Lecturer = require('../Models/Lecturers.js'); // <--- NEW: Import Lecturer model
const AllProtection = require('./ProtectionMiddlewares.js'); // Ensure this path is correct for your middleware
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

// --- NEW ROUTE: Lecturer Dashboard ---
// GET /api/lecturer/dashboard/:lecturerId
// This route retrieves a lecturer's profile.
router.get('/api/lecturer/dashboard/:lecturerId', AllProtection, async (req, res) => { // <--- Using ProtectRoute
    const { lecturerId } = req.params;

    // Security check: Ensure the authenticated user (from token) matches the requested lecturerId
    // and that the user is actually a lecturer.
    if (req.user.id !== lecturerId || req.user.role !== 'lecturer') { // <--- Corrected check for req.user object
        return res.status(403).json({ message: 'Forbidden: You can only view your own dashboard.' });
    }

    try {
        // Find the lecturer's profile
        const lecturer = await Lecturer.findById(lecturerId).lean(); // Use .lean() for faster retrieval
        if (!lecturer) {
            return res.status(404).json({ message: 'Lecturer not found.' });
        }

        // Prepare the lecturer response object, explicitly selecting fields
        const lecturerProfile = {
            _id: lecturer._id,
            name: lecturer.name,
            employeeId: lecturer.employeeId,
            department: lecturer.department,
            email: lecturer.email,
            phoneNumber: lecturer.phoneNumber,
            address: lecturer.address,
            position: lecturer.position,
            qualifications: lecturer.qualifications,
            coursesTaught: lecturer.coursesTaught,
            dateOfEmployment: lecturer.dateOfEmployment,
            officeLocation: lecturer.officeLocation,
            researchInterests: lecturer.researchInterests
            // Password and __v are implicitly excluded by selecting specific fields
        };


        // --- Fetch courses taught by this lecturer ---
        // Assuming 'coursesTaught' on the Lecturer model stores course IDs
        // Filter out any non-ObjectId values from coursesTaught before querying
        const validCourseIds = lecturer.coursesTaught.filter(id => {
            // A basic check for a valid ObjectId string (24 hex characters)
            return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
        });

        const myCourses = await Course.find({
            _id: { $in: validCourseIds } // Use the filtered array
        }).lean();

        // For the frontend display, we need 'id', 'code', 'title', 'credits', 'level', 'students'
        const formattedCourses = myCourses.map(course => ({
            id: course._id.toString(),
            code: course.courseId, // Assuming courseId is the code (e.g., "CS101")
            title: course.courseName, // Assuming courseName is the title (e.g., "Introduction to Programming")
            credits: course.credits,
            level: course.department, // Using department as level for display as per frontend interface
            students: 0 // Placeholder: You would need to query Enrollments to get actual student count per course
        }));

        // --- Fetch recent notifications related to this lecturer's courses or department ---
        // This part depends heavily on how your Notification model is structured and
        // how notifications are associated with lecturers/courses.
        // For simplicity, let's return some mock or a very basic query for now.
        // A real implementation would query a Notification model.
        const recentNotifications = [
            { id: 'notif1', title: 'Assignment 1 Due', message: 'Reminder: Assignment 1 for CS101 is due tomorrow.', date: '2025-07-17' },
            { id: 'notif2', title: 'Class Cancelled', message: 'CS201 class on Friday is cancelled.', date: '2025-07-16' },
        ];
        // In a real scenario, you'd query your Notification model:
        // const notifications = await Notification.find({ recipientLecturerId: lecturerId }).sort({ createdAt: -1 }).limit(3).lean();
        // And then format them for the frontend.


        res.status(200).json({
            message: `Dashboard data for lecturer: ${lecturer.name}`,
            lecturerProfile: lecturerProfile,
            myCourses: formattedCourses,
            // recentNotifications: recentNotifications // Sending mock notifications for now
        });

    } catch (error) {
        console.error('Error fetching lecturer dashboard data:', error);
        res.status(500).json({ message: 'Server error while fetching lecturer dashboard data.' });
    }
});


// --- NEW ROUTE: Get all courses taught by a specific lecturer ---
// GET /api/lecturer/:lecturerId/courses-taught
router.get('/api/lecturer/:lecturerId/courses-taught', AllProtection, async (req, res) => {
    const { lecturerId } = req.params;

    // Authorization check: Only the specific lecturer or an admin can view these courses
    if (req.user.id !== lecturerId || req.user.role !== 'lecturer') {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to view these courses.' });
    }

    try {
        const lecturer = await Lecturer.findById(lecturerId).lean();
        if (!lecturer) {
            return res.status(404).json({ message: 'Lecturer not found.' });
        }

        // Filter out any non-ObjectId values from coursesTaught before querying
        const validCourseIds = lecturer.coursesTaught.filter(id => {
            return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
        });

        const courses = await Course.find({
            _id: { $in: validCourseIds }
        }).lean();

        // Format courses similar to how they are formatted for the dashboard
        const formattedCourses = courses.map(course => ({
            id: course._id.toString(),
            code: course.courseId,
            title: course.courseName,
            credits: course.credits,
            department: course.department, // Keep department as is
            description: course.description,
            // You might want to fetch actual student counts here if needed,
            // but for a simple list, it might not be necessary.
            students: 0 // Placeholder for student count
        }));

        res.status(200).json({
            message: `Courses taught by ${lecturer.name} retrieved successfully.`,
            totalCourses: formattedCourses.length,
            courses: formattedCourses
        });

    } catch (error) {
        console.error('Error fetching lecturer taught courses:', error);
        res.status(500).json({ message: 'Server error while fetching lecturer taught courses.' });
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
router.get('/api/students/search', AllProtection, async (req, res) => {
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




// GET ROUTE: Get all students enrolled in a particular course
// This route allows a lecturer to retrieve a list of students enrolled in a specific course.
// It now expects the 'courseId' in the URL path to be the human-readable course code (e.g., "BIO 203").
// Optional query parameters: academicYear, semester
// Example: GET /api/grades/course/BIO 203/students?academicYear=2025-2026&semester=Fall
router.get('/api/grades/course/:courseId/students', AllProtection, async (req, res) => {
    const { courseId } = req.params; // This is now the human-readable course code
    const { academicYear, semester } = req.query;

    try {
        // 1. Find the Course document using the human-readable courseId
        // Normalize the input courseId for regex construction:
        // Escape special regex characters and replace spaces with \s*
        const escapedCourseId = courseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special characters
        // Replace one or more spaces with \s* to match any whitespace variations in the DB
        const regexPattern = escapedCourseId.replace(/\s+/g, '\\s*');

        // Use a regex to find the course, making it case-insensitive and matching the full string
        const courseExists = await Course.findOne({
            courseId: { $regex: new RegExp(`^${regexPattern}$`, 'i') } // Case-insensitive regex match, exact start and end
        });

        if (!courseExists) {
            return res.status(404).json({ message: `Course with code '${courseId}' not found.` });
        }

        // Use the MongoDB _id of the found course for the enrollment query
        const mongoCourseId = courseExists._id;

        // Build the query object for enrollments
        let query = {
            course: mongoCourseId // Use the MongoDB _id here
        };

        if (academicYear) {
            query.academicYear = academicYear;
        }
        if (semester) {
            query.semester = semester;
        }

        // 2. Find all enrollments matching the criteria
        const enrollments = await Enrollment.find(query)
            .populate('student', 'name email phoneNumber registrationNumber department')
            .populate('course', 'courseName courseId department')
            .lean();

        if (!enrollments || enrollments.length === 0) {
            return res.status(404).json({ message: `No students found enrolled in course '${courseExists.courseName}' (${courseExists.courseId}) for the specified criteria.` });
        }

        // Extract student details from enrollments and include their scores
        const studentsEnrolled = enrollments.map(enrollment => ({
            studentId: enrollment.student._id,
            name: enrollment.student.name,
            email: enrollment.student.email,
            phoneNumber: enrollment.student.phoneNumber,
            registrationNumber: enrollment.student.registrationNumber,
            department: enrollment.student.department,
            courseTitle: enrollment.course.courseName,
            courseCode: enrollment.course.courseId,
            enrollmentId: enrollment._id,
            academicYear: enrollment.academicYear,
            semester: enrollment.semester,
            caScore: enrollment.caScore,
            examScore: enrollment.examScore,
            finalGrade: enrollment.finalGrade,
            status: enrollment.status
        }));

        res.status(200).json({
            message: `Students enrolled in ${courseExists.courseName} (${courseExists.courseId})`,
            totalStudents: studentsEnrolled.length,
            students: studentsEnrolled
        });

    } catch (error) {
        console.error('Error fetching enrolled students:', error);
        res.status(500).json({ message: 'Server error while fetching enrolled students.' });
    }
});


// --- NEW ROUTE: Export Course Grades to CSV ---
// GET /api/grades/course/:courseId/students/export
// This route allows authorized users (lecturers, admins) to download an Excel-compatible CSV
// of student names and their scores for a particular course.
// Optional query parameters: academicYear, semester
// Example: GET /api/grades/course/BIO 203/students/export?academicYear=2025-2026&semester=Fall
router.get('/api/grades/course/:courseId/students/export', AllProtection, async (req, res) => {
    const { courseId } = req.params; // This is now the human-readable course code
    const { academicYear, semester } = req.query;

    try {
        // 1. Find the Course document using the human-readable courseId
        const courseExists = await Course.findOne({ courseId: courseId });
        if (!courseExists) {
            return res.status(404).json({ message: `Course with code '${courseId}' not found.` });
        }

        // Use the MongoDB _id of the found course for the enrollment query
        const mongoCourseId = courseExists._id;

        // Build the query object for enrollments
        let query = {
            course: mongoCourseId // Use the MongoDB _id here
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
            return res.status(404).json({ message: `No students found enrolled in course '${courseId}' for the specified criteria to export.` });
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
router.post('/api/grades/course/:courseId/upload-grades', upload.single('gradesFile'), AllProtection, async (req, res) => {
    const { courseId } = req.params; // This is now the human-readable course code

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
        // Find the Course document using the human-readable courseId
        const courseExists = await Course.findOne({ courseId: courseId });
        if (!courseExists) {
            return res.status(404).json({ message: `Course with code '${courseId}' not found.` });
        }

        // Use the MongoDB _id of the found course for the enrollment query
        const mongoCourseId = courseExists._id;

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
                            { _id: enrollmentId, course: mongoCourseId }, // Use mongoCourseId here
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