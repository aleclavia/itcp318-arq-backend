const User = require('../models/user');
const jwt = require('jsonwebtoken');
const ErrorHandler = require('../utils/errorHandler');

exports.isAuthenticatedUser = async (req, res, next) => {
    let token = req.cookies && req.cookies.token;
    const header = req.headers.authorization;
    if (!token && header && header.startsWith('Bearer ')) token = header.split(' ')[1];

    if (!token) throw new ErrorHandler('Login first to access this resource', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) throw new ErrorHandler('User no longer exists', 401);
    req.user = user;
    next();
};

exports.authorizeRoles = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        throw new ErrorHandler(`Role (${req.user.role}) is not allowed to access this resource`, 403);
    }
    next();
};
