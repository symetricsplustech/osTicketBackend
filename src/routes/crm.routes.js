const express = require('express');
const { protectAgent, protectAdmin } = require('../middleware/auth');
const { moduleRequired } = require('../middleware/module');
const mongoose = require('mongoose');

const router = express.Router();

// --- Leads ---
router.get('/leads', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Lead = require('../models/Lead');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { search, page = 1, limit = 50 } = req.query;
    const query = { company: tenantId };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }, { company_name: { $regex: search, $options: 'i' } }];
    const skip = (Number(page) - 1) * Number(limit);
    const [leads, total] = await Promise.all([Lead.find(query).sort('-createdAt').skip(skip).limit(Number(limit)), Lead.countDocuments(query)]);
    res.json({ leads, total, page: Number(page), limit: Number(limit) });
  } catch (e) { next(e); }
});

router.get('/leads/:id', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Lead = require('../models/Lead');
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ lead });
  } catch (e) { next(e); }
});

router.post('/leads', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Lead = require('../models/Lead');
    const tenantId = req.user.tenantId || req.user.companyId;
    const lead = await Lead.create({ ...req.body, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ lead });
  } catch (e) { next(e); }
});

router.put('/leads/:id', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Lead = require('../models/Lead');
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ lead });
  } catch (e) { next(e); }
});

router.delete('/leads/:id', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Lead = require('../models/Lead');
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post('/leads/:id/convert', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Lead = require('../models/Lead');
    const Company = require('../models/Company');
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    const account = await Company.create({ name: lead.company_name || lead.name, email: lead.email, phone: lead.phone, company: lead.company });
    lead.status = 'converted';
    lead.convertedTo = account._id;
    lead.convertedAt = new Date();
    await lead.save();
    res.json({ lead, account });
  } catch (e) { next(e); }
});

// --- Opportunities ---
router.get('/opportunities', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Opportunity = require('../models/Opportunity');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { search, stage } = req.query;
    const query = { company: tenantId };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }];
    if (stage) query.stage = stage;
    const opportunities = await Opportunity.find(query).sort('-createdAt').populate('account', 'name').populate('assignedTo', 'name');
    res.json({ opportunities });
  } catch (e) { next(e); }
});

router.get('/opportunities/:id', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Opportunity = require('../models/Opportunity');
    const opp = await Opportunity.findById(req.params.id).populate('account', 'name').populate('assignedTo', 'name email');
    if (!opp) return res.status(404).json({ message: 'Opportunity not found' });
    res.json({ opportunity: opp });
  } catch (e) { next(e); }
});

router.post('/opportunities', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Opportunity = require('../models/Opportunity');
    const tenantId = req.user.tenantId || req.user.companyId;
    const opp = await Opportunity.create({ ...req.body, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ opportunity: opp });
  } catch (e) { next(e); }
});

router.put('/opportunities/:id', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Opportunity = require('../models/Opportunity');
    const opp = await Opportunity.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!opp) return res.status(404).json({ message: 'Opportunity not found' });
    res.json({ opportunity: opp });
  } catch (e) { next(e); }
});

router.delete('/opportunities/:id', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Opportunity = require('../models/Opportunity');
    await Opportunity.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// --- Quotes ---
router.get('/quotes', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Quote = require('../models/Quote');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { search } = req.query;
    const query = { company: tenantId };
    if (search) query.number = { $regex: search, $options: 'i' };
    const quotes = await Quote.find(query).sort('-createdAt').populate('account', 'name');
    res.json({ quotes });
  } catch (e) { next(e); }
});

router.post('/quotes', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Quote = require('../models/Quote');
    const tenantId = req.user.tenantId || req.user.companyId;
    const count = await Quote.countDocuments({ company: tenantId });
    const number = `Q-${String(count + 1).padStart(5, '0')}`;
    const quote = await Quote.create({ ...req.body, number, company: tenantId, createdBy: req.user._id });
    res.status(201).json({ quote });
  } catch (e) { next(e); }
});

router.put('/quotes/:id', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const Quote = require('../models/Quote');
    const quote = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    res.json({ quote });
  } catch (e) { next(e); }
});

// --- Activities ---
router.get('/activities', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const CrmActivity = require('../models/CrmActivity');
    const tenantId = req.user.tenantId || req.user.companyId;
    const { lead, opportunity, account } = req.query;
    const query = { company: tenantId };
    if (lead) query.lead = lead;
    if (opportunity) query.opportunity = opportunity;
    if (account) query.account = account;
    const activities = await CrmActivity.find(query).sort('-createdAt').populate('agent', 'name');
    res.json({ activities });
  } catch (e) { next(e); }
});

router.post('/activities', protectAgent, moduleRequired('crm'), async (req, res, next) => {
  try {
    const CrmActivity = require('../models/CrmActivity');
    const tenantId = req.user.tenantId || req.user.companyId;
    const activity = await CrmActivity.create({ ...req.body, company: tenantId, agent: req.user._id });
    res.status(201).json({ activity });
  } catch (e) { next(e); }
});

module.exports = router;
