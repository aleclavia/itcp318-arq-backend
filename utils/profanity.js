const Filter = require('bad-words');

const filter = new Filter();
const extra = (process.env.EXTRA_BAD_WORDS || '').split(',').map(w => w.trim()).filter(Boolean);
if (extra.length) filter.addWords(...extra);

// returns { clean, filtered }
exports.maskBadWords = (text = '') => {
    const clean = filter.clean(text);
    return { clean, filtered: clean !== text };
};
