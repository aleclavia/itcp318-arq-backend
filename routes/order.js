const express = require('express');
const router = express.Router();
const c = require('../controllers/order');
const a = require('../controllers/analytics');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/auth');

const admin = [isAuthenticatedUser, authorizeRoles('admin')];

router.post('/order/new', isAuthenticatedUser, c.newOrder);
router.get('/orders/me', isAuthenticatedUser, c.myOrders);
router.get('/order/:id', isAuthenticatedUser, c.getSingleOrder);
router.get('/order/:id/receipt', isAuthenticatedUser, c.downloadReceipt);

router.get('/admin/orders', ...admin, c.allOrders);
router.route('/admin/order/:id').put(...admin, c.updateOrder).delete(...admin, c.deleteOrder);

// analytics (all accept ?start=YYYY-MM-DD&end=YYYY-MM-DD)
router.get('/admin/analytics/summary', ...admin, a.summary);
router.get('/admin/analytics/sales', ...admin, a.salesOverTime);
router.get('/admin/analytics/customers', ...admin, a.customerSales);
router.get('/admin/analytics/products', ...admin, a.productSales);
router.get('/admin/analytics/groups', ...admin, a.groupSales);

module.exports = router;
