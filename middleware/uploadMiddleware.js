const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

// Configure Cloudinary with trims to prevent invisible character issues
const cloud_name = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const api_key = (process.env.CLOUDINARY_API_KEY || '').trim();
const api_secret = (process.env.CLOUDINARY_API_SECRET || '').trim();

console.log('--- Cloudinary Config Check ---');
console.log('Cloud Name:', cloud_name || 'MISSING');
console.log('API Key:', api_key ? `${api_key.slice(0, 4)}...${api_key.slice(-4)}` : 'MISSING');
console.log('API Secret:', api_secret ? 'EXISTS (Masked)' : 'MISSING');
console.log('-------------------------------');

cloudinary.config({
    cloud_name,
    api_key,
    api_secret
});

// Configure storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'dorm_revamp',
        resource_type: 'auto', // Support video, image, raw
    },
});

const fileFilter = (req, file, cb) => {
    // Allowed file types: Images, Videos, and PDF/Doc for KYC
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
        'audio/mpeg',
        'audio/wav',
        'audio/m4a',
        'audio/x-m4a',
        'audio/mp4',
        'audio/ogg',
        'audio/aac',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only Images, Videos, PDF, and Word documents are allowed.'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter
});

module.exports = upload;
