const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const ticketRoutes = require('./helpdesk/tickets/customer.routes');
const kbRoutes = require('./helpdesk/knowledge');
const agentRoutes = require('./helpdesk/tickets/agent.routes');
const adminRoutes = require('./admin.routes');
const superadminRoutes = require('./superadmin.routes');
const publicRoutes = require('./helpdesk/public');
const rbacRoutes = require('./rbac.routes');
const coreTaskRoutes = require('./core/task');
const coreApprovalRoutes = require('./core/approval');
const coreAttachmentRoutes = require('./core/attachment');
const coreAuditRoutes = require('./core/auditEvent');
const coreIncidentRoutes = require('./core/incident');
const coreProblemRoutes = require('./core/problem');
const correlationId = require('../middleware/correlationId');

const router = express.Router();

router.use(correlationId);

router.get('/health', (req, res) =>
  res.json({ success: true, status: 'ok', time: new Date().toISOString(), correlationId: req.correlationId })
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tickets', ticketRoutes);
router.use('/kb', kbRoutes);
router.use('/agent', agentRoutes);
router.use('/admin', adminRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/public', publicRoutes);
router.use('/rbac', rbacRoutes);
router.use('/core/tasks', coreTaskRoutes);
router.use('/core/approvals', coreApprovalRoutes);
router.use('/core/attachments', coreAttachmentRoutes);
router.use('/core/audit', coreAuditRoutes);
router.use('/core/incidents', coreIncidentRoutes);
router.use('/core/problems', coreProblemRoutes);

module.exports = router;
