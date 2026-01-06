const FAQ = require('../models/FAQ');
const SupportTicket = require('../models/SupportTicket');

// === FAQ Controllers ===

exports.getFAQs = async (req, res) => {
    try {
        const faqs = await FAQ.find({ isActive: true });
        res.json(faqs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createFAQ = async (req, res) => {
    try {
        const faq = await FAQ.create(req.body);
        res.status(201).json(faq);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateFAQ = async (req, res) => {
    try {
        const faq = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(faq);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteFAQ = async (req, res) => {
    try {
        await FAQ.findByIdAndDelete(req.params.id);
        res.json({ message: 'FAQ deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// === Support Ticket Controllers ===

exports.getTickets = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        let query = {};

        // If not admin, only show own tickets
        if (req.user.role !== 'admin') {
            query.userId = req.user._id;
        }

        if (status) {
            query.status = status; // open/closed
        }

        const tickets = await SupportTicket.find(query)
            .sort({ lastMessageAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('userId', 'name email avatar');

        const total = await SupportTicket.countDocuments(query);

        res.json({
            data: tickets,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getTicket = async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id)
            .populate('userId', 'name email avatar');

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        // Auth check
        if (req.user.role !== 'admin' && ticket.userId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createTicket = async (req, res) => {
    try {
        const { subject, message } = req.body;

        const ticket = await SupportTicket.create({
            userId: req.user._id,
            subject,
            messages: [{
                sender: 'user',
                content: message,
                timestamp: new Date()
            }]
        });

        // Notify admins via socket?
        const io = req.app.get('io');
        if (io) {
            io.emit('support:new_ticket', ticket);
        }

        res.status(201).json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.addMessage = async (req, res) => {
    try {
        const { content, attachment } = req.body;
        const sender = req.user.role === 'admin' ? 'admin' : 'user';

        const ticket = await SupportTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        // Auth check
        if (req.user.role !== 'admin' && ticket.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (ticket.status === 'closed') {
            return res.status(400).json({ message: 'Ticket is closed' });
        }

        const newMessage = {
            sender,
            content,
            attachment,
            timestamp: new Date()
        };

        ticket.messages.push(newMessage);
        ticket.lastMessageAt = new Date();
        await ticket.save();

        // Socket emission
        const io = req.app.get('io');
        if (io) {
            const eventName = `support:message:${ticket._id}`;
            io.emit(eventName, newMessage); // Emit to room specific to ticket?
            // Or emit to user and admin channels
            if (sender === 'admin') {
                io.to(ticket.userId.toString()).emit('support:message', { ticketId: ticket._id, message: newMessage });
            } else {
                io.emit('support:admin_message', { ticketId: ticket._id, message: newMessage }); // Broadcast to all admins?
            }
        }

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.closeTicket = async (req, res) => {
    try {
        const ticket = await SupportTicket.findByIdAndUpdate(
            req.params.id,
            { status: 'closed' },
            { new: true }
        );
        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
