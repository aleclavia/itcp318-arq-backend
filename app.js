const express = require('express');
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const products = require('./routes/product');
const auth = require('./routes/auth');
const order = require('./routes/order');
const errorMiddleware = require('./middleware/error');

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/api/v1/health', (req, res) => res.json({ success: true }));
app.use('/api/v1', products);
app.use('/api/v1', auth);
app.use('/api/v1', order);

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorMiddleware);

module.exports = app;
