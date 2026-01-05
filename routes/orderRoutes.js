const express = require('express');
const router = express.Router();
const {
    getOrders,
    getOrder,
    updateStatus,
    confirmReceipt,
    cancelOrder
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/status', protect, updateStatus);
router.post('/:id/confirm', protect, confirmReceipt);
router.post('/:id/cancel', protect, cancelOrder);

module.exports = router;
