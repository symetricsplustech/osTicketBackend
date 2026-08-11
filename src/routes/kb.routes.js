const express = require('express');
const ctrl = require('../controllers/kb.controller');
const { optionalUser } = require('../middleware/auth');

const router = express.Router();

router.use(optionalUser);

router.get('/categories', ctrl.categories);
router.get('/faqs', ctrl.faqs);
router.get('/faqs/:id', ctrl.faqDetail);
router.post('/faqs/:id/vote', ctrl.faqVote);
router.get('/announcements', ctrl.announcements);

module.exports = router;
