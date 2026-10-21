const multer = require('multer');
const path = require('path');

// Files go to the OS temp dir first, then get pushed to Cloudinary and deleted.
module.exports = multer({
    limits: { fileSize: 5 * 1024 * 1024, files: 10 },
    storage: multer.diskStorage({}),
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            return cb(new Error('Only JPG, PNG or WEBP images are allowed'));
        }
        cb(null, true);
    }
});
