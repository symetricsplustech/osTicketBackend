const asyncHandler = require('../utils/asyncHandler');
const statusPageService = require('../services/statusPage.service');
const chatService = require('../services/chat.service');
const csatService = require('../services/csat.service');
const Ticket = require('../models/Ticket');
const Survey = require('../models/Survey');
const ServiceCatalogItem = require('../models/ServiceCatalogItem');
const ApiError = require('../utils/ApiError');

// Public status page (no auth) — white-labelable via slug + branding
exports.statusPage = asyncHandler(async (req, res) => {
  const data = await statusPageService.publicStatus(req.params.slug);
  if (!data) throw new ApiError(404, 'Status page not found');
  res.json({ success: true, ...data });
});

// Tenant's own status page for the logged-in customer portal
exports.myStatus = asyncHandler(async (req, res) => {
  const company = req.companyId || req.user?.company || null;
  const StatusPage = require('../models/StatusPage');
  let page = await StatusPage.findOne({ company: company || null });
  if (!page) page = await StatusPage.findOne({ isPublic: true }).sort({ createdAt: 1 });
  if (!page) throw new ApiError(404, 'Status page not found');
  const data = await statusPageService.publicStatus(page.slug);
  res.json({ success: true, ...data });
});

// Guest / registered chat start
exports.chatStart = asyncHandler(async (req, res) => {
  const { company: companyBody, companyId, userId, guestName, guestEmail, guestPhone, subject, channel } = req.body;
  let company = companyBody || companyId;
  if (!company && !userId) {
    const Company = require('../models/Company');
    company = (await Company.findOne().sort({ createdAt: 1 }))?._id || null;
  }
  const conversation = await chatService.startConversation({
    company: company || null,
    channel: channel || 'chat',
    userId: userId || null,
    guestName: guestName || '',
    guestEmail: guestEmail || '',
    guestPhone: guestPhone || '',
    subject: subject || '',
  });
  res.status(201).json({ success: true, item: conversation });
});

exports.chatMessages = asyncHandler(async (req, res) => {
  const data = await chatService.conversationDetail(req.params.id);
  if (!data) throw new ApiError(404, 'Conversation not found');
  res.json({ success: true, ...data });
});

exports.chatPost = asyncHandler(async (req, res) => {
  const { body, userId, guestEmail, guestName, subject } = req.body;
  if (!body) throw new ApiError(422, 'Message body required');
  let conversation = await require('../models/Conversation').findById(req.params.id);
  if (!conversation) throw new ApiError(404, 'Conversation not found');
  const Company = require('../models/Company');
  const fallbackCompany = conversation.company || (await Company.findOne().sort({ createdAt: 1 }))?._id || null;
  const ticketService = require('../services/ticket.service');
  let user = null;
  if (userId) user = await require('../models/User').findById(userId);
  else if (guestEmail) {
    user = await ticketService.findOrCreateUser({ name: guestName || guestEmail.split('@')[0], email: guestEmail, company: fallbackCompany });
    conversation.user = user._id;
    await conversation.save();
  }
  const message = await chatService.postMessage({
    company: fallbackCompany,
    conversationId: conversation._id,
    sender: 'user',
    userId: user?._id || null,
    body,
  });
  // Virtual agent auto-reply: runs after the user message so the bot can
  // answer status / knowledge / hours / request intents without an agent.
  const applyBotReply = req.query.bot !== 'false';
  if (applyBotReply) {
    try {
      const { virtualAgent } = require('../services/virtualAgent.service');
      const bot = await virtualAgent({
        company: fallbackCompany,
        userId: user?._id || null,
        conversationId: conversation._id,
        userText: body,
      });
      if (bot.response) {
        await chatService.postMessage({
          company: fallbackCompany,
          conversationId: conversation._id,
          sender: 'system',
          userId: null,
          body: bot.response,
        });
      }
    } catch (_) { /* bot failure is non-fatal */ }
  }
  res.status(201).json({ success: true, item: message });
});

exports.chatClose = asyncHandler(async (req, res) => {
  const Conversation = require('../models/Conversation');
  const conv = await Conversation.findByIdAndUpdate(req.params.id, { $set: { status: 'closed' } }, { new: true });
  if (!conv) throw new ApiError(404, 'Conversation not found');
  res.json({ success: true, item: conv });
});

// CSAT submission from the customer portal (ticket number + rating, optionally survey id)
exports.submitCsat = asyncHandler(async (req, res) => {
  const { ticketNumber, rating, comment, surveyId } = req.body;
  if (!ticketNumber || rating == null) throw new ApiError(422, 'ticketNumber and rating required');
  const ticket = await Ticket.findOne({ number: String(ticketNumber).toUpperCase() });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const survey = surveyId ? await Survey.findById(surveyId) : await Survey.findOne({ company: ticket.company, type: 'csat', isActive: true });
  if (!survey) throw new ApiError(404, 'No CSAT survey configured');
  const response = await csatService.submitResponse({
    company: ticket.company,
    surveyId: survey._id,
    ticketId: ticket._id,
    userId: ticket.user,
    rating,
    comment: comment || '',
  });
  res.status(201).json({ success: true, item: response });
});

// Embeddable website form config (§8): public topics, priorities, custom
// fields and support inboxes for a tenant — no auth, public data only.
exports.formConfig = asyncHandler(async (req, res) => {
  const Company = require('../models/Company');
  const company = req.query.company
    ? await Company.findById(req.query.company).select('name supportEmail email domain')
    : await Company.findOne().sort({ createdAt: 1 }).select('name supportEmail email domain');
  if (!company) throw new ApiError(404, 'Company not found');
  const HelpTopic = require('../models/HelpTopic');
  const Department = require('../models/Department');
  const CustomField = require('../models/CustomField');
  const [topics, departments, fields] = await Promise.all([
    HelpTopic.find({ status: 'active', isPublic: true, $or: [{ company: company._id }, { company: null }] }).sort({ topic: 1 }).select('topic description'),
    Department.find({ status: 'active', email: { $ne: '' }, $or: [{ company: company._id }, { company: null }] }).sort({ name: 1 }).select('name email'),
    CustomField.find({ isActive: true, $or: [{ company: company._id }, { company: null }] }).sort({ sortOrder: 1 }),
  ]);
  res.json({
    success: true,
    company: { _id: company._id, name: company.name },
    supportInbox: company.supportEmail || company.email || '',
    mailboxes: departments.map((d) => ({ dept: d.name, inbox: d.email })),
    topics,
    fields,
    priorities: ['Low', 'Normal', 'High', 'Emergency'],
    guestEndpoint: '/api/v1/public/chat/start',
  });
});
exports.serviceCatalog = asyncHandler(async (req, res) => {
  const User = require('../models/User');
  const user = req.user ? await User.findById(req.user._id) : null;
  let company = req.companyId || user?.company || null;
  if (!company) {
    const Company = require('../models/Company');
    company = (await Company.findOne().sort({ createdAt: 1 }))?._id || null;
  }
  const items = await ServiceCatalogItem.find({ company, visibleInPortal: true, isActive: true })
    .populate('helpTopic', 'topic')
    .populate('department', 'name')
    .populate('sla', 'name')
    .populate('formId', 'name')
    .sort({ category: 1, sortOrder: 1 });
  res.json({ success: true, items });
});

exports.surveysForTicket = asyncHandler(async (req, res) => {
  const { ticketNumber } = req.params;
  const ticket = await Ticket.findOne({ number: String(ticketNumber).trim().toUpperCase() });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const surveys = await Survey.find({ company: ticket.company, isActive: true }).select('name type question scale');
  res.json({ success: true, items: surveys, ticket: { number: ticket.number, status: ticket.status } });
});

// ---- Company self-registration (§3) ----
// Public onboarding: register → verify inbox → trial tenant + owner admin.
// Throttled per owner email; verification proves inbox ownership.
exports.registerCompany = asyncHandler(async (req, res) => {
  const { name, email, domain, ownerName, ownerEmail, ownerPassword } = req.body;
  if (!name || !ownerName || !ownerEmail || !ownerPassword) {
    throw new ApiError(422, 'Company name, owner name, owner email and password are required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(ownerEmail))) throw new ApiError(422, 'Valid owner email is required');
  const Company = require('../models/Company');
  const Agent = require('../models/Agent');
  if (await Company.findOne({ name: { $regex: `^${String(name).trim()}$`, $options: 'i' } })) {
    throw new ApiError(409, 'A company with this name already exists');
  }
  if (await Agent.findOne({ email: String(ownerEmail).toLowerCase().trim() })) {
    throw new ApiError(409, 'An agent with this email already exists');
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await Company.countDocuments({ contactPerson: String(ownerEmail).toLowerCase().trim(), createdAt: { $gte: dayAgo } });
  if (recent >= 3) throw new ApiError(429, 'Too many registrations from this email, try again tomorrow');
  const { assertPasswordPolicy } = require('../utils/passwordPolicy');
  await assertPasswordPolicy(ownerPassword, null);
  const { generateConfirmationToken } = require('../utils/generators');
  const token = generateConfirmationToken();
  const company = await Company.create({
    name: String(name).trim(),
    email: String(email || '').toLowerCase().trim(),
    supportEmail: String(email || '').toLowerCase().trim(),
    domain: String(domain || '').toLowerCase().trim(),
    contactPerson: String(ownerEmail).toLowerCase().trim(),
    status: 'pending_verification',
    verificationToken: token,
    verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  const owner = await Agent.create({
    name: String(ownerName).trim(),
    email: String(ownerEmail).toLowerCase().trim(),
    password: ownerPassword,
    company: company._id,
    isAdmin: true,
    isActive: false, // activated on verification
    permissions: ['admin.manage', 'access.manage', 'tickets.manage', 'users.manage', 'settings.manage', 'reports.manage'],
  });
  company.ownerId = owner._id;
  await company.save();
  const verifyUrl = `${req.protocol}://${req.get('host')}/api/v1/public/companies/verify?token=${token}`;
  const emailService = require('../services/email.service');
  await emailService.sendMail({
    to: owner.email,
    subject: `Verify your company "${company.name}"`,
    body: `Dear ${owner.name},\n\nThanks for registering "${company.name}" on the support platform.\n\nPlease verify your inbox to activate your 14-day trial:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nRegards,\nPlatform Team`,
    event: 'company_verify',
    company: company._id,
  }).catch(() => {});
  res.status(201).json({ success: true, message: 'Company registered — check the owner inbox to verify and activate.', companyId: company._id });
});

exports.verifyCompany = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const Company = require('../models/Company');
  const Agent = require('../models/Agent');
  const company = await Company.findOne({ verificationToken: String(token || ''), verificationExpires: { $gt: new Date() } });
  const done = (ok, title, text) => res.status(ok ? 200 : 400).send(
    `<!doctype html><html><body style="font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px">` +
    `<h2>${title}</h2><p>${text}</p></body></html>`
  );
  if (!company || company.status !== 'pending_verification') {
    return done(false, 'Verification failed', 'This link is invalid, expired, or already used.');
  }
  company.status = 'trial';
  company.trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  company.planStartedAt = new Date();
  company.planExpiresAt = company.trialEndsAt;
  company.verificationToken = null;
  company.verificationExpires = null;
  try {
    const Plan = require('../models/Plan');
    const plan = await Plan.findOne({ isDefault: true, isActive: true });
    if (plan) company.plan = plan._id;
  } catch (_) { /* optional */ }
  await company.save();
  await Agent.updateMany({ company: company._id, isAdmin: true }, { $set: { isActive: true } });
  return done(true, 'Company verified', `“${company.name}” is now active on a 14-day trial. You can sign in to the admin portal.`);
});