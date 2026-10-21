const express = require('express');
const router = express.Router();
const upload = require('../utils/multer');
const c = require('../controllers/product');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/auth');

const admin = [isAuthenticatedUser, authorizeRoles('admin')];

// public
router.get('/products', c.getProducts);
router.get('/product/:id', c.getSingleProduct);

// admin CRUD
router.get('/admin/products', ...admin, c.getAdminProducts);
router.delete('/admin/products', ...admin, c.bulkDeleteProducts);   // bulk delete { ids: [] }
router.post('/admin/product/new', ...admin, upload.array('images', 10), c.newProduct);
router.route('/admin/product/:id')
    .put(...admin, upload.array('images', 10), c.updateProduct)
    .delete(...admin, c.deleteProduct);

// reviews
router.get('/review/eligibility', isAuthenticatedUser, c.reviewEligibility);
router.put('/review', isAuthenticatedUser, c.createProductReview);
router.get('/reviews', c.getProductReviews);
router.get('/admin/reviews', ...admin, c.getAllReviews);
router.delete('/admin/review', ...admin, c.deleteReview);

module.exports = router;
