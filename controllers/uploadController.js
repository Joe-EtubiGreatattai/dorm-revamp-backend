exports.uploadImage = (req, res) => {
    console.log('🖼️ [Backend] uploadImage hit');
    if (!req.file) {
        console.log('❌ [Backend] uploadImage: No file in request');
        return res.status(400).json({ message: 'No file uploaded' });
    }
    console.log('✅ [Backend] uploadImage: File received:', {
        originalname: req.file.originalname,
        path: req.file.path,
        size: req.file.size
    });
    // Return key properties
    res.json({
        url: req.file.path,
        filename: req.file.filename,
        mimetype: req.file.mimetype
    });
};
