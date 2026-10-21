const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class APIFeatures {
    constructor(query, queryStr) {
        this.query = query;
        this.queryStr = queryStr;
        this.conditions = {};
    }

    // ?keyword=wheel
    search() {
        const { keyword } = this.queryStr;
        if (keyword) {
            const rx = { $regex: escapeRegex(String(keyword)), $options: 'i' };
            this.conditions.$or = [{ name: rx }, { brand: rx }, { description: rx }];
        }
        this.query.setQuery(this.conditions);
        return this;
    }

    // ?minPrice=&maxPrice=&category=&minRating=&minReviews=&platform=&connection=&group=
    filter() {
        const q = this.queryStr;
        const c = this.conditions;

        if (q.minPrice || q.maxPrice) {
            c.price = {};
            if (q.minPrice) c.price.$gte = Number(q.minPrice);
            if (q.maxPrice) c.price.$lte = Number(q.maxPrice);
        }
        if (q.category) c.category = String(q.category);
        if (q.group) c.group = String(q.group);
        if (q.minRating && Number(q.minRating) > 0) c.ratings = { $gte: Number(q.minRating) };
        if (q.minReviews && Number(q.minReviews) > 0) c.numOfReviews = { $gte: Number(q.minReviews) };
        if (q.platform) c.platforms = String(q.platform);
        if (q.connection) c.connectionType = String(q.connection);

        this.query.setQuery(c);
        return this;
    }

    sort() {
        const map = {
            newest: { createdAt: -1 },
            'price-asc': { price: 1 },
            'price-desc': { price: -1 },
            rating: { ratings: -1, numOfReviews: -1 }
        };
        this.query = this.query.sort(map[this.queryStr.sort] || map.newest);
        return this;
    }

    pagination(resPerPage) {
        const currentPage = Math.max(Number(this.queryStr.page) || 1, 1);
        this.query = this.query.limit(resPerPage).skip(resPerPage * (currentPage - 1));
        return this;
    }
}

module.exports = APIFeatures;
