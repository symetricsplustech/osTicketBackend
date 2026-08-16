const express = require('express');
const { protectUser, optionalUser } = require('../middleware/auth');
const { upload } = require('../config/multer');
const ctrl = require('../controllers/ticket.controller');

const router = express.Router();

router.get('/open-form', ctrl.openForm);
router.get('/check-status', ctrl.checkTicketStatus);
router.get('/', protectUser, ctrl.getMyTickets);
router.post('/', optionalUser, upload.array('files', 5), ctrl.create);
router.get('/:number', protectUser, ctrl.viewTicket);
router.post('/:number/reply', protectUser, upload.array('files', 5), ctrl.reply);
router.post('/:number/close', protectUser, ctrl.closeTicket);
router.post('/:number/reopen', protectUser, ctrl.reopenTicket);
router.post('/:number/merge', protectUser, ctrl.mergeTickets);
router.post('/:number/link', protectUser, ctrl.linkTickets);
router.post('/:number/refer', protectUser, ctrl.referTicket);
router.delete('/:number', protectUser, ctrl.deleteTicket);

module.exports = router;