const BugReport = require('../models/BugReport');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

exports.createBugReport = async (req, res) => {
    try {
        const { description, attachments } = req.body;
        const userId = req.user._id;

        const bugReport = await BugReport.create({
            userId,
            description,
            attachments: attachments || []
        });

        res.status(201).json({
            success: true,
            data: bugReport,
            message: 'Bug report submitted successfully'
        });
    } catch (error) {
        console.error('Create Bug Report Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getBugReports = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};

        if (status && status !== 'All') {
            query.status = status;
        }

        const bugReports = await BugReport.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('userId', 'name email matricNo avatar');

        const total = await BugReport.countDocuments(query);

        res.json({
            data: bugReports,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get Bug Reports Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updateBugReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, priority, adminNotes } = req.body;

        const bugReport = await BugReport.findByIdAndUpdate(
            id,
            { status, priority, adminNotes },
            { new: true }
        ).populate('userId', 'name email matricNo');

        if (!bugReport) {
            return res.status(404).json({ message: 'Bug report not found' });
        }

        // Send notification to user
        if (status && req.user) {
            const message = `Your bug report status has been updated to ${status.replace('_', ' ')}.`;

            await createNotification({
                userId: bugReport.userId._id,
                type: 'system',
                title: 'Bug Report Update',
                message,
                relatedId: bugReport._id.toString(),
                fromUserId: req.user._id
            });
        }

        res.json({
            success: true,
            data: bugReport,
            message: 'Bug report updated'
        });
    } catch (error) {
        console.error('Update Bug Report Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
