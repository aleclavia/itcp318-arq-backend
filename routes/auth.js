const express = require('express');
const router = express.Router();
const upload = require('../utils/multer');
const c = require('../controllers/auth');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/auth');

router.post('/register', upload.single('avatar'), c.registerUser);
router.post('/login', c.loginUser);
router.post('/auth/google', c.googleLogin);
router.get('/logout', c.logout);
router.post('/password/forgot', c.forgotPassword);
router.put('/password/reset/:token', c.resetPassword);

router.get('/me', isAuthenticatedUser, c.getUserProfile);
router.put('/me/update', isAuthenticatedUser, upload.single('avatar'), c.updateProfile);
router.put('/password/update', isAuthenticatedUser, c.updatePassword);

const admin = [isAuthenticatedUser, authorizeRoles('admin')];
router.get('/admin/users', ...admin, c.allUsers);
router.route('/admin/user/:id').get(...admin, c.getUserDetails).put(...admin, c.updateUser).delete(...admin, c.deleteUser);

module.exports = router;
