const express = require('express');
const router = express.Router();
const {
    getItems,
    getItem,
    createItem,
    updateItem,
    getUserItems,
    deleteItem,
    purchaseItem,
    claimFreeMerch
} = require('../controllers/marketController');
const { protect } = require('../middleware/authMiddleware');

router.get('/my-items', protect, getUserItems);
router.get('/items', getItems);
router.get('/items/:id', getItem);
router.post('/items', protect, createItem);
router.put('/items/:id', protect, updateItem);
router.delete('/items/:id', protect, deleteItem);
router.post('/items/:id/purchase', protect, purchaseItem);
router.post('/merch/:id/claim', protect, claimFreeMerch);

module.exports = router;
