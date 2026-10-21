const mongoose = require('mongoose');

const connectDatabase = async () => {
    try {
        const con = await mongoose.connect(process.env.DB_URI);
        console.log(`MongoDB Database connected with HOST: ${con.connection.host}`);
    } catch (err) {
        console.error(`MongoDB connection failed: ${err.message}`);
        process.exit(1);
    }
};

module.exports = connectDatabase;
