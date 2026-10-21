const Order = require('../models/order');
const Product = require('../models/product');
const sendEmail = require('../utils/sendEmail');
const buildReceipt = require('../utils/receiptPdf');
const { orderEmailHtml, orderEmailSubject } = require('../utils/orderEmail');
const { computeTotals } = require('../utils/pricing');
const ErrorHandler = require('../utils/errorHandler');
const { ORDER_STATUSES } = require('../constants/catalog');

// POST /order/new  - prices are recomputed from the DB, client totals are ignored
exports.newOrder = async (req, res) => {
    const { orderItems, shippingInfo, paymentInfo } = req.body;
    if (!Array.isArray(orderItems) || !orderItems.length) throw new ErrorHandler('Your cart is empty', 400);
    if (!paymentInfo || paymentInfo.status !== 'succeeded') throw new ErrorHandler('Payment was not completed', 402);

    const built = [];
    for (const item of orderItems) {
        const qty = Number(item.quantity);
        if (!Number.isInteger(qty) || qty < 1) throw new ErrorHandler('Invalid quantity', 400);
        const product = await Product.findById(item.product);
        if (!product) throw new ErrorHandler(`A product in your cart no longer exists`, 404);
        if (product.availability === 'in-stock' && qty > product.stock) {
            throw new ErrorHandler(`Only ${product.stock} of "${product.name}" left in stock`, 400);
        }
        built.push({
            name: product.name, quantity: qty, image: product.images[0].url,
            price: product.price, product: product._id, isFreight: product.isFreight
        });
    }

    const totals = computeTotals(built);
    const order = await Order.create({
        orderItems: built.map(({ isFreight, ...rest }) => rest),
        shippingInfo, paymentInfo, ...totals,
        paidAt: Date.now(),
        user: req.user._id
    });
    res.status(201).json({ success: true, order });
};

exports.myOrders = async (req, res) => {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders });
};

exports.getSingleOrder = async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) throw new ErrorHandler('No order found with this ID', 404);
    if (req.user.role !== 'admin' && order.user._id.toString() !== req.user.id) {
        throw new ErrorHandler('You cannot view this order', 403);
    }
    res.status(200).json({ success: true, order });
};

// GET /order/:id/receipt  -> PDF download
exports.downloadReceipt = async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) throw new ErrorHandler('No order found with this ID', 404);
    if (req.user.role !== 'admin' && order.user._id.toString() !== req.user.id) {
        throw new ErrorHandler('You cannot view this order', 403);
    }
    const pdf = await buildReceipt(order);
    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${order._id}.pdf"`
    }).send(pdf);
};

/* ---------------- Admin ---------------- */
exports.allOrders = async (req, res) => {
    const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
    const totalAmount = orders.reduce((a, o) => a + o.totalPrice, 0);
    res.status(200).json({ success: true, totalAmount, orders });
};

// PUT /admin/order/:id  { status }   Processing -> Shipped -> Delivered
exports.updateOrder = async (req, res) => {
    const { status } = req.body;
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) throw new ErrorHandler('No order found with this ID', 404);

    if (order.orderStatus === 'Delivered') throw new ErrorHandler('This order has already been delivered', 400);
    if (!ORDER_STATUSES.includes(status)) throw new ErrorHandler('Invalid status', 400);
    if (ORDER_STATUSES.indexOf(status) <= ORDER_STATUSES.indexOf(order.orderStatus)) {
        throw new ErrorHandler(`Order is already ${order.orderStatus}; choose a later status`, 400);
    }

    if (status === 'Delivered') {
        // stock is decremented exactly once, when the order becomes Delivered
        for (const item of order.orderItems) {
            const product = await Product.findById(item.product);
            if (product) {
                product.stock = Math.max(0, product.stock - item.quantity);
                await product.save({ validateBeforeSave: false });
            }
        }
        order.deliveredAt = Date.now();
    }
    if (status === 'Shipped') order.shippedAt = Date.now();
    order.orderStatus = status;
    await order.save();

    // Email the customer (items, subtotals, grand total + PDF receipt). A mail failure must not undo the update.
    let emailSent = true, emailError;
    try {
        const pdf = await buildReceipt(order);
        await sendEmail({
            email: order.user.email,
            subject: orderEmailSubject(order),
            html: orderEmailHtml(order),
            attachments: [{ filename: `receipt-${String(order._id).slice(-8).toUpperCase()}.pdf`, content: pdf, contentType: 'application/pdf' }]
        });
    } catch (err) {
        emailSent = false;
        emailError = err.message;
        console.error('Order email failed:', err.message);
    }
    res.status(200).json({ success: true, emailSent, emailError });
};

exports.deleteOrder = async (req, res) => {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) throw new ErrorHandler('No order found with this ID', 404);
    res.status(200).json({ success: true });
};
