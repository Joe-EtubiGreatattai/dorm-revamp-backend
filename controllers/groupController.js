const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const GroupInvitation = require('../models/GroupInvitation');
const { createNotification } = require('./notificationController');

// @desc    Create a new group
// @route   POST /api/chat/groups
// @access  Private
const createGroup = async (req, res) => {
    try {
        const { name, description, avatar, initialMembers } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Group name is required' });
        }

        const group = await Conversation.create({
            participants: [req.user._id], // Creator is the first participant
            type: 'group',
            groupMetadata: {
                name,
                description,
                avatar
            },
            creatorId: req.user._id,
            admins: [req.user._id],
            lastMessage: `Group "${name}" created`,
            lastMessageAt: Date.now()
        });

        // Create initial system message
        await Message.create({
            conversationId: group._id,
            senderId: req.user._id,
            content: `created group "${name}"`,
            type: 'system'
        });

        // If initial members provided, send invitations
        if (initialMembers && Array.isArray(initialMembers)) {
            const invitations = initialMembers.map(userId => ({
                groupId: group._id,
                inviterId: req.user._id,
                inviteeId: userId
            }));
            await GroupInvitation.insertMany(invitations);

            // Notify invitees (simplified)
            for (const userId of initialMembers) {
                await createNotification({
                    userId,
                    type: 'group_invite',
                    title: 'New Group Invitation',
                    message: `${req.user.name} invited you to join "${name}"`,
                    relatedId: group._id,
                    fromUserId: req.user._id
                });
            }
        }

        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Invite users to group
// @route   POST /api/chat/groups/:id/invite
// @access  Private
const inviteToGroup = async (req, res) => {
    try {
        const { userIds } = req.body;
        const groupId = req.params.id;

        const group = await Conversation.findById(groupId);
        if (!group || group.type !== 'group') {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if inviter is an admin
        if (!group.admins.includes(req.user._id)) {
            return res.status(403).json({ message: 'Only admins can invite members' });
        }

        const invitations = [];
        for (const userId of userIds) {
            // Check if already a member
            if (group.participants.includes(userId)) continue;

            // Check if already invited
            const existingInvite = await GroupInvitation.findOne({ groupId, inviteeId: userId, status: 'pending' });
            if (existingInvite) continue;

            invitations.push({
                groupId,
                inviterId: req.user._id,
                inviteeId: userId
            });

            await createNotification({
                userId,
                type: 'group_invite',
                title: 'Group Invitation',
                message: `${req.user.name} invited you to join "${group.groupMetadata.name}"`,
                relatedId: groupId,
                fromUserId: req.user._id
            });
        }

        if (invitations.length > 0) {
            await GroupInvitation.insertMany(invitations);
        }

        res.json({ message: 'Invitations sent successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Handle group invitation (Accept/Decline)
// @route   POST /api/chat/invitations/:id/:action
// @access  Private
const handleInvitation = async (req, res) => {
    try {
        const { id, action } = req.params; // id is invitationId, action is 'accept' or 'decline'

        const invitation = await GroupInvitation.findById(id).populate('groupId');
        if (!invitation) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        if (invitation.inviteeId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (action === 'accept') {
            invitation.status = 'accepted';
            await invitation.save();

            const group = await Conversation.findById(invitation.groupId);
            if (!group.participants.includes(req.user._id)) {
                group.participants.push(req.user._id);
                await group.save();

                // System message
                await Message.create({
                    conversationId: group._id,
                    senderId: req.user._id,
                    content: 'joined the group',
                    type: 'system'
                });
            }

            // Notify inviter
            await createNotification({
                userId: invitation.inviterId,
                type: 'group_accept',
                title: 'Invitation Accepted',
                message: `${req.user.name} accepted your invite to "${group.groupMetadata.name}"`,
                relatedId: group._id,
                fromUserId: req.user._id
            });

            return res.json({ message: 'Invitation accepted', group });
        } else {
            invitation.status = 'declined';
            await invitation.save();
            return res.json({ message: 'Invitation declined' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user's pending invitations
// @route   GET /api/chat/invitations
// @access  Private
const getInvitations = async (req, res) => {
    try {
        const invitations = await GroupInvitation.find({
            inviteeId: req.user._id,
            status: 'pending'
        }).populate({
            path: 'groupId',
            select: 'groupMetadata participants'
        }).populate('inviterId', 'name avatar');

        res.json(invitations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Leave Group
// @route   POST /api/chat/groups/:id/leave
// @access  Private
const leaveGroup = async (req, res) => {
    try {
        const groupId = req.params.id;
        const group = await Conversation.findById(groupId);

        if (!group || group.type !== 'group') {
            return res.status(404).json({ message: 'Group not found' });
        }

        group.participants = group.participants.filter(p => p.toString() !== req.user._id.toString());
        group.admins = group.admins.filter(p => p.toString() !== req.user._id.toString());

        await group.save();

        // System message
        await Message.create({
            conversationId: groupId,
            senderId: req.user._id,
            content: 'left the group',
            type: 'system'
        });

        res.json({ message: 'Left group successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createGroup,
    inviteToGroup,
    handleInvitation,
    getInvitations,
    leaveGroup
};
