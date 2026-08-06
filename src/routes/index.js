const express = require('express');
const authRoutes = require('./auth.routes');
const ticketRoutes = require('./ticket.routes');
const kbRoutes = require('./kb.routes');
const agentRoutes = require('./agent.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

router.get('/health', (req, res) =>
  res.json({ success: true, status: 'ok', time: new Date().toISOString() })
);

router.use('/auth', authRoutes);
router.use('/tickets', ticketRoutes);
router.use('/kb', kbRoutes);
router.use('/agent', agentRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
