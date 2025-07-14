const mongoose = require('mongoose');

// Replace 'your_mongodb_atlas_connection_string' with the actual connection string
// const mongoURI = 'mongodb+srv://Courteous:mongokey@cluster0.qiuqa3p.mongodb.net/NewData?retryWrites=true&w=majorityyour_mongodb_atlas_connection_string';
const connect = 'mongodb+srv://Courteous:mongokey@cluster0.qiuqa3p.mongodb.net/SabinoDb?retryWrites=true&w=majority';




const connectDB = async () => {
    try {
        await mongoose.connect(connect, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to Sabino Database');
    } catch (error) {
        console.error('Error connecting to MongoDB Atlas:', error.message);
        process.exit(1); // Exit the process if the connection fails
    }
};


// const connectDB2 = async () => {
//     try {
//         await mongoose.connect(connect2, { useNewUrlParser: true, useUnifiedTopology: true });
//         console.log('Connected to MongoDB Atlas');
//     } catch (error) {
//         console.error('Error connecting to MongoDB Atlas:', error.message);
//         process.exit(1); // Exit the process if the connection fails
//     }
// };





module.exports = connectDB;   