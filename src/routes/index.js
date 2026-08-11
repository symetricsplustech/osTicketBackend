const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const ticketRoutes = require('./ticket.routes');
const kbRoutes = require('./kb.routes');
const agentRoutes = require('./agent.routes');
const adminRoutes = require('./admin.routes');
const superadminRoutes = require('./superadmin.routes');

const router = express.Router();

router.get('/health', (req, res) =>
  res.json({ success: true, status: 'ok', time: new Date().toISOString() })
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tickets', ticketRoutes);
router.use('/kb', kbRoutes);
router.use('/agent', agentRoutes);
router.use('/admin', adminRoutes);
router.use('/superadmin', superadminRoutes);

module.exports = router;
