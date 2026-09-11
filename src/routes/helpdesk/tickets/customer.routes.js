const express = require('express');
const { protectTenantPrincipal } = require('../../../middleware/auth');
const { moduleRequired } = require('../../../middleware/module');
const { upload, scanUploads } = require('../../../config/multer');
const ctrl = require('../../../controllers/helpdesk/tickets/customer.controller');

const router = express.Router();

router.get('/open-form', protectTenantPrincipal, moduleRequired('helpdesk'), ctrl.openForm);
router.get('/check-status', protectTenantPrincipal, moduleRequired('helpdesk'), ctrl.checkTicketStatus);
router.get('/approvals', protectTenantPrincipal, moduleRequired('helpdesk'), ctrl.orgApprovals);
router.get('/', protectTenantPrincipal, moduleRequired('helpdesk'), ctrl.getMyTickets);
router.post('/', protectTenantPrincipal, moduleRequired('helpdesk'), upload.array('files', 5), scanUploads, ctrl.create);
router.get('/:number', protectTenantPrincipal, moduleRequired('helpdesk'), ctrl.viewTicket);
router.post('/:number/reply', protectTenantPrincipal, moduleRequired('helpdesk'), upload.array('files', 5), scanUploads, ctrl.reply);
router.post('/:number/close', protectTenantPrincipal, moduleRequired('helpdesk'), ctrl.closeTicket);
router.post('/:number/reopen', protectTenantPrincipal, moduleRequired('helpdesk'), ctrl.reopenTicket);
router.post('/:number/approval', protectTenantPrincipal, moduleRequired('helpdesk'), ctrl.decideTicketApproval);
router.delete('/:number', protectTenantPrincipal, moduleRequired('helpdesk'), ctrl.deleteTicket);

module.exports = router;
