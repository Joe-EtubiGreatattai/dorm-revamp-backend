const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, admin } = require('../middleware/authMiddleware');
const {
    getFAQs, createFAQ, updateFAQ, deleteFAQ,
    getTickets, getTicket, createTicket, addMessage, closeTicket,
    submitContactForm,
} = require('../controllers/supportController');

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many messages submitted. Please try again later.',
});

// Public contact form (no auth)
router.post('/contact', contactLimiter, submitContactForm);

// FAQs
router.get('/faqs', getFAQs);
router.post('/faqs', protect, admin, createFAQ);
router.put('/faqs/:id', protect, admin, updateFAQ);
router.delete('/faqs/:id', protect, admin, deleteFAQ);

// Tickets
router.get('/tickets', protect, getTickets);
router.post('/tickets', protect, createTicket);
router.get('/tickets/:id', protect, getTicket);
router.post('/tickets/:id/message', protect, addMessage);
router.put('/tickets/:id/close', protect, closeTicket);

module.exports = router;
