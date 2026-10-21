const fs = require('fs/promises');
const cloudinary = require('../config/cloudinary');

const safeUnlink = (p) => fs.unlink(p).catch(() => { });

exports.uploadProductImages = async (files = []) => {
    const out = [];
    for (const file of files) {
        try {
            const r = await cloudinary.uploader.upload(file.path, {
                folder: 'products',
                transformation: [{ width: 1200, crop: 'limit' }]
            });
            out.push({ public_id: r.public_id, url: r.secure_url });
        } finally {
            await safeUnlink(file.path);
        }
    }
    return out;
};

// source = local file path OR remote URL (used for Google profile photos)
exports.uploadAvatar = async (source) => {
    const r = await cloudinary.uploader.upload(source, {
        folder: 'avatars',
        width: 150, height: 150, crop: 'fill', gravity: 'auto'
    });
    return { public_id: r.public_id, url: r.secure_url };
};

exports.destroyImage = async (publicId) => {
    if (!publicId || publicId.startsWith('seed/') || publicId === 'default_avatar') return;
    try { await cloudinary.uploader.destroy(publicId); } catch (e) { console.log('Cloudinary destroy failed:', e.message); }
};

exports.safeUnlink = safeUnlink;
