const express = require('express');
const { optionalUser } = require('../middleware/auth');
const ctrl = require('../controllers/public.controller');

const router = express.Router();

// Public status page (white-labelable)
router.get('/status/:slug', ctrl.statusPage);
router.get('/my-status', optionalUser, ctrl.myStatus);

// Public omnichannel chat (guest start / send / read / close)
router.post('/chat/start', ctrl.chatStart);
router.get('/chat/:id/messages', ctrl.chatMessages);
router.post('/chat/:id/messages', ctrl.chatPost);
router.post('/chat/:id/close', ctrl.chatClose);

// CSAT submission from customer portal (ticket number based)
router.post('/csat/submit', ctrl.submitCsat);
router.get('/csat/ticket/:ticketNumber', ctrl.surveysForTicket);

// Customer-facing service catalog (optional auth for tenant scoping)
router.get('/service-catalog', optionalUser, ctrl.serviceCatalog);

module.exports = router;