// Usage:  npm run seed            -> wipes products/orders, upserts demo users, inserts demo data
//         npm run seed -- --destroy -> wipes products + orders only
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });
const mongoose = require('mongoose');
const User = require('../models/user');
const Product = require('../models/product');
const Order = require('../models/order');
const { computeTotals } = require('../utils/pricing');

// tiny deterministic RNG so the demo data is the same every run
let seed = 318;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];

const PC = 'PC / SteamVR', SA = 'Standalone (Android)', PS = 'PlayStation / PSVR2', XB = 'Xbox';
const img = (label, i) => ({ public_id: `seed/${label.toLowerCase().replace(/\W+/g, '-')}-${i}`, url: `https://placehold.co/800x600/101827/${i === 1 ? '00e5ff' : 'ff2bd6'}/png?text=${encodeURIComponent(label)}` });

const P = (name, brand, category, price, stock, o = {}) => ({
    name, brand, category, price, stock,
    description: o.description || `${name} by ${brand}. Built for serious sim and VR play with reliable tracking, low latency and long-session comfort.`,
    images: [img(name, 1), img(name, 2)],
    platforms: o.platforms || [PC], software: o.software || [], connectionType: o.connectionType || 'USB',
    playSpace: o.playSpace || 'None', mountPattern: o.mountPattern || '', supportedMountPatterns: o.supportedMountPatterns || [],
    specs: o.specs || [], isFreight: !!o.isFreight, availability: o.availability || 'in-stock',
    expectedAvailability: o.expectedAvailability
});

const products = [
    P('Aether Pro VR Headset', 'Aether', 'VR Headsets', 799, 14, { platforms: [PC], software: ['SteamVR', 'iRacing', 'MSFS'], connectionType: 'DisplayPort / HDMI', playSpace: 'Room-scale', specs: [{ key: 'Resolution', value: '2880x2880 per eye' }, { key: 'Refresh rate', value: '120 Hz' }, { key: 'Tracking', value: 'Lighthouse 2.0' }] }),
    P('Nimbus Q Standalone Headset', 'Nimbus', 'VR Headsets', 449, 30, { platforms: [SA, PC], software: ['SteamVR', 'Beat Saber'], connectionType: 'Wi-Fi', playSpace: 'Standing', specs: [{ key: 'Resolution', value: '2064x2208 per eye' }, { key: 'Refresh rate', value: '90 Hz' }, { key: 'Tracking', value: 'Inside-out' }] }),
    P('Orbit PS Headset', 'Orbit', 'VR Headsets', 549, 9, { platforms: [PS], software: ['Gran Turismo 7'], connectionType: 'USB', playSpace: 'Seated', specs: [{ key: 'Resolution', value: '2000x2040 per eye' }, { key: 'Refresh rate', value: '120 Hz' }] }),
    P('Vector X Headset (Pre-order)', 'Aether', 'VR Headsets', 1099, 0, { platforms: [PC], software: ['SteamVR'], connectionType: 'DisplayPort / HDMI', playSpace: 'Room-scale', availability: 'pre-order', expectedAvailability: new Date(Date.now() + 45 * 864e5) }),
    P('Pulse Motion Controllers (pair)', 'Aether', 'Motion Controllers', 199, 40, { platforms: [PC], software: ['SteamVR'], connectionType: 'Bluetooth' }),
    P('Lighthouse Base Station 2.0 (x2)', 'Aether', 'Base Stations & Trackers', 259, 22, { platforms: [PC], software: ['SteamVR'], connectionType: 'USB', playSpace: 'Room-scale' }),
    P('Tracker Puck Triple Pack', 'Nimbus', 'Base Stations & Trackers', 179, 0, { platforms: [PC], connectionType: 'Proprietary Wireless', availability: 'backordered', expectedAvailability: new Date(Date.now() + 21 * 864e5) }),
    P('HaptiVest Full-Body Suit', 'Kinetix', 'Haptic Wearables', 699, 6, { platforms: [PC], connectionType: 'Wi-Fi', software: ['SteamVR'] }),
    P('HaptiGlove Pair', 'Kinetix', 'Haptic Wearables', 349, 11, { platforms: [PC, SA], connectionType: 'Bluetooth' }),
    P('Apex DD 12Nm Wheel Base', 'Apex', 'Racing Wheels', 649, 12, { platforms: [PC, XB], software: ['iRacing', 'Assetto Corsa Competizione'], mountPattern: '4xM6-100mm', specs: [{ key: 'Peak torque', value: '12 Nm' }, { key: 'Force feedback', value: 'Direct drive' }] }),
    P('Apex DD 20Nm Wheel Base', 'Apex', 'Racing Wheels', 1199, 5, { platforms: [PC], software: ['iRacing', 'Assetto Corsa Competizione'], mountPattern: '4xM8-120mm', specs: [{ key: 'Peak torque', value: '20 Nm' }] }),
    P('Torque GT Wheel (Console)', 'Torque', 'Racing Wheels', 399, 18, { platforms: [PS, PC], software: ['Gran Turismo 7', 'Assetto Corsa'], mountPattern: '4xM6-100mm' }),
    P('Pro Load-Cell Pedals', 'Apex', 'Pedals', 329, 20, { platforms: [PC, XB], software: ['iRacing', 'Assetto Corsa Competizione'], mountPattern: 'Universal-pedal-plate', specs: [{ key: 'Brake load', value: '200 kg' }] }),
    P('Clubsport Hydraulic Pedals', 'Torque', 'Pedals', 579, 7, { platforms: [PC], mountPattern: 'Universal-pedal-plate' }),
    P('Sequential Shifter', 'Torque', 'Shifters & Handbrakes', 159, 25, { platforms: [PC, XB, PS], mountPattern: 'Clamp-universal' }),
    P('Pro Handbrake', 'Apex', 'Shifters & Handbrakes', 119, 3, { platforms: [PC, XB, PS], mountPattern: 'Clamp-universal' }),
    P('HOTAS Warthog-Style Throttle & Stick', 'Skyline', 'Flight Sticks & Throttles', 429, 10, { platforms: [PC], software: ['DCS World', 'MSFS'], specs: [{ key: 'Axes', value: '6' }, { key: 'Buttons', value: '50' }] }),
    P('Airliner Yoke System', 'Skyline', 'Flight Sticks & Throttles', 379, 8, { platforms: [PC, XB], software: ['MSFS'], specs: [{ key: 'Axes', value: '3' }] }),
    P('Joystick Compact Stick', 'Skyline', 'Flight Sticks & Throttles', 89, 40, { platforms: [PC, XB], software: ['MSFS', 'DCS World'], specs: [{ key: 'Axes', value: '4' }] }),
    P('Stage 6-DOF Motion Platform', 'Kinetix', 'Motion Platforms', 3299, 2, { platforms: [PC], software: ['iRacing', 'MSFS'], isFreight: true, connectionType: 'USB', supportedMountPatterns: [] }),
    P('Stage 3-DOF Motion Platform', 'Kinetix', 'Motion Platforms', 1599, 4, { platforms: [PC, XB, PS], software: ['iRacing'], isFreight: true }),
    P('Alu Profile Rig Frame 8020', 'Apex', 'Rig Frames & Mounts', 389, 9, { platforms: [PC, XB, PS], isFreight: true, supportedMountPatterns: ['4xM6-100mm', '4xM8-120mm', 'Universal-pedal-plate', 'Clamp-universal'] }),
    P('Compact Foldable Cockpit', 'Torque', 'Rig Frames & Mounts', 249, 14, { platforms: [PC, XB, PS], isFreight: true, supportedMountPatterns: ['4xM6-100mm', 'Universal-pedal-plate', 'Clamp-universal'] }),
    P('Wheel Stand Pro Mount', 'Torque', 'Rig Frames & Mounts', 99, 33, { platforms: [PC, XB, PS], supportedMountPatterns: ['4xM6-100mm'] }),
    P('Spectre Lite VR Headset', 'Nimbus', 'VR Headsets', 299, 50, { platforms: [SA], connectionType: 'Wi-Fi', playSpace: 'Standing' })
];

const run = async () => {
    await mongoose.connect(process.env.DB_URI);
    await Product.deleteMany(); await Order.deleteMany();
    console.log('Cleared products and orders');
    if (process.argv.includes('--destroy')) return;

    const av = n => ({ public_id: 'default_avatar', url: `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=0b0f1a&color=00e5ff&size=150` });
    const upsert = async (name, email, password, role) => {
        let u = await User.findOne({ email });
        if (!u) u = await User.create({ name, email, password, role, avatar: av(name) });
        return u;
    };
    const admin = await upsert('Admin', 'admin@arqane.test', 'Admin#12345', 'admin');
    const customers = [];
    for (const n of ['Alex Reyes', 'Sam Cruz', 'Jamie Lim', 'Riley Tan']) {
        customers.push(await upsert(n, `${n.split(' ')[0].toLowerCase()}@arqane.test`, 'User#12345', 'user'));
    }

    const docs = await Product.insertMany(products.map(p => ({ ...p, user: admin._id })));

    // 45 delivered/shipped/processing orders across the last 120 days
    const buyers = new Map(); // productId -> [userIds] for demo reviews
    for (let i = 0; i < 45; i++) {
        const user = pick(customers);
        const items = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(docs.filter(d => d.availability === 'in-stock')));
        const lines = [...new Map(items.map(d => [String(d._id), d])).values()].map(d => ({
            name: d.name, quantity: 1 + Math.floor(rnd() * 2), image: d.images[0].url, price: d.price, product: d._id, isFreight: d.isFreight
        }));
        const totals = computeTotals(lines);
        const paidAt = new Date(Date.now() - Math.floor(rnd() * 120) * 864e5 - Math.floor(rnd() * 864e5));
        const status = rnd() < 0.7 ? 'Delivered' : rnd() < 0.5 ? 'Shipped' : 'Processing';
        await Order.create({
            user: user._id,
            orderItems: lines.map(({ isFreight, ...l }) => l),
            shippingInfo: { address: '123 Demo St', city: 'Taguig', postalCode: '1630', country: 'Philippines', phoneNo: '09170000000' },
            paymentInfo: { id: `seed_${i}`, status: 'succeeded' }, paidAt, createdAt: paidAt,
            ...totals, orderStatus: status, deliveredAt: status === 'Delivered' ? paidAt : undefined
        });
        if (status === 'Delivered') lines.forEach(l => { const k = String(l.product); buyers.set(k, [...new Set([...(buyers.get(k) || []), String(user._id)])]); });
    }

    // demo reviews from customers who actually "received" the product
    const comments = ['Great quality, works perfectly with my rig.', 'Solid build and easy setup.', 'Good value for the price.', 'Took a while to calibrate but worth it.', 'Exactly as described. Highly recommended!'];
    for (const d of docs) {
        const ids = buyers.get(String(d._id)) || [];
        d.reviews = ids.slice(0, 4).map(uid => {
            const u = customers.find(c => String(c._id) === uid);
            return { user: u._id, name: u.name, rating: 3 + Math.floor(rnd() * 3), comment: pick(comments) };
        });
        d.numOfReviews = d.reviews.length;
        d.ratings = d.reviews.length ? Number((d.reviews.reduce((a, r) => a + r.rating, 0) / d.reviews.length).toFixed(1)) : 0;
        await d.save();
    }
    console.log(`Seeded ${docs.length} products, 45 orders, ${customers.length + 1} users`);
    console.log('Admin:    admin@arqane.test / Admin#12345');
    console.log('Customer: alex@arqane.test  / User#12345');
};

run().then(() => mongoose.disconnect()).catch(e => { console.error(e); process.exit(1); });
