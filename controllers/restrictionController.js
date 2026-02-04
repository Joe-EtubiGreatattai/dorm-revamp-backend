const Restriction = require('../models/Restriction');
const User = require('../models/User');

// @desc    Create a restriction
// @route   POST /api/restrictions
// @access  Admin
const createRestriction = async (req, res) => {
    try {
        const { tab, scope, targetId, reason, filters } = req.body;

        // Check for existing active restriction
        const existing = await Restriction.findOne({
            tab,
            scope,
            targetId: targetId || null,
            isActive: true
        });

        if (existing) {
            return res.status(400).json({ message: 'Active restriction already exists for this target.' });
        }

        const restriction = await Restriction.create({
            tab,
            scope,
            targetId: targetId || null,
            reason,
            filters: filters || {},
            createdBy: req.user._id
        });

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const payload = {
                tab,
                scope,
                targetId,
                reason,
                filters: filters || {},
                isActive: true
            };

            if (scope === 'global') {
                io.emit('restriction:active', payload);
            } else if (scope === 'school') {
                io.to(`school_${targetId}`).emit('restriction:active', payload);
            } else if (scope === 'user') {
                io.to(targetId).emit('restriction:active', payload);
            }
        }
    }

        res.status(201).json(restriction);
} catch (error) {
    res.status(500).json({ message: error.message });
}
};

// @desc    Get active restrictions for current user
// @route   GET /api/restrictions/my
// @access  Private
const getMyRestrictions = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const restrictions = await Restriction.find({
            isActive: true,
            $or: [
                { scope: 'global' },
                { scope: 'school', targetId: user.schoolId }, // Assuming user has schoolId
                { scope: 'user', targetId: user._id }
            ]
        });

        res.json(restrictions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all restrictions (Admin)
// @route   GET /api/restrictions
// @access  Admin
const getAllRestrictions = async (req, res) => {
    try {
        const restrictions = await Restriction.find().sort({ createdAt: -1 });
        res.json(restrictions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete/Deactivate restriction
// @route   DELETE /api/restrictions/:id
// @access  Admin
const deleteRestriction = async (req, res) => {
    try {
        const restriction = await Restriction.findById(req.params.id);
        if (!restriction) return res.status(404).json({ message: 'Restriction not found' });

        // Hard delete or Soft delete? Requirement implied turning off.
        // We'll remove it to keep table clean or toggle isActive.
        // Let's hard delete for simplicity or deactivate.

        await Restriction.findByIdAndDelete(req.params.id);

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const payload = {
                tab: restriction.tab,
                scope: restriction.scope,
                targetId: restriction.targetId
            };

            if (restriction.scope === 'global') {
                io.emit('restriction:lifted', payload);
            } else if (restriction.scope === 'school') {
                io.to(`school_${restriction.targetId}`).emit('restriction:lifted', payload);
            } else if (restriction.scope === 'user') {
                io.to(restriction.targetId.toString()).emit('restriction:lifted', payload);
            }
        }

        res.json({ message: 'Restriction removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createRestriction,
    getMyRestrictions,
    getAllRestrictions,
    deleteRestriction
};
