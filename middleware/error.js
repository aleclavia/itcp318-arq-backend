// Central error handler. Every response has the shape { success:false, message }
module.exports = (err, req, res, next) => {
    let status = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    if (err.name === 'ValidationError') {
        status = 400;
        message = Object.values(err.errors).map(e => e.message).join(', ');
    } else if (err.name === 'CastError') {
        status = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    } else if (err.code === 11000) {
        status = 400;
        message = `${Object.keys(err.keyValue || {})[0] || 'Value'} is already registered`;
    } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        status = 401;
        message = 'Session is invalid or expired. Please login again';
    } else if (err.name === 'MulterError') {
        status = 400;
    }

    if (status === 500) console.error(err);
    res.status(status).json({ success: false, message });
};
