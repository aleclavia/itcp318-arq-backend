const crypto = require('crypto');
const User = require('../models/user');
const sendEmail = require('../utils/sendEmail');
const sendToken = require('../utils/jwtToken');
const ErrorHandler = require('../utils/errorHandler');
const { uploadAvatar, destroyImage, safeUnlink } = require('../utils/cloudinaryHelper');

const defaultAvatar = (name) => ({
    public_id: 'default_avatar',
    url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=0b0f1a&color=00e5ff&size=150`
});

// POST /register   (multipart: name, email, password, avatar[file])
exports.registerUser = async (req, res) => {
    const { name, email, password } = req.body;
    let avatar = defaultAvatar(name);
    if (req.file) {
        try { avatar = await uploadAvatar(req.file.path); } finally { await safeUnlink(req.file.path); }
    }
    const user = await User.create({ name, email, password, avatar });
    sendToken(user, 201, res);
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new ErrorHandler('Please enter email & password', 400);

    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
    if (user && user.needsPasswordSetup) {
        throw new ErrorHandler('This account uses Google sign-in. Click "Continue with Google", or use "Forgot password" to create a password.', 400);
    }
    if (!user || !(await user.comparePassword(password))) {
        throw new ErrorHandler('Invalid Email or Password', 401);
    }
    sendToken(user, 200, res);
};

// POST /auth/google  { idToken }  - Firebase Google sign-in
exports.googleLogin = async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) throw new ErrorHandler('Missing Google token', 400);
    if (!process.env.FIREBASE_PROJECT_ID) throw new ErrorHandler('FIREBASE_PROJECT_ID is not configured on the server', 500);

    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });

    let decoded;
    try { decoded = await admin.auth().verifyIdToken(idToken); }
    catch (e) { throw new ErrorHandler('Google sign-in could not be verified', 401); }
    if (!decoded.email) throw new ErrorHandler('Google account has no email', 400);

    let user = await User.findOne({ email: decoded.email.toLowerCase() });
    if (!user) {
        const name = (decoded.name || decoded.email.split('@')[0]).slice(0, 30);
        let avatar;
        try { avatar = decoded.picture ? await uploadAvatar(decoded.picture) : defaultAvatar(name); }
        catch { avatar = defaultAvatar(name); }
        user = await User.create({
            name, email: decoded.email, avatar,
            password: crypto.randomBytes(16).toString('hex'),
            authProvider: 'google'
        });
    }
    sendToken(user, 200, res);
};

exports.forgotPassword = async (req, res) => {
    const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
    if (!user) throw new ErrorHandler('User not found with this email', 404);

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/password/reset/${resetToken}`;
    const html = `<p>Your password reset link (valid for 30 minutes):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request this, ignore this email.</p>`;
    try {
        await sendEmail({ email: user.email, subject: 'ARQANE ARQADE Password Recovery', html });
        res.status(200).json({ success: true, message: `Email sent to: ${user.email}` });
    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
        throw new ErrorHandler(`Email could not be sent: ${error.message}`, 500);
    }
};

exports.resetPassword = async (req, res) => {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ resetPasswordToken, resetPasswordExpire: { $gt: Date.now() } });
    if (!user) throw new ErrorHandler('Password reset token is invalid or has expired', 400);
    if (req.body.password !== req.body.confirmPassword) throw new ErrorHandler('Passwords do not match', 400);

    user.password = req.body.password;
    user.passwordSetAt = Date.now();
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    sendToken(user, 200, res);
};

exports.getUserProfile = async (req, res) => {
    res.status(200).json({ success: true, user: req.user });
};

// PUT /me/update  (multipart: name, email, avatar[file]?)
exports.updateProfile = async (req, res) => {
    const newUserData = { name: req.body.name, email: req.body.email };

    if (req.file) {
        let result;
        try { result = await uploadAvatar(req.file.path); } finally { await safeUnlink(req.file.path); }
        await destroyImage(req.user.avatar.public_id);
        newUserData.avatar = result;
    }
    const user = await User.findByIdAndUpdate(req.user.id, newUserData, { new: true, runValidators: true });
    res.status(200).json({ success: true, user });
};

exports.updatePassword = async (req, res) => {
    const user = await User.findById(req.user.id).select('+password');
    const { oldPassword, password } = req.body;

    // Google accounts start with a random password nobody knows, so the first time they set one
    // (while already signed in) no old password is needed. Afterwards it is required like normal.
    if (!user.needsPasswordSetup) {
        if (!oldPassword || !(await user.comparePassword(oldPassword))) {
            throw new ErrorHandler('Old password is incorrect', 400);
        }
    }
    if (!password || String(password).length < 6) throw new ErrorHandler('New password must be at least 6 characters', 400);

    user.password = password;
    user.passwordSetAt = Date.now();
    await user.save();
    sendToken(user, 200, res);
};

exports.logout = async (req, res) => {
    res.cookie('token', null, sendToken.clearOptions());
    res.status(200).json({ success: true, message: 'Logged out' });
};

/* ---------------- Admin ---------------- */
exports.allUsers = async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, users });
};

exports.getUserDetails = async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new ErrorHandler(`User not found with id: ${req.params.id}`, 404);
    res.status(200).json({ success: true, user });
};

// Admins may only change a user's ROLE. Name and email belong to the account owner
// (changing someone's email would let an admin take over the account via password reset).
exports.updateUser = async (req, res) => {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) throw new ErrorHandler('Role must be user or admin', 400);
    if (req.params.id === String(req.user._id) && role !== 'admin') {
        throw new ErrorHandler('You cannot remove your own admin role', 400);
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true });
    if (!user) throw new ErrorHandler(`User not found with id: ${req.params.id}`, 404);
    res.status(200).json({ success: true, user });
};

exports.deleteUser = async (req, res) => {
    if (req.params.id === String(req.user._id)) throw new ErrorHandler('You cannot delete your own account', 400);
    const user = await User.findById(req.params.id);
    if (!user) throw new ErrorHandler(`User not found with id: ${req.params.id}`, 404);
    await destroyImage(user.avatar.public_id);
    await user.deleteOne();
    res.status(200).json({ success: true });
};
