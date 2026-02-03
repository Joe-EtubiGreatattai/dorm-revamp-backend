const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { createNotification } = require('./notificationController');
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
// [REMOVED] - This endpoint was insecure and allowed arbitrary balance increases.
// Use initializeTransaction and verifyTransaction with Paystack instead.
const topUp = async (req, res) => {
    return res.status(403).json({ message: 'Direct top-up is disabled for security reasons. Please use the official payment gateway.' });
};

// @desc    Withdraw from wallet
// @route   POST /api/wallet/withdraw
// @access  Private
// @desc    Withdraw from wallet
// @route   POST /api/wallet/withdraw
// @access  Private
const withdraw = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { amount, bankDetails, bankAccountId, saveAccount } = req.body;

        if (!amount || amount <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Invalid amount' });
        }

        // ATOMIC UPDATE: Check balance and deduct in one operation
        const user = await User.findOneAndUpdate(
            { _id: req.user._id, walletBalance: { $gte: amount } },
            { $inc: { walletBalance: -amount } },
            { new: true, session }
        );

        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Insufficient balance or user not found' });
        }

        let finalBankDetails = bankDetails;

        // If bankAccountId provided, look it up
        if (bankAccountId) {
            const selectedAccount = user.bankAccounts.id(bankAccountId);
            if (!selectedAccount) {
                await session.abortTransaction();
                session.endSession();
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
            await user.save({ session });
        }

        if (!finalBankDetails) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Bank details or valid account required' });
        }

        // Create transaction record
        const transaction = await Transaction.create([{
            userId: req.user._id,
            type: 'withdrawal',
            amount,
            bankDetails: {
                bank: finalBankDetails.bank,
                account: finalBankDetails.account,
                accountName: finalBankDetails.name || finalBankDetails.accountName
            },
            status: 'pending'
        }], { session });

        await session.commitTransaction();
        session.endSession();

        res.json({
            message: 'Withdrawal initiated and pending admin approval',
            balance: user.walletBalance,
            transaction: transaction[0]
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};



// @desc    Transfer funds to another user
// @route   POST /api/wallet/transfer
// @access  Private
const transfer = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { recipientId, amount, description } = req.body;
        const senderId = req.user._id;

        if (!amount || amount <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Invalid amount' });
        }

        if (recipientId === senderId.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Cannot transfer to yourself' });
        }

        // 1. ATOMIC UPDATE: Deduct from sender with balance check
        const sender = await User.findOneAndUpdate(
            { _id: senderId, walletBalance: { $gte: amount } },
            { $inc: { walletBalance: -amount } },
            { new: true, session }
        );

        if (!sender) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Insufficient balance or sender not found' });
        }

        const recipient = await User.findById(recipientId).session(session);

        if (!recipient) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Recipient not found' });
        }

        const pairingId = crypto.randomBytes(16).toString('hex');

        // 2. Create Transaction for Sender (Status: pending_acceptance)
        const senderTx = await Transaction.create([{
            userId: senderId,
            type: 'transfer_out',
            amount: -amount,
            relatedUserId: recipientId,
            description: description || 'Transfer to ' + recipient.name,
            status: 'pending_acceptance',
            pairingId
        }], { session });

        // 3. Create Transaction for Recipient (Status: pending_acceptance)
        await Transaction.create([{
            userId: recipientId,
            type: 'transfer_in',
            amount: amount,
            relatedUserId: senderId,
            description: description || 'Received from ' + sender.name,
            status: 'pending_acceptance',
            pairingId
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // 4. Notification for Recipient (Non-blocking outside transaction)
        try {
            await createNotification({
                userId: recipientId,
                type: 'payment_request',
                title: 'Money Received',
                message: `${sender.name} sent you ₦${amount.toLocaleString()}. Tap here to accept or reject.`,
                relatedId: senderTx[0]._id,
                fromUserId: senderId
            });

            // 5. Send Chat Message (reflection of transfer in conversation)
            const Conversation = require('../models/Conversation');
            let conv = await Conversation.findOne({
                participants: { $all: [senderId, recipientId] }
            });

            if (!conv) {
                conv = await Conversation.create({
                    participants: [senderId, recipientId]
                });
            }

            const chatMsg = await Message.create({
                conversationId: conv._id,
                senderId: senderId,
                receiverId: recipientId,
                content: `Sent ₦${amount.toLocaleString()}`,
                type: 'transfer',
                transactionId: senderTx[0]._id
            });

            const io = req.app.get('io');
            if (io) {
                io.to(conv._id.toString()).emit('message:new', chatMsg);
                io.to(recipientId.toString()).emit('notification:message', {
                    senderId: senderId,
                    senderName: sender.name,
                    content: chatMsg.content,
                    conversationId: conv._id,
                    message: chatMsg
                });
            }
        } catch (err) {
            console.error('Post-transfer tasks error', err);
        }

        res.json({
            message: 'Transfer initiated. Waiting for recipient to accept.',
            balance: sender.walletBalance,
            transaction: senderTx[0]
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Transfer error:', error);
        res.status(500).json({ message: 'Transfer failed', error: error.message });
    }
};

// @desc    Accept Transfer
// @route   POST /api/wallet/transfer/:id/accept
// @access  Private
const acceptTransfer = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const senderTxId = req.params.id;
        const senderTx = await Transaction.findById(senderTxId).session(session);

        if (!senderTx || senderTx.status !== 'pending_acceptance') {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Transaction not found or already processed' });
        }

        // Verify that the current user is indeed the recipient
        if (senderTx.relatedUserId.toString() !== req.user._id.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'Not authorized to accept this transfer' });
        }

        // ATOMIC UPDATE: Credit Recipient
        const amountToCredit = Math.abs(senderTx.amount);
        const recipient = await User.findOneAndUpdate(
            { _id: req.user._id },
            { $inc: { walletBalance: amountToCredit } },
            { new: true, session }
        );

        if (!recipient) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Recipient not found' });
        }

        // Update Sender Transaction
        senderTx.status = 'completed';
        await senderTx.save({ session });

        // Update Recipient Transaction (Using pairingId or search)
        const recipientTx = await Transaction.findOne({
            userId: req.user._id,
            pairingId: senderTx.pairingId,
            type: 'transfer_in',
            status: 'pending_acceptance'
        }).session(session);

        if (recipientTx) {
            recipientTx.status = 'completed';
            await recipientTx.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        // Mark notification as actioned (Non-blocking)
        try {
            await Notification.updateMany(
                { userId: req.user._id, relatedId: senderTx._id, type: 'payment_request' },
                { isActioned: true, isRead: true }
            );
        } catch (err) {
            console.error('Error updating notification status:', err);
        }

        // Notify Sender
        try {
            const sender = await User.findById(senderTx.userId);
            await createNotification({
                userId: senderTx.userId,
                type: 'payment_accepted',
                title: 'Transfer Accepted ✅',
                message: `${recipient.name} accepted your transfer of ₦${amountToCredit.toLocaleString()}.`,
                relatedId: senderTx._id,
                fromUserId: recipient._id
            });

            const io = req.app.get('io');
            if (io) {
                io.emit('wallet:updated', { userId: recipient._id, balance: recipient.walletBalance });
                io.emit('wallet:updated', { userId: senderTx.userId, balance: sender.walletBalance });

                // Also update the chat message if it exists
                const chatMsg = await Message.findOne({ transactionId: senderTx._id });
                if (chatMsg) {
                    chatMsg.isRead = true; // Optional: mark as read
                    // In a more complex setup, we might update content or status field
                    io.to(chatMsg.conversationId.toString()).emit('message:new', chatMsg); // Re-emit or a specific status update event
                }
            }
        } catch (err) {
            console.error('Notification error', err);
        }

        res.json({ message: 'Transfer accepted', balance: recipient.walletBalance });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reject Transfer
// @route   POST /api/wallet/transfer/:id/reject
// @access  Private
const rejectTransfer = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const senderTxId = req.params.id;
        const senderTx = await Transaction.findById(senderTxId).session(session);

        if (!senderTx || senderTx.status !== 'pending_acceptance') {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Transaction not found or already processed' });
        }

        // Verify that the current user is indeed the recipient
        if (senderTx.relatedUserId.toString() !== req.user._id.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'Not authorized to reject this transfer' });
        }

        // ATOMIC UPDATE: Refund Sender
        const amountToRefund = Math.abs(senderTx.amount);
        const sender = await User.findOneAndUpdate(
            { _id: senderTx.userId },
            { $inc: { walletBalance: amountToRefund } },
            { new: true, session }
        );

        const recipient = await User.findById(req.user._id).session(session);

        // Update Sender Transaction
        senderTx.status = 'rejected';
        await senderTx.save({ session });

        // Update Recipient Transaction
        const recipientTx = await Transaction.findOne({
            userId: req.user._id,
            pairingId: senderTx.pairingId,
            type: 'transfer_in',
            status: 'pending_acceptance'
        }).session(session);

        if (recipientTx) {
            recipientTx.status = 'rejected';
            await recipientTx.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        // Mark notification as actioned (Non-blocking)
        try {
            await Notification.updateMany(
                { userId: req.user._id, relatedId: senderTx._id, type: 'payment_request' },
                { isActioned: true, isRead: true }
            );
        } catch (err) {
            console.error('Error updating notification status:', err);
        }

        // Notify Sender
        try {
            await createNotification({
                userId: senderTx.userId,
                type: 'payment_rejected',
                title: 'Transfer Rejected ❌',
                message: `${recipient.name} rejected your transfer of ₦${amountToRefund.toLocaleString()}. Funds have been returned to your wallet.`,
                relatedId: senderTx._id,
                fromUserId: recipient._id
            });

            const io = req.app.get('io');
            if (io) {
                // Update sender balance in real-time
                io.emit('wallet:updated', { userId: senderTx.userId, balance: sender.walletBalance });

                // Update chat message
                const chatMsg = await Message.findOne({ transactionId: senderTx._id });
                if (chatMsg) {
                    io.to(chatMsg.conversationId.toString()).emit('message:new', chatMsg);
                }
            }
        } catch (err) {
            console.error('Notification error', err);
        }

        res.json({ message: 'Transfer rejected' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
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
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const transaction = await Transaction.findById(req.params.id).session(session);
        if (!transaction || transaction.type !== 'withdrawal') {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Withdrawal request not found' });
        }

        if (transaction.status !== 'pending') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Cannot reject transaction in ${transaction.status} state` });
        }

        // ATOMIC UPDATE: Refund user
        const user = await User.findOneAndUpdate(
            { _id: transaction.userId },
            { $inc: { walletBalance: transaction.amount } },
            { new: true, session }
        );

        transaction.status = 'failed';
        await transaction.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Notify user (Non-blocking)
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
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get transaction history
// @route   GET /api/wallet/transactions
// @access  Private
const getTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const transactions = await Transaction.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('relatedUserId', 'name avatar matricNo');

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
            callback_url: "https://dorm-revamp-backend-j4ed.onrender.com/api/wallet/verify-callback"
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
            // SECURITY FIX: Check if the transaction belongs to the current user
            // Paystack stores the customer email in the transaction data
            if (apiData.customer.email.toLowerCase() !== req.user.email.toLowerCase()) {
                console.error(`❌ [Security] Paystack verification email mismatch. Expected: ${req.user.email}, Got: ${apiData.customer.email}`);
                return res.status(403).json({ message: 'This transaction record does not belong to you.' });
            }

            // Check if transaction already exists to avoid double credit
            const existingTx = await Transaction.findOne({ reference });
            if (existingTx) {
                return res.status(400).json({ message: 'Transaction already processed' });
            }

            // ATOMIC UPDATE: Use findOneAndUpdate with $inc
            const amount = apiData.amount / 100; // Convert back to Naira
            const user = await User.findOneAndUpdate(
                { _id: req.user._id },
                { $inc: { walletBalance: amount } },
                { new: true }
            );

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Create Transaction Record
            const transaction = await Transaction.create({
                userId: req.user._id,
                type: 'topup',
                amount,
                paymentMethod: 'paystack',
                status: 'completed',
                reference // Save reference for idempotency
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
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // 1. Verify Signature
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            console.error('❌ [Webhook] Invalid Paystack signature');
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({ message: 'Invalid signature' });
        }

        const event = req.body;

        // 2. Handle successful charge
        if (event.event === 'charge.success') {
            const data = event.data;
            const reference = data.reference;
            const amount = data.amount / 100; // Convert kobo to Naira
            const email = data.customer.email;

            // check idempotency - ensure we don't process the same reference twice
            const existingTx = await Transaction.findOne({ reference }).session(session);
            if (existingTx) {
                await session.abortTransaction();
                session.endSession();
                return res.status(200).json({ message: 'Already processed' });
            }

            // ATOMIC UPDATE: Credit user wallet
            const user = await User.findOneAndUpdate(
                { email: email.toLowerCase() },
                { $inc: { walletBalance: amount } },
                { new: true, session }
            );

            if (!user) {
                console.error(`❌ [Webhook] User not found for email: ${email}`);
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ message: 'User not found' });
            }

            // Create Transaction record
            await Transaction.create([{
                userId: user._id,
                type: 'topup',
                amount,
                paymentMethod: 'paystack',
                status: 'completed',
                reference
            }], { session });

            await session.commitTransaction();
            session.endSession();


            // Emit socket event (Non-blocking)
            const io = req.app.get('io');
            if (io) {
                io.emit('wallet:updated', { userId: user._id, balance: user.walletBalance });
            }
        } else {
            // Not a charge.success event, just end correctly
            await session.commitTransaction();
            session.endSession();
        }

        res.status(200).json({ status: 'success' });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('❌ [Webhook] Error:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getBalance,
    topUp,
    transfer,
    acceptTransfer,
    rejectTransfer,
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
