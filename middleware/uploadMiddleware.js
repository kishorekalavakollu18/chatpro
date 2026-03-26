const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'chat_media',
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'pdf', 'docx', 'mp3', 'wav', 'webm'],
        resource_type: 'auto',
    },
});

const upload = multer({ storage: storage });

module.exports = upload;
