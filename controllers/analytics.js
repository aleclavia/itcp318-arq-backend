const Order = require('../models/order');
const Product = require('../models/product');

const TZ = () => process.env.TIMEZONE || 'UTC';

// Adds a "day" string (YYYY-MM-DD in TIMEZONE) and filters by ?start=YYYY-MM-DD&end=YYYY-MM-DD (inclusive)
const dayStages = (q) => {
    const stages = [{
        $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: TZ() } } }
    }];
    const range = {};
    if (q.start) range.$gte = q.start;
    if (q.end) range.$lte = q.end;
    if (Object.keys(range).length) stages.push({ $match: { day: range } });
    return stages;
};

const withPercent = (rows, key = 'total') => {
    const sum = rows.reduce((a, r) => a + r[key], 0) || 1;
    return rows.map(r => ({ ...r, percent: Number(((r[key] / sum) * 100).toFixed(2)) }));
};

const fillDays = (rows, start, end) => {
    if (!start || !end) return rows;
    const map = new Map(rows.map(r => [r.date, r]));
    const out = [];
    const d = new Date(`${start}T00:00:00Z`), last = new Date(`${end}T00:00:00Z`);
    let guard = 0;
    while (d <= last && guard++ < 400) {
        const key = d.toISOString().slice(0, 10);
        out.push(map.get(key) || { date: key, total: 0, orders: 0 });
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
};

// GET /admin/analytics/summary
exports.summary = async (req, res) => {
    const [totalProducts, outOfStock, backordered, agg] = await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ stock: 0, availability: 'in-stock' }),
        Product.countDocuments({ availability: { $in: ['backordered', 'pre-order'] } }),
        Order.aggregate([{ $group: { _id: null, totalOrders: { $sum: 1 }, totalSales: { $sum: '$totalPrice' } } }])
    ]);
    res.status(200).json({
        success: true,
        totalProducts, outOfStock, backordered,
        totalOrders: agg[0]?.totalOrders || 0,
        totalSales: agg[0]?.totalSales || 0
    });
};

// GET /admin/analytics/sales?start=&end=&interval=day|month
exports.salesOverTime = async (req, res) => {
    const interval = req.query.interval === 'month' ? 'month' : 'day';
    const rows = await Order.aggregate([
        ...dayStages(req.query),
        {
            $group: {
                _id: interval === 'month' ? { $substrBytes: ['$day', 0, 7] } : '$day',
                total: { $sum: '$totalPrice' }, orders: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', total: { $round: ['$total', 2] }, orders: 1 } }
    ]);
    const data = interval === 'day' ? fillDays(rows, req.query.start, req.query.end) : rows;
    res.status(200).json({ success: true, interval, sales: data });
};

// GET /admin/analytics/customers
exports.customerSales = async (req, res) => {
    const rows = await Order.aggregate([
        ...dayStages(req.query),
        { $group: { _id: '$user', total: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, name: { $ifNull: ['$u.name', 'Deleted user'] }, total: { $round: ['$total', 2] }, orders: 1 } },
        { $sort: { total: -1 } }
    ]);
    res.status(200).json({ success: true, customers: rows });
};

// GET /admin/analytics/products  -> % of sales by product
exports.productSales = async (req, res) => {
    const rows = await Order.aggregate([
        ...dayStages(req.query),
        { $unwind: '$orderItems' },
        { $group: { _id: '$orderItems.name', total: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } } } },
        { $project: { _id: 0, name: '$_id', total: { $round: ['$total', 2] } } },
        { $sort: { total: -1 } }
    ]);
    res.status(200).json({ success: true, products: withPercent(rows) });
};

// GET /admin/analytics/groups  -> % of sales VR vs Racing vs Flight (and by category)
exports.groupSales = async (req, res) => {
    const rows = await Order.aggregate([
        ...dayStages(req.query),
        { $unwind: '$orderItems' },
        { $lookup: { from: 'products', localField: 'orderItems.product', foreignField: '_id', as: 'p' } },
        { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: { group: { $ifNull: ['$p.group', 'Other'] }, category: { $ifNull: ['$p.category', 'Other'] } },
                total: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
            }
        }
    ]);
    const byGroup = {};
    rows.forEach(r => { byGroup[r._id.group] = (byGroup[r._id.group] || 0) + r.total; });
    const groups = withPercent(Object.entries(byGroup).map(([name, total]) => ({ name, total: Number(total.toFixed(2)) })));
    const categories = withPercent(rows.map(r => ({ name: r._id.category, total: Number(r.total.toFixed(2)) }))).sort((a, b) => b.total - a.total);
    res.status(200).json({ success: true, groups, categories });
};
