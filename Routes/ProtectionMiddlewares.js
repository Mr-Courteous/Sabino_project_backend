const jwt = require('jsonwebtoken');

const AllProtection = (req, res, next) => {
    // 1. Check for Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ message: 'Not authorized, no token or invalid format' });
    }

    // 2. Extract token
    const token = authHeader.split(' ')[1];

    try {
        // 3. Verify token
        // jwt.verify automatically checks for expiration and throws TokenExpiredError
        // The JWT payload for lecturers is { id: lecturer._id, role: 'lecturer' }
        // The JWT payload for students (if any) would be { id: student._id, role: 'student' }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach decoded payload (user ID and role) to the request
        // Now req.user will be an object like { id: 'someUserId', role: 'student' } or { id: 'someLecturerId', role: 'lecturer' }
        req.user = { id: decoded.id, role: decoded.role };

        // Proceed to the next middleware or route handler
        next();
    } catch (error) {
        console.error('JWT Verification Error:', error);

        // 4. Handle specific JWT errors
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please log in again.' });
        } else if (error.name === 'JsonWebTokenError') {
            // This catches other JWT errors like invalid signature, malformed token, etc.
            return res.status(401).json({ message: 'Not authorized, invalid token.' });
        } else {
            // Catch any other unexpected errors during token processing
            return res.status(500).json({ message: 'Internal server error during authentication.' });
        }
    }
};


module.exports = AllProtection;