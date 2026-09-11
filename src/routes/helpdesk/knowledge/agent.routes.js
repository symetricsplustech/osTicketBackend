const express = require('express');
const { requirePermission } = require('../../../middleware/auth');
const { moduleRequired } = require('../../../middleware/module');
const ctrl = require('../../../controllers/helpdesk');
const publicCtrl = require('../../../controllers/helpdesk/knowledge/public.controller');
const Faq = require('../../../models/helpdesk/knowledge/Faq');

const router = express.Router();

router.get('/canned', ctrl.listCanned);
router.post('/canned', ctrl.createCanned);
router.put('/canned/:id', ctrl.updateCanned);
router.delete('/canned/:id', ctrl.deleteCanned);
router.post('/canned/:id/render', ctrl.renderCanned);
router.get('/kb/suggest', publicCtrl.suggestForAgent);
router.get('/faq-categories', moduleRequired('helpdesk'), requirePermission('kb.manage'), ctrl.listFaqCategories);
router.post('/faq-categories', moduleRequired('helpdesk'), requirePermission('kb.manage'), ctrl.createFaqCategory);
router.get('/faqs', moduleRequired('helpdesk'), requirePermission('kb.manage'), ctrl.listFaqs);
router.post('/faqs', moduleRequired('helpdesk'), requirePermission('kb.manage'), ctrl.createFaq);
router.put('/faqs/:id', moduleRequired('helpdesk'), requirePermission('kb.manage'), ctrl.updateFaq);
router.post('/faqs/:id/transition', moduleRequired('helpdesk'), requirePermission('kb.manage'), ctrl.transitionFaq);
router.delete('/faqs/:id', moduleRequired('helpdesk'), requirePermission('kb.manage'), ctrl.deleteFaq);

router.get('/kb/deflection', moduleRequired('helpdesk'), async (req, res, next) => {
  try {
    const q = { company: req.companyId, isPublished: true };
    if (req.query.faqId) q._id = req.query.faqId;
    const faqs = await Faq.find(q).select('question views helpful notHelpful').lean();
    const articles = faqs.map((faq) => ({
      faqId: faq._id,
      subject: faq.question,
      views: faq.views || 0,
      votesUp: faq.helpful || 0,
      votesDown: faq.notHelpful || 0,
      deflectionRate: faq.views ? Math.round(((faq.helpful || 0) / faq.views) * 100) : 0,
    }));
    const totalViews = articles.reduce((sum, article) => sum + article.views, 0);
    const totalDeflected = articles.reduce((sum, article) => sum + article.votesUp, 0);
    res.json({
      totalViews,
      totalDeflected,
      overallDeflectionRate: totalViews ? Math.round((totalDeflected / totalViews) * 100) : 0,
      articles,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/announcements', ctrl.listAnnouncements);
router.post('/announcements', ctrl.createAnnouncement);
router.delete('/announcements/:id', ctrl.deleteAnnouncement);

module.exports = router;
