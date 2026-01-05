const express = require('express');
const router = express.Router();
const { getBalance, topUp, withdraw, getTransactions, initializeTransaction, verifyTransaction, verifyTransactionCallback, handlePaystackWebhook, getPendingWithdrawals, approveWithdrawal, rejectWithdrawal } = require('../controllers/walletController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/balance', protect, getBalance);
router.post('/topup', protect, topUp);
router.post('/withdraw', protect, withdraw);
router.get('/transactions', protect, getTransactions);
router.post('/initialize', protect, initializeTransaction);
router.post('/verify', protect, verifyTransaction);
router.get('/verify-callback', verifyTransactionCallback);
router.post('/webhook', handlePaystackWebhook);

// Admin Routes
router.get('/admin/withdrawals', protect, admin, getPendingWithdrawals);
router.patch('/admin/withdrawals/:id/approve', protect, admin, approveWithdrawal);
router.patch('/admin/withdrawals/:id/reject', protect, admin, rejectWithdrawal);

module.exports = router;
