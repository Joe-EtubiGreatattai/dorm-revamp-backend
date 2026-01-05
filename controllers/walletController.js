const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Notification = require('../models/Notification');
const axios = require('axios'); // For Paystack API
const crypto = require('crypto');


// @desc    Get wallet balance
// @route   GET /api/wallet/balance
// @access  Private
const getBalance = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('walletBalance escrowBalance');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Top up wallet
// @route   POST /api/wallet/topup
// @access  Private
const topUp = async (req, res) => {
    try {
        const { amount, paymentMethod } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        // Create transaction record
        const transaction = await Transaction.create({
            userId: req.user._id,
            type: 'topup',
            amount,
            paymentMethod,
            status: 'completed'
        });

        // Update user wallet balance
        const user = await User.findById(req.user._id);
        user.walletBalance += amount;
        await user.save();

        res.json({
            message: 'Top up successful',
            balance: user.walletBalance,
            transaction
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Withdraw from wallet
// @route   POST /api/wallet/withdraw
// @access  Private
// @desc    Withdraw from wallet
// @route   POST /api/wallet/withdraw
// @access  Private
const withdraw = async (req, res) => {
    try {
        const { amount, bankDetails, bankAccountId, saveAccount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const user = await User.findById(req.user._id);

        if (user.walletBalance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        let finalBankDetails = bankDetails;

        // If bankAccountId provided, look it up
        if (bankAccountId) {
            const selectedAccount = user.bankAccounts.id(bankAccountId);
            if (!selectedAccount) {
                return res.status(400).json({ message: 'Bank account not found' });
            }
            finalBankDetails = {
                bank: selectedAccount.bankName,
                account: selectedAccount.accountNumber,
                accountName: selectedAccount.accountName
            };
        } else if (saveAccount && bankDetails) {
            // Save this new account for future use
            user.bankAccounts.push({
                bankName: bankDetails.bank,
                accountNumber: bankDetails.account,
                accountName: bankDetails.name || bankDetails.accountName
            });
            await user.save();
        }

        if (!finalBankDetails) {
            return res.status(400).json({ message: 'Bank details or valid account required' });
        }

        // Create transaction record
        const transaction = await Transaction.create({
            userId: req.user._id,
            type: 'withdrawal',
            amount,
            bankDetails: {
                bank: finalBankDetails.bank,
                account: finalBankDetails.account,
                accountName: finalBankDetails.name || finalBankDetails.accountName
            },
            status: 'pending'
        });

        // Update user wallet balance (DEDUCT IMMEDIATELY to prevent double withdrawal)
        user.walletBalance -= amount;
        await user.save();

        res.json({
            message: 'Withdrawal initiated and pending admin approval',
            balance: user.walletBalance,
            transaction
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all pending withdrawals (Admin)
// @route   GET /api/wallet/admin/withdrawals
// @access  Private/Admin
const getPendingWithdrawals = async (req, res) => {
    try {
        const withdrawals = await Transaction.find({ type: 'withdrawal', status: 'pending' })
            .populate('userId', 'name email phoneNumber')
            .sort({ createdAt: -1 });
        res.json(withdrawals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve withdrawal (Admin)
// @route   PATCH /api/wallet/admin/withdrawals/:id/approve
// @access  Private/Admin
const approveWithdrawal = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction || transaction.type !== 'withdrawal') {
            return res.status(404).json({ message: 'Withdrawal request not found' });
        }

        if (transaction.status !== 'pending') {
            return res.status(400).json({ message: `Cannot approve transaction in ${transaction.status} state` });
        }

        transaction.status = 'completed';
        await transaction.save();

        // Notify user
        try {
            await Notification.create({
                userId: transaction.userId,
                type: 'withdrawal_approved',
                title: 'Withdrawal Approved! 💸',
                message: `Your withdrawal of ₦${transaction.amount.toLocaleString()} has been approved and processed.`,
                relatedId: transaction._id
            });

            const io = req.app.get('io');
            if (io) {
                io.emit('notification:new', { userId: transaction.userId });
            }
        } catch (notifError) {
            console.error('Failed to send withdrawal approval notification:', notifError);
        }

        res.json({ message: 'Withdrawal approved successfully', transaction });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reject withdrawal (Admin)
// @route   PATCH /api/wallet/admin/withdrawals/:id/reject
// @access  Private/Admin
const rejectWithdrawal = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction || transaction.type !== 'withdrawal') {
            return res.status(404).json({ message: 'Withdrawal request not found' });
        }

        if (transaction.status !== 'pending') {
            return res.status(400).json({ message: `Cannot reject transaction in ${transaction.status} state` });
        }

        // Refund user
        const user = await User.findById(transaction.userId);
        if (user) {
            user.walletBalance += transaction.amount;
            await user.save();
        }

        transaction.status = 'failed';
        await transaction.save();

        // Notify user
        try {
            await Notification.create({
                userId: transaction.userId,
                type: 'withdrawal_rejected',
                title: 'Withdrawal Rejected ❌',
                message: `Your withdrawal of ₦${transaction.amount.toLocaleString()} was rejected and the funds have been returned to your wallet.`,
                relatedId: transaction._id
            });

            const io = req.app.get('io');
            if (io) {
                io.emit('notification:new', { userId: transaction.userId });
                io.emit('wallet:updated', { userId: transaction.userId, balance: user.walletBalance });
            }
        } catch (notifError) {
            console.error('Failed to send withdrawal rejection notification:', notifError);
        }

        res.json({ message: 'Withdrawal rejected and funds refunded', transaction });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get transaction history
// @route   GET /api/wallet/transactions
// @access  Private
const getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Initialize Paystack Transaction
// @route   POST /api/wallet/initialize
// @access  Private
const initializeTransaction = async (req, res) => {
    try {
        const { amount, email } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const params = {
            email: email || req.user.email,
            amount: amount * 100, // Paystack expects kobo
            callback_url: "http://192.168.0.130:5001/api/wallet/verify-callback"
            // In a real app, you might handle verification on the frontend or via webhook
        };

        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            params,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Paystack Init Error:', error.response?.data || error.message);
        res.status(500).json({ message: 'Payment initialization failed', error: error.message });
    }
};

// @desc    Verify Paystack Transaction
// @route   POST /api/wallet/verify
// @access  Private
const verifyTransaction = async (req, res) => {
    try {
        const { reference } = req.body;

        if (!reference) {
            return res.status(400).json({ message: 'Transaction reference required' });
        }

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        const apiData = response.data.data;

        if (apiData.status === 'success') {
            // Check if transaction already exists to avoid double credit
            const existingTx = await Transaction.findOne({ reference });
            if (existingTx) {
                return res.status(400).json({ message: 'Transaction already processed' });
            }

            // Credit wallet
            const amount = apiData.amount / 100; // Convert back to Naira
            const user = await User.findById(req.user._id);
            user.walletBalance += amount;
            await user.save();

            // Create Transaction Record
            const transaction = await Transaction.create({
                userId: req.user._id,
                type: 'topup',
                amount,
                paymentMethod: 'paystack',
                status: 'completed',
                reference // Save reference to prevent duplicates
            });

            res.json({ message: 'Wallet funded successfully', balance: user.walletBalance, transaction });
        } else {
            res.status(400).json({ message: 'Payment verification failed' });
        }

    } catch (error) {
        console.error('Paystack Verify Error:', error.response?.data || error.message);
        res.status(500).json({ message: 'Verification failed', error: error.message });
    }
};

// @desc    Handle Paystack Callback (GET)
// @route   GET /api/wallet/verify-callback
// @access  Public
const verifyTransactionCallback = async (req, res) => {
    try {
        // Just return a success page. The app handles the actual verification via API.
        // Or you could verify here if you wanted.
        const html = `
            <html>
                <head>
                    <title>Payment Successful</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; text-align: center; }
                        .container { padding: 20px; }
                        h1 { color: #10b981; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Payment Successful!</h1>
                        <p>You can now close this window and return to the Dorm app.</p>
                        <script>
                            // detailed verification could happen here
                        </script>
                    </div>
                </body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send('Error');
    }
};

// @desc    Handle Paystack Webhook
// @route   POST /api/wallet/webhook
// @access  Public (Protected by Signature)
const handlePaystackWebhook = async (req, res) => {
    try {
        // 1. Verify Signature
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            console.error('❌ [Webhook] Invalid Paystack signature');
            return res.status(401).json({ message: 'Invalid signature' });
        }

        const event = req.body;
        console.log(`📩 [Webhook] Received Paystack event: ${event.event}`);

        // 2. Handle successful charge
        if (event.event === 'charge.success') {
            const data = event.data;
            const reference = data.reference;
            const amount = data.amount / 100; // Convert kobo to Naira
            const email = data.customer.email;

            // Find user by email (or metadata if provided during initialization)
            const user = await User.findOne({ email });
            if (!user) {
                console.error(`❌ [Webhook] User not found for email: ${email}`);
                return res.status(404).json({ message: 'User not found' });
            }

            // check idempotency - ensure we don't process the same reference twice
            const existingTx = await Transaction.findOne({ reference });
            if (existingTx) {
                console.log(`⚠️ [Webhook] Transaction already processed: ${reference}`);
                return res.status(200).json({ message: 'Already processed' });
            }

            // Credit user wallet
            user.walletBalance += amount;
            await user.save();

            // Create Transaction record
            await Transaction.create({
                userId: user._id,
                type: 'topup',
                amount,
                paymentMethod: 'paystack',
                status: 'completed',
                reference
            });

            console.log(`✅ [Webhook] Wallet credited for ${email}: ₦${amount}`);

            // Emit socket event to notify user in real-time
            const io = req.app.get('io');
            if (io) {
                io.emit('wallet:updated', { userId: user._id, balance: user.walletBalance });
            }
        }

        // Paystack expects a 200 OK response
        res.status(200).json({ status: 'success' });

    } catch (error) {
        console.error('❌ [Webhook] Error:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getBalance,
    topUp,
    withdraw,
    getTransactions,
    initializeTransaction,
    verifyTransaction,
    verifyTransactionCallback,
    handlePaystackWebhook,
    getPendingWithdrawals,
    approveWithdrawal,
    rejectWithdrawal
};
