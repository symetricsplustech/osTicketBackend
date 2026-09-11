const FaqCategory = require('../../../models/helpdesk/knowledge/FaqCategory');
const Faq = require('../../../models/helpdesk/knowledge/Faq');
const Announcement = require('../../../models/helpdesk/knowledge/Announcement');
const asyncHandler = require('../../../utils/asyncHandler');
const { getPagination, getSortObj } = require('../../../utils/pagination');

const companyFilter = (req) => {
  const or = [{ company: null }];
  if (req.companyId) or.push({ company: req.companyId });
  return { $or: or };
};

// Visibility scopes (§28): guests see public; customers +customers;
// employees (sub-accounts) +employees. Legacy docs without `visibility`
// count as public unless flagged internalOnly (agents-only).
const visibleScopes = (req) => {
  if (!req.user) return ['public'];
  if (req.user.createdBy) return ['public', 'customers', 'employees'];
  return ['public', 'customers'];
};

const visibilityFilter = (req) => ({
  $or: [
    { visibility: { $in: visibleScopes(req) } },
    { visibility: { $exists: false }, internalOnly: { $ne: true } },
  ],
});

const escapeRegExp = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Knowledge-assisted creation (§29) / agent assist (§30): top matching
 * published articles for a free-text problem description.
 */
const searchFaqs = async ({ q, companyId, scopes = null, limit = 5 }) => {
  const text = String(q || '').trim();
  if (text.length < 3) return [];
  const comp = companyId ? { $or: [{ company: null }, { company: companyId }] } : {};
  const vis = scopes
    ? { $or: [{ visibility: { $in: scopes } }, { visibility: { $exists: false }, internalOnly: { $ne: true } }] }
    : {};
  // NOTE: kept as separate $and clauses — spreading would let duplicate
  // $or keys silently overwrite each other.
  const and = [];
  if (Object.keys(comp).length) and.push(comp);
  if (Object.keys(vis).length) and.push(vis);
  const base = { isPublished: true, ...(and.length ? { $and: and } : {}) };
  try {
    const hits = await Faq.find({ ...base, $text: { $search: text } }, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .select('question keywords helpful views category')
      .populate('category', 'name')
      .lean();
    if (hits.length) return hits;
  } catch (_) { /* text index unavailable — regex fallback below */ }
  const words = text.split(/\s+/).filter((w) => w.length > 2).slice(0, 5).map(escapeRegExp);
  if (!words.length) return [];
  const rx = new RegExp(words.join('|'), 'i');
  return Faq.find({ ...base, $or: [{ question: rx }, { answer: rx }, { keywords: rx }] })
    .limit(limit)
    .select('question keywords helpful views category')
    .populate('category', 'name')
    .lean();
};

exports.suggest = asyncHandler(async (req, res) => {
  const items = await searchFaqs({ q: req.query.q, companyId: req.companyId, scopes: visibleScopes(req) });
  res.json({ success: true, items });
});

// Agent assist: same search with full (incl. internal) visibility.
exports.suggestForAgent = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.agent?.company || null;
  const items = await searchFaqs({ q: req.query.q, companyId, scopes: null });
  res.json({ success: true, items });
});

exports.categories = asyncHandler(async (req, res) => {
  const comp = companyFilter(req);
  const categories = await FaqCategory.find({ isPublic: true, ...comp }).sort({ sortOrder: 1 });
  const counts = await Faq.aggregate([
    { $match: { isPublished: true, ...comp } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = {};
  counts.forEach((c) => { countMap[String(c._id)] = c.count; });
  res.json({
    success: true,
    items: categories.map((c) => ({
      ...c.toObject(),
      count: countMap[String(c._id)] || 0,
    })),
  });
});

exports.faqs = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-createdAt' });
  const { search, category } = req.query;
  // NOTE: $and composition — spreading company/visibility $or clauses would
  // silently overwrite each other.
  const query = { isPublished: true, $and: [companyFilter(req), visibilityFilter(req)] };
  if (category) query.category = category;
  if (search) {
    const or = [
      { question: { $regex: search, $options: 'i' } },
      { answer: { $regex: search, $options: 'i' } },
      { keywords: { $regex: search, $options: 'i' } },
    ];
    query.$and.push({ $or: or });
  }
  const [items, total] = await Promise.all([
    Faq.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('category', 'name'),
    Faq.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.faqDetail = asyncHandler(async (req, res) => {
  const comp = companyFilter(req);
  const faq = await Faq.findOne({ _id: req.params.id, isPublished: true, $and: [comp, visibilityFilter(req)] }).populate('category', 'name');
  if (!faq) {
    const notFound = require('../../../utils/ApiError');
    throw new notFound(404, 'FAQ not found');
  }
  faq.views += 1;
  await faq.save();
  res.json({ success: true, faq });
});

exports.faqVote = asyncHandler(async (req, res) => {
  const { helpful } = req.body;
  const comp = companyFilter(req);
  const faq = await Faq.findOne({ _id: req.params.id, ...comp });
  if (!faq) {
    const notFound = require('../../../utils/ApiError');
    throw new notFound(404, 'FAQ not found');
  }
  if (helpful) faq.helpful += 1;
  else faq.notHelpful += 1;
  await faq.save();
  res.json({ success: true });
});

exports.announcements = asyncHandler(async (req, res) => {
  const now = new Date();
  const comp = companyFilter(req);
  const items = await Announcement.find({
    isActive: true,
    ...comp,
    $or: [{ showDate: null }, { showDate: { $lte: now } }],
  }).sort({ createdAt: -1 });
  res.json({ success: true, items });
});
