const mongoose = require('mongoose');
const {
    CATEGORIES, CATEGORY_GROUP, GROUPS, PLATFORMS, CONNECTION_TYPES, PLAY_SPACES, AVAILABILITY
} = require('../constants/catalog');

const reviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxLength: 500 }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter product name'],
        trim: true,
        maxLength: [100, 'Product name cannot exceed 100 characters']
    },
    brand: {
        type: String,
        required: [true, 'Please enter the brand'],
        trim: true,
        maxLength: [50, 'Brand cannot exceed 50 characters']
    },
    price: {
        type: Number,
        required: [true, 'Please enter product price'],
        min: [0, 'Price cannot be negative'],
        max: [1000000, 'Price is too large'],
        default: 0.0
    },
    description: {
        type: String,
        required: [true, 'Please enter product description']
    },
    ratings: { type: Number, default: 0 },
    images: [
        {
            public_id: { type: String, required: true },
            url: { type: String, required: true }
        }
    ],
    category: {
        type: String,
        required: [true, 'Please select category for this product'],
        enum: { values: CATEGORIES, message: 'Please select correct category for product' }
    },
    group: { type: String, enum: GROUPS }, // VR / Racing / Flight (auto-filled from category)
    stock: {
        type: Number,
        required: [true, 'Please enter product stock'],
        min: [0, 'Stock cannot be negative'],
        default: 0
    },

    // Pre-order / backorder
    availability: { type: String, enum: AVAILABILITY, default: 'in-stock' },
    expectedAvailability: { type: Date },

    // Freight (oversized) shipping
    isFreight: { type: Boolean, default: false },

    // Compatibility & platform guidance
    platforms: [{ type: String, enum: PLATFORMS }],
    software: [{ type: String, trim: true }],
    connectionType: { type: String, enum: [...CONNECTION_TYPES, ''], default: '' },
    playSpace: { type: String, enum: PLAY_SPACES, default: 'None' },
    mountPattern: { type: String, trim: true, default: '' },            // e.g. "Wheel base: 4x M6 / 100mm"
    supportedMountPatterns: [{ type: String, trim: true }],             // for rig frames
    specs: [{ key: { type: String, trim: true }, value: { type: String, trim: true }, _id: false }],

    numOfReviews: { type: Number, default: 0 },
    reviews: [reviewSchema],

    user: { type: mongoose.Schema.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

productSchema.index({ name: 'text', brand: 'text' });

productSchema.pre('validate', function () {
    if (!this.group && this.category) this.group = CATEGORY_GROUP[this.category];
    if (this.availability === 'in-stock') this.expectedAvailability = undefined;
});

module.exports = mongoose.model('Product', productSchema);
