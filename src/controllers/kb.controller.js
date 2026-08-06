const FaqCategory = require('../models/FaqCategory');
const Faq = require('../models/Faq');
const Announcement = require('../models/Announcement');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, getSortObj } = require('../utils/pagination');

exports.categories = asyncHandler(async (req, res) => {
  const categories = await FaqCategory.find({ isPublic: true }).sort({ sortOrder: 1 });
  const counts = await Faq.aggregate([
    { $match: { isPublished: true } },
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
  const query = { isPublished: true };
  if (category) query.category = category;
  if (search) {
    const or = [
      { question: { $regex: search, $options: 'i' } },
      { answer: { $regex: search, $options: 'i' } },
      { keywords: { $regex: search, $options: 'i' } },
    ];
    query.$or = or;
  }
  const [items, total] = await Promise.all([
    Faq.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('category', 'name'),
    Faq.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.faqDetail = asyncHandler(async (req, res) => {
  const faq = await Faq.findOne({ _id: req.params.id, isPublished: true }).populate('category', 'name');
  if (!faq) {
    const notFound = require('../utils/ApiError');
    throw new notFound(404, 'FAQ not found');
  }
  faq.views += 1;
  await faq.save();
  res.json({ success: true, faq });
});

exports.faqVote = asyncHandler(async (req, res) => {
  const { helpful } = req.body;
  const faq = await Faq.findById(req.params.id);
  if (!faq) {
    const notFound = require('../utils/ApiError');
    throw new notFound(404, 'FAQ not found');
  }
  if (helpful) faq.helpful += 1;
  else faq.notHelpful += 1;
  await faq.save();
  res.json({ success: true });
});

exports.announcements = asyncHandler(async (req, res) => {
  const now = new Date();
  const items = await Announcement.find({
    isActive: true,
    $or: [{ showDate: null }, { showDate: { $lte: now } }],
  }).sort({ createdAt: -1 });
  res.json({ success: true, items });
});
