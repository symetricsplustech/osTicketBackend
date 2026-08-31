const express = require('express');
const { protectTenantPrincipal } = require('../middleware/auth');
const { upload } = require('../config/multer');
const ctrl = require('../controllers/ticket.controller');

const router = express.Router();

router.get('/open-form', protectTenantPrincipal, ctrl.openForm);
router.get('/check-status', ctrl.checkTicketStatus);
router.get('/', protectTenantPrincipal, ctrl.getMyTickets);
router.post('/', protectTenantPrincipal, upload.array('files', 5), ctrl.create);
router.get('/:number', protectTenantPrincipal, ctrl.viewTicket);
router.post('/:number/reply', protectTenantPrincipal, upload.array('files', 5), ctrl.reply);
router.post('/:number/close', protectTenantPrincipal, ctrl.closeTicket);
router.post('/:number/reopen', protectTenantPrincipal, ctrl.reopenTicket);
router.post('/:number/merge', protectTenantPrincipal, ctrl.mergeTickets);
router.post('/:number/link', protectTenantPrincipal, ctrl.linkTickets);
router.post('/:number/refer', protectTenantPrincipal, ctrl.referTicket);
router.delete('/:number', protectTenantPrincipal, ctrl.deleteTicket);

module.exports = router;
