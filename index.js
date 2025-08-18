require('dotenv').config();
const express = require("express");
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors'); // Import the cors middleware
require('dotenv').config();


const PORT = process.env.PORT || 3000;

// ROUTES
const RegistrationRoute = require('./Routes/Registration');
const ScoresUpdateRoute = require('./Routes/ScoresUpdate')
const GetRoutes = require('./Routes/StudentsGetRoutes')
const LoginRoutes = require ('./Routes/LoginRoutes')
const PaymentRoute = require ('./Routes/PaymentRoute')
const LecturersGetRoutes = require ('./Routes/LecturersRoutes')
 

const connectDB = require('./Dbconnection');

connectDB();


// Use CORS middleware to allow requests from any origin
// You can configure it further if you need to restrict origins, methods, or headers
app.use(cors());

app.use(bodyParser.json());
app.use(RegistrationRoute);
app.use(ScoresUpdateRoute);
app.use(GetRoutes);
app.use(LoginRoutes);
app.use(PaymentRoute);
app.use(LecturersGetRoutes);

app.get('/', (req, res) => {
    res.send('Hey, Express server is up and running right now until you stop it!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server.');
});
