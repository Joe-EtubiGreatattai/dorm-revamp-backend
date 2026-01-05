const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'dorm-revamp',
        allowed_formats: ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx'],
        // resource_type: 'auto' // Important for docs vs images
    },
});

module.exports = {
    cloudinary,
    storage
};
