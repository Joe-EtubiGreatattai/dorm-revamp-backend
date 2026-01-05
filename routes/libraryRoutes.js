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
    addMaterialReview
} = require('../controllers/libraryController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/faculties', getFaculties);
router.get('/materials', getMaterials);
router.get('/categories', getCategories);
router.get('/personal', protect, getPersonalLibrary);
router.get('/materials/:id', getMaterial);
router.post('/materials', protect, upload.single('file'), uploadMaterial);
router.put('/materials/:id', protect, updateMaterial);
router.delete('/materials/:id', protect, deleteMaterial);
router.post('/materials/:id/save', protect, saveMaterial);
router.post('/materials/:id/download', protect, downloadMaterial);
router.post('/materials/:id/review', protect, addMaterialReview);

// Advanced Features
router.get('/cbt/:id', protect, getCBT);
router.get('/cbt/material/:materialId', protect, getCBTByMaterial);
router.post('/cbt/submit', protect, submitCBT);
router.post('/summarize', protect, summarizeMaterial);

module.exports = router;
