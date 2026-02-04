const Restriction = require('../models/Restriction');
const User = require('../models/User');

// @desc    Create a restriction
// @route   POST /api/restrictions
// @access  Admin
const createRestriction = async (req, res) => {
    try {
        const { tab, scope, targetId, reason, filters } = req.body;

        console.log('\n🚫 [RESTRICTION] Creating new restriction:');
        console.log('   Tab:', tab);
        console.log('   Scope:', scope);
        console.log('   TargetId:', targetId);
        console.log('   Reason:', reason);
        console.log('   Filters:', filters);

        // Check for existing active restriction
        const existing = await Restriction.findOne({
            tab,
            scope,
            targetId: targetId || null,
            isActive: true
        });

        if (existing) {
            console.log('   ⚠️ Active restriction already exists\n');
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

        console.log('✅ [RESTRICTION] Created in DB with ID:', restriction._id);

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

            console.log('\n📡 [SOCKET] Emitting restriction:active event');
            console.log('   Payload:', JSON.stringify(payload, null, 2));

            if (scope === 'global') {
                console.log('   Broadcasting to: ALL USERS (global)');
                io.emit('restriction:active', payload);
            } else if (scope === 'school') {
                const room = `school_${targetId}`;
                console.log('   Broadcasting to room:', room);
                io.to(room).emit('restriction:active', payload);
            } else if (scope === 'user') {
                console.log('   Broadcasting to user:', targetId);
                io.to(targetId).emit('restriction:active', payload);
            }
            console.log('✅ [SOCKET] Event emitted successfully\n');
        } else {
            console.log('⚠️ [SOCKET] IO not available, cannot emit event\n');
        }

        res.status(201).json(restriction);
    } catch (error) {
        console.error('❌ [RESTRICTION] Error creating restriction:', error.message);
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
                { scope: 'school', targetId: user.university },
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
        console.log('\n🔓 [RESTRICTION] Deleting restriction:', req.params.id);

        const restriction = await Restriction.findById(req.params.id);
        if (!restriction) return res.status(404).json({ message: 'Restriction not found' });

        console.log('   Found restriction:');
        console.log('   Tab:', restriction.tab);
        console.log('   Scope:', restriction.scope);
        console.log('   TargetId:', restriction.targetId);

        await Restriction.findByIdAndDelete(req.params.id);
        console.log('✅ [RESTRICTION] Deleted from DB');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const payload = {
                tab: restriction.tab,
                scope: restriction.scope,
                targetId: restriction.targetId
            };

            console.log('\n📡 [SOCKET] Emitting restriction:lifted event');
            console.log('   Payload:', JSON.stringify(payload, null, 2));

            if (restriction.scope === 'global') {
                console.log('   Broadcasting to: ALL USERS (global)');
                io.emit('restriction:lifted', payload);
            } else if (restriction.scope === 'school') {
                const room = `school_${restriction.targetId}`;
                console.log('   Broadcasting to room:', room);
                io.to(room).emit('restriction:lifted', payload);
            } else if (restriction.scope === 'user') {
                console.log('   Broadcasting to user:', restriction.targetId);
                io.to(restriction.targetId.toString()).emit('restriction:lifted', payload);
            }
            console.log('✅ [SOCKET] Event emitted successfully\n');
        } else {
            console.log('⚠️ [SOCKET] IO not available, cannot emit event\n');
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
