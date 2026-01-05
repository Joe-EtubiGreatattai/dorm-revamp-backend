const express = require('express');
const router = express.Router();
const {
    getUserItems,
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    purchaseItem
} = require('../controllers/marketController');
const { protect } = require('../middleware/authMiddleware');

router.get('/my-items', protect, getUserItems);
router.get('/items', getItems);
router.get('/items/:id', getItem);
router.post('/items', protect, createItem);
router.put('/items/:id', protect, updateItem);
router.delete('/items/:id', protect, deleteItem);
router.post('/items/:id/purchase', protect, purchaseItem);

module.exports = router;
