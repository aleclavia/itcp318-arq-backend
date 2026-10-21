const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, 'config', '.env') });   // load env BEFORE anything reads it

const app = require('./app');
const connectDatabase = require('./config/database');
require('./config/cloudinary');

['DB_URI', 'JWT_SECRET', 'CLOUDINARY_CLOUD_NAME'].forEach(k => {
    if (!process.env[k]) console.warn(`WARNING: ${k} is not set in backend/config/.env`);
});

connectDatabase();

app.listen(process.env.PORT || 4001, () => {
    console.log(`server started on port: ${process.env.PORT || 4001} in ${process.env.NODE_ENV} mode`);
});
