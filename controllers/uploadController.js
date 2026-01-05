exports.uploadImage = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    // Return key properties
    res.json({
        url: req.file.path,
        filename: req.file.filename,
        mimetype: req.file.mimetype
    });
};
