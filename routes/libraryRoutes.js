const express = require('express');
const router = express.Router();
const {
    getMaterials,
    getMaterial,
    getFaculties,
    uploadMaterial,
    updateMaterial,
    deleteMaterial,
    saveMaterial,
    downloadMaterial,
    getCBT,
    submitCBT,
    summarizeMaterial,
    getCBTByMaterial,
    getCategories,
    getPersonalLibrary,
    addMaterialReview,
    getAICBTs
} = require('../controllers/libraryController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Dedicated memory storage for library to allow buffer processing (text extraction)
const multer = require('multer');
const storage = multer.memoryStorage();
const memoryUpload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/faculties', getFaculties);
router.get('/materials', getMaterials);
router.get('/categories', getCategories);
router.get('/personal', protect, getPersonalLibrary);
router.get('/materials/:id', getMaterial);
router.post('/materials', protect, memoryUpload.fields([{ name: 'file', maxCount: 1 }, { name: 'coverPhoto', maxCount: 1 }]), uploadMaterial);
router.put('/materials/:id', protect, updateMaterial);
router.delete('/materials/:id', protect, deleteMaterial);
router.post('/materials/:id/save', protect, saveMaterial);
router.post('/materials/:id/download', protect, downloadMaterial);
router.post('/materials/:id/review', protect, addMaterialReview);

// Advanced Features
router.get('/cbt/:id', protect, getCBT);
router.get('/cbt/material/:materialId', protect, getCBTByMaterial);
router.get('/cbt/ai/all', protect, getAICBTs);
router.post('/cbt/submit', protect, submitCBT);
router.post('/summarize', protect, summarizeMaterial);

module.exports = router;
