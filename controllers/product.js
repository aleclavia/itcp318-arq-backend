const Product = require('../models/product');
const Order = require('../models/order');
const APIFeatures = require('../utils/apiFeatures');
const ErrorHandler = require('../utils/errorHandler');
const { maskBadWords } = require('../utils/profanity');
const { ORDER_STATUSES } = require('../constants/catalog');
const { uploadProductImages, destroyImage, safeUnlink } = require('../utils/cloudinaryHelper');

const parseJSON = (v, fallback) => {
    if (v === undefined || v === '') return fallback;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return fallback; }
};

// Turn multipart text fields into proper product fields
const buildProductData = (body) => {
    const data = {
        name: body.name,
        brand: body.brand,
        price: body.price,
        description: body.description,
        category: body.category,
        stock: body.stock,
        availability: body.availability || 'in-stock',
        isFreight: body.isFreight === 'true' || body.isFreight === true,
        connectionType: body.connectionType || '',
        playSpace: body.playSpace || 'None',
        mountPattern: body.mountPattern || '',
        platforms: parseJSON(body.platforms, []),
        software: parseJSON(body.software, []),
        supportedMountPatterns: parseJSON(body.supportedMountPatterns, []),
        specs: parseJSON(body.specs, []).filter(s => s.key && s.value)
    };
    if (body.group) data.group = body.group;
    if (body.expectedAvailability) data.expectedAvailability = body.expectedAvailability;
    return data;
};

const recalcRatings = (product) => {
    product.numOfReviews = product.reviews.length;
    product.ratings = product.reviews.length
        ? Number((product.reviews.reduce((a, r) => a + r.rating, 0) / product.reviews.length).toFixed(1))
        : 0;
};

/* ---------------- Public ---------------- */
exports.getProducts = async (req, res) => {
    const resPerPage = Math.min(Number(req.query.limit) || 8, 50);
    const features = new APIFeatures(Product.find(), req.query).search().filter().sort();

    // count BEFORE pagination so the pager knows the true number of matches
    const productsCount = await Product.countDocuments(features.query.getFilter());
    features.pagination(resPerPage);
    const products = await features.query;

    res.status(200).json({
        success: true,
        products,
        productsCount,
        resPerPage,
        totalPages: Math.ceil(productsCount / resPerPage)
    });
};

exports.getSingleProduct = async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new ErrorHandler('Product not found', 404);
    res.status(200).json({ success: true, product });
};

/* ---------------- Admin CRUD ---------------- */
exports.getAdminProducts = async (req, res) => {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, products });
};

// POST /admin/product/new  (multipart; images = multiple files)
exports.newProduct = async (req, res) => {
    const files = req.files || [];
    if (!files.length) throw new ErrorHandler('Please upload at least one product image', 400);

    let images;
    try { images = await uploadProductImages(files); }
    catch (e) { throw new ErrorHandler(`Image upload failed: ${e.message}`, 500); }

    try {
        const product = await Product.create({ ...buildProductData(req.body), images, user: req.user._id });
        res.status(201).json({ success: true, product });
    } catch (e) {
        await Promise.all(images.map(i => destroyImage(i.public_id))); // don't leave orphans
        throw e;
    }
};

// PUT /admin/product/:id  (multipart; keepImages = JSON array of public_ids to keep; images = new files)
exports.updateProduct = async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
        await Promise.all((req.files || []).map(f => safeUnlink(f.path)));
        throw new ErrorHandler('Product not found', 404);
    }

    const keep = parseJSON(req.body.keepImages, product.images.map(i => i.public_id));
    const kept = product.images.filter(i => keep.includes(i.public_id));
    const removed = product.images.filter(i => !keep.includes(i.public_id));
    const added = await uploadProductImages(req.files || []);

    const images = [...kept.map(i => ({ public_id: i.public_id, url: i.url })), ...added];
    if (!images.length) {
        await Promise.all(added.map(i => destroyImage(i.public_id)));
        throw new ErrorHandler('A product needs at least one image', 400);
    }

    product.set({ ...buildProductData(req.body), images });
    await product.save();
    await Promise.all(removed.map(i => destroyImage(i.public_id)));
    res.status(200).json({ success: true, product });
};

exports.deleteProduct = async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new ErrorHandler('Product not found', 404);
    await Promise.all(product.images.map(i => destroyImage(i.public_id)));
    await product.deleteOne();
    res.status(200).json({ success: true, message: 'Product deleted' });
};

// DELETE /admin/products   body: { ids: [...] }   (bulk delete)
exports.bulkDeleteProducts = async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) throw new ErrorHandler('No products selected', 400);

    const products = await Product.find({ _id: { $in: ids } });
    for (const p of products) await Promise.all(p.images.map(i => destroyImage(i.public_id)));
    const result = await Product.deleteMany({ _id: { $in: products.map(p => p._id) } });
    res.status(200).json({ success: true, deletedCount: result.deletedCount });
};

/* ---------------- Reviews ---------------- */
const REVIEW_MSG = {
    notOrdered: "You haven't ordered this item yet. Once you've purchased and received it, you're welcome to share your review here.",
    processing: "Thanks for your order! It's still being processed. You can leave a review once it has been delivered.",
    shipped: 'Your order is on its way. You can leave a review once it has been delivered.',
};

// Works out whether this customer may review this product, and if not, why (so the message can be specific).
const getReviewAccess = async (userId, productId) => {
    const orders = await Order.find({ user: userId, 'orderItems.product': productId }).select('orderStatus');
    if (!orders.length) return { canReview: false, orderStatus: null, reason: REVIEW_MSG.notOrdered };

    // if they ordered it more than once, use the furthest-along order
    const best = orders.map(o => o.orderStatus).sort((a, b) => ORDER_STATUSES.indexOf(b) - ORDER_STATUSES.indexOf(a))[0];
    const requireDelivered = process.env.REVIEW_REQUIRES_DELIVERED !== 'false';
    if (!requireDelivered || best === 'Delivered') return { canReview: true, orderStatus: best, reason: '' };

    return { canReview: false, orderStatus: best, reason: best === 'Shipped' ? REVIEW_MSG.shipped : REVIEW_MSG.processing };
};

// GET /review/eligibility?productId=
exports.reviewEligibility = async (req, res) => {
    const product = await Product.findById(req.query.productId);
    if (!product) throw new ErrorHandler('Product not found', 404);
    const access = await getReviewAccess(req.user._id, product._id);
    const mine = product.reviews.find(r => r.user.toString() === req.user._id.toString());
    res.status(200).json({ success: true, ...access, myReview: mine || null });
};

// PUT /review   { productId, rating, comment }  -> creates OR updates the caller's own review
exports.createProductReview = async (req, res) => {
    const { productId } = req.body;
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ErrorHandler('Rating must be 1 to 5 stars', 400);
    if (comment.length < 3 || comment.length > 500) throw new ErrorHandler('Comment must be 3-500 characters', 400);

    const product = await Product.findById(productId);
    if (!product) throw new ErrorHandler('Product not found', 404);
    const access = await getReviewAccess(req.user._id, product._id);
    if (!access.canReview) throw new ErrorHandler(access.reason, 403);

    const { clean, filtered } = maskBadWords(comment);
    const existing = product.reviews.find(r => r.user.toString() === req.user._id.toString());
    if (existing) {
        existing.rating = rating;
        existing.comment = clean;
        existing.name = req.user.name;
    } else {
        product.reviews.push({ user: req.user._id, name: req.user.name, rating, comment: clean });
    }
    recalcRatings(product);
    await product.save();

    res.status(existing ? 200 : 201).json({ success: true, updated: !!existing, filtered });
};

exports.getProductReviews = async (req, res) => {
    const product = await Product.findById(req.query.id);
    if (!product) throw new ErrorHandler('Product not found', 404);
    res.status(200).json({ success: true, reviews: product.reviews });
};

// GET /admin/reviews  -> every review on every product
exports.getAllReviews = async (req, res) => {
    const products = await Product.find({ 'reviews.0': { $exists: true } }).select('name reviews');
    const reviews = products.flatMap(p => p.reviews.map(r => ({
        _id: r._id, productId: p._id, productName: p.name, userName: r.name,
        rating: r.rating, comment: r.comment, createdAt: r.createdAt, updatedAt: r.updatedAt
    })));
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.status(200).json({ success: true, reviews });
};

// DELETE /admin/review?productId=&id=
exports.deleteReview = async (req, res) => {
    const product = await Product.findById(req.query.productId);
    if (!product) throw new ErrorHandler('Product not found', 404);
    const review = product.reviews.id(req.query.id);
    if (!review) throw new ErrorHandler('Review not found', 404);
    review.deleteOne();
    recalcRatings(product);
    await product.save();
    res.status(200).json({ success: true });
};
