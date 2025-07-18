const express = require('express');
const router = express.Router();
const bcryptjs = require('bcryptjs'); // For password hashing
const nodemailer = require('nodemailer'); // For sending emails (though not used in this snippet)
const Student = require("../Models/Students.js") // Assuming this path is correct
const Lecturer = require("../Models/Lecturers.js"); // Make sure this path is correct
const Course = require('../Models/Courses.js'); // Make sure this path is correct
const Enrollment = require('../Models/Enrollments.js'); // Make sure this path is correct



const SCHOOL_NAME = "ABC"; // Example school name

router.post('/api/register/student', async (req, res) => {
    const { name, department, phoneNumber, email, address, password } = req.body;

    // Basic validation
    if (!name || !department || !phoneNumber || !email || !address || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        // Check if a student with the given email or phone number already exists
        const existingStudent = await Student.findOne({ $or: [{ email }, { phoneNumber }] });
        if (existingStudent) {
            // Improved error message for clarity
            if (existingStudent.email === email) {
                return res.status(409).json({ message: 'A student with this email already exists.' });
            }
            if (existingStudent.phoneNumber === phoneNumber) {
                return res.status(409).json({ message: 'A student with this phone number already exists.' });
            }
            return res.status(409).json({ message: 'A student with this email or phone number already exists.' });
        }

        // --- Serial Numbering Logic ---
        const departmentPrefix = `${SCHOOL_NAME}/${department}/`;

        // Find all students in the specified department whose registrationNumber starts with the prefix
        const studentsInDepartment = await Student.find({
            registrationNumber: { $regex: `^${departmentPrefix}` }
        }).select('registrationNumber'); // Only fetch the registrationNumber field to optimize

        let maxSerialNumber = 0;

        if (studentsInDepartment && studentsInDepartment.length > 0) {
            // Iterate through found students to find the highest serial number
            for (const student of studentsInDepartment) {
                const lastRegNum = student.registrationNumber;
                const parts = lastRegNum.split('/');
                const currentSerial = parseInt(parts[parts.length - 1], 10);

                if (!isNaN(currentSerial) && currentSerial > maxSerialNumber) {
                    maxSerialNumber = currentSerial;
                }
            }
        }

        const nextSerialNumber = maxSerialNumber + 1;

        // Format the serial number (e.g., 1 -> "001", 10 -> "010", 100 -> "100")
        const formattedSerialNumber = String(nextSerialNumber).padStart(3, '0');

        // Construct the full registration number
        const registrationNumber = `${SCHOOL_NAME}/${department}/${formattedSerialNumber}`;

        // Create a new student instance
        const newStudent = new Student({
            name,
            department,
            phoneNumber,
            email,
            address,
            password, // Password will be hashed by the pre-save hook
            registrationNumber
        });

        // Save the new student to the database
        await newStudent.save();

        // Respond with success (excluding the password for security)
        const StudentResponse = newStudent.toObject();
        delete StudentResponse.password;
        delete StudentResponse.__v;

        res.status(201).json({
            message: 'Student registered successfully!',
            Student: StudentResponse
        });

    } catch (error) {
        console.error('Error during student registration:', error);
        // Handle specific Mongoose validation or duplicate errors
        if (error.code === 11000) { // MongoDB duplicate key error
            return res.status(409).json({ message: 'A student with this email or phone number already exists.' });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

router.get('/today', (req, res) => {
    res.send('Hey, Express server is up and running for this particular route!');
});


//ADDING LECTURER TO THE DATABASE


router.post('/api/register/lecturer', async (req, res) => {
    // Destructure all required fields from the request body, including new lecturer-specific fields
    const {
        name,
        department,
        phoneNumber,
        email,
        address,
        password,
        position,
        qualifications,
        coursesTaught,
        dateOfEmployment,
        officeLocation,
        researchInterests
    } = req.body;

    // Basic validation for required fields
    if (!name || !department || !phoneNumber || !email || !address || !password ||
        !position || !dateOfEmployment) { // qualifications, coursesTaught, officeLocation, researchInterests can be optional
        return res.status(400).json({ message: 'Missing required fields for lecturer registration.' });
    }

    try {
        // Check if a lecturer with the given email or phone number already exists
        const existingLecturer = await Lecturer.findOne({ $or: [{ email }, { phoneNumber }] });
        if (existingLecturer) {
            if (existingLecturer.email === email) {
                return res.status(409).json({ message: 'A lecturer with this email already exists.' });
            }
            if (existingLecturer.phoneNumber === phoneNumber) {
                return res.status(409).json({ message: 'A lecturer with this phone number already exists.' });
            }
            return res.status(409).json({ message: 'A lecturer with this email or phone number already exists.' });
        }

        // --- Employee ID (Serial Numbering) Logic ---
        // The employeeId will follow a similar pattern: SCHOOL_NAME/DEPARTMENT/SERIAL_NUMBER
        const departmentPrefix = `${SCHOOL_NAME}/${department}/`;

        // Find all lecturers in the specified department whose employeeId starts with the prefix
        const lecturersInDepartment = await Lecturer.find({
            employeeId: { $regex: `^${departmentPrefix}` }
        }).select('employeeId'); // Only fetch the employeeId field to optimize

        let maxSerialNumber = 0;

        if (lecturersInDepartment && lecturersInDepartment.length > 0) {
            // Iterate through found lecturers to find the highest serial number
            for (const lecturer of lecturersInDepartment) {
                const lastEmployeeId = lecturer.employeeId;
                const parts = lastEmployeeId.split('/');
                const currentSerial = parseInt(parts[parts.length - 1], 10);

                if (!isNaN(currentSerial) && currentSerial > maxSerialNumber) {
                    maxSerialNumber = currentSerial;
                }
            }
        }

        const nextSerialNumber = maxSerialNumber + 1;

        // Format the serial number (e.g., 1 -> "001", 10 -> "010", 100 -> "100")
        const formattedSerialNumber = String(nextSerialNumber).padStart(3, '0');

        // Construct the full employee ID
        const employeeId = `INSTRUCTOR/${department}/${formattedSerialNumber}`;

        // Create a new lecturer instance
        const newLecturer = new Lecturer({
            name,
            department,
            phoneNumber,
            email,
            address,
            password, // Password will be hashed by the pre-save hook in the model
            employeeId, // Assign the generated employee ID
            position,
            qualifications: qualifications || [], // Ensure it's an array, even if empty
            coursesTaught: coursesTaught || [], // Ensure it's an array, even if empty
            dateOfEmployment: new Date(dateOfEmployment), // Convert string to Date object
            officeLocation,
            researchInterests: researchInterests || [] // Ensure it's an array, even if empty
        });

        // Save the new lecturer to the database
        await newLecturer.save();

        // Respond with success (excluding the password for security)
        const lecturerResponse = newLecturer.toObject();
        delete lecturerResponse.password;
        delete lecturerResponse.__v;

        res.status(201).json({
            message: 'Lecturer registered successfully!',
            lecturer: lecturerResponse
        });

    } catch (error) {
        console.error('Error during lecturer registration:', error);
        // Handle specific Mongoose validation or duplicate errors
        if (error.code === 11000) { // MongoDB duplicate key error
            // Check if the duplicate is for email, phone, or employeeId
            if (error.message.includes('email')) {
                return res.status(409).json({ message: 'A lecturer with this email already exists.' });
            }
            if (error.message.includes('phoneNumber')) {
                return res.status(409).json({ message: 'A lecturer with this phone number already exists.' });
            }
            if (error.message.includes('employeeId')) {
                return res.status(409).json({ message: 'A lecturer with this employee ID already exists. Please try again.' });
            }
            return res.status(409).json({ message: 'A lecturer with duplicate unique fields already exists.' });
        }
        // Handle Mongoose validation errors (e.g., required fields not provided)
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// You would typically export this router and use it in your main app.js or server.js
// module.exports = router;




//ADDING COURSES TO THE DATABASE


router.post('/api/courses', async (req, res) => {
    const {
        courseCode,
        title,
        department,
        credits,
        description,
        lecturers, // Array of Lecturer ObjectIds
        prerequisites, // Array of Course ObjectIds
        semester,
        capacity
    } = req.body;

    // Basic validation for required fields
    if (!courseCode || !title || !department || !credits || !semester) {
        return res.status(400).json({ message: 'Course code, title, department, credits, and semester are required.' });
    }

    try {
        // Check if a course with the given courseCode already exists
        const existingCourse = await Course.findOne({ courseCode: courseCode.toUpperCase() });
        if (existingCourse) {
            return res.status(409).json({ message: `Course with code ${courseCode} already exists.` });
        }

        // Validate lecturer IDs if provided
        if (lecturers && lecturers.length > 0) {
            const foundLecturers = await Lecturer.find({ _id: { $in: lecturers } });
            if (foundLecturers.length !== lecturers.length) {
                return res.status(400).json({ message: 'One or more provided lecturer IDs are invalid.' });
            }
        }

        // Validate prerequisite course IDs if provided
        if (prerequisites && prerequisites.length > 0) {
            const foundPrerequisites = await Course.find({ _id: { $in: prerequisites } });
            if (foundPrerequisites.length !== prerequisites.length) {
                return res.status(400).json({ message: 'One or more provided prerequisite course IDs are invalid.' });
            }
        }

        // Create a new course instance
        const newCourse = new Course({
            courseCode: courseCode.toUpperCase(), // Ensure course codes are uppercase
            title,
            department,
            credits,
            description,
            lecturers: lecturers || [],
            prerequisites: prerequisites || [],
            semester,
            capacity
        });

        // Save the new course to the database
        await newCourse.save();

        res.status(201).json({
            message: 'Course added successfully!',
            course: newCourse
        });

    } catch (error) {
        console.error('Error during course addition:', error);
        if (error.code === 11000) { // MongoDB duplicate key error
            return res.status(409).json({ message: `Course with code ${courseCode} already exists.` });
        }
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error during course addition.' });
    }
});






// COURSE REGISTRATION


router.post('/api/enrollments', async (req, res) => {
    // The request body can now contain an array of enrollment objects,
    // or a single studentId and an array of courseIds for a specific academicYear/semester.
    // Let's assume the latter for simplicity: { studentId: "...", academicYear: "...", semester: "...", courseIds: ["...", "..."] }
    const {
        studentId,
        academicYear,
        semester,
        courseIds // This will be an array of course IDs
    } = req.body;

    // Basic validation for required fields
    if (!studentId || !academicYear || !semester || !courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
        return res.status(400).json({ message: 'Student ID, Academic Year, Semester, and a non-empty array of Course IDs are required for enrollment.' });
    }

    try {
        // 1. Validate if Student exists
        const studentExists = await Student.findById(studentId);
        if (!studentExists) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const results = []; // To store the results of each individual enrollment attempt

        for (const courseId of courseIds) {
            try {
                // 2. Validate if Course exists
                const courseExists = await Course.findById(courseId);
                if (!courseExists) {
                    results.push({ courseId, status: 'failed', message: 'Course not found.' });
                    continue; // Move to the next course
                }

                // 3. Check for existing enrollment to prevent duplicates
                const existingEnrollment = await Enrollment.findOne({ student: studentId, course: courseId, academicYear, semester });
                if (existingEnrollment) {
                    results.push({ courseId, status: 'failed', message: 'Already enrolled in this course for the specified semester and academic year.' });
                    continue; // Move to the next course
                }

                // 4. (Optional) Implement capacity check for the course
                // For simplicity, this example doesn't include capacity management.
                // if (courseExists.capacity <= 0) {
                //     results.push({ courseId, status: 'failed', message: 'Course is full.' });
                //     continue;
                // }

                // 5. (Optional) Implement prerequisite check
                // For simplicity, this example doesn't include prerequisite checking.
                // if (courseExists.prerequisites && courseExists.prerequisites.length > 0) {
                //     // Logic to check if student has completed prerequisites
                //     results.push({ courseId, status: 'failed', message: 'Prerequisites not met.' });
                //     continue;
                // }

                // Create a new enrollment instance
                const newEnrollment = new Enrollment({
                    student: studentId,
                    course: courseId,
                    academicYear,
                    semester
                });

                // Save the new enrollment to the database
                await newEnrollment.save();
                results.push({ courseId, status: 'success', enrollmentId: newEnrollment._id });

            } catch (innerError) {
                console.error(`Error enrolling student ${studentId} in course ${courseId}:`, innerError);
                // Handle specific Mongoose validation or duplicate errors for individual enrollments
                if (innerError.code === 11000) {
                    results.push({ courseId, status: 'failed', message: 'Duplicate enrollment for this course, semester, and academic year.' });
                } else if (innerError.name === 'ValidationError') {
                    const messages = Object.values(innerError.errors).map(val => val.message);
                    results.push({ courseId, status: 'failed', message: `Validation error: ${messages.join(', ')}` });
                } else {
                    results.push({ courseId, status: 'failed', message: 'An unexpected error occurred during enrollment.' });
                }
            }
        }

        // Respond with a summary of all enrollment attempts
        res.status(200).json({
            message: 'Course registration process completed. See results for individual enrollments.',
            results: results
        });

    } catch (error) {
        console.error('Error during overall student course registration:', error);
        res.status(500).json({ message: 'Server error during overall course registration process.' });
    }
});




// GET /api/courses/search
// This route allows searching for courses.
// Optional query parameters:
// - courseName: Search by course title (partial match, case-insensitive)
// - courseCode: Search by course code (partial match, case-insensitive)
// - department: Filter by department (exact match, case-insensitive)
// - semester: Filter by semester (exact match, case-insensitive)
// Example: GET /api/courses/search?department=Computer%20Science&courseName=Introduction
router.get('/api/courses/search', async (req, res) => {
    const { courseName, courseCode, department, semester } = req.query;

    try {
        let query = {};

        // Build query object based on provided parameters
        if (courseName) {
            query.courseName = { $regex: new RegExp(courseName, 'i') }; // Case-insensitive partial match
        }
        if (courseCode) {
            query.courseCode = { $regex: new RegExp(courseCode, 'i') }; // Case-insensitive partial match
        }
        if (department) {
            query.department = { $regex: new RegExp(department, 'i') }; // Case-insensitive exact match
        }
        if (semester) {
            query.semester = { $regex: new RegExp(semester, 'i') }; // Case-insensitive exact match
        }

        // Find courses matching the constructed query
        const courses = await Course.find(query).lean(); // Use .lean() for faster retrieval

        if (!courses || courses.length === 0) {
            return res.status(404).json({ message: 'No courses found matching your criteria.' });
        }

        res.status(200).json({
            message: 'Courses retrieved successfully.',
            totalCourses: courses.length,
            courses: courses
        });

    } catch (error) {
        console.error('Error searching for courses:', error);
        res.status(500).json({ message: 'Server error while searching for courses.' });
    }
});



module.exports = router;
