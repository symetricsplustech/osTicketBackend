const asyncHandler = require('../utils/asyncHandler');
const { globalSearch } = require('../services/search.service');

exports.search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ query: { text: '', filters: {} }, results: [], total: 0 });

  const result = await globalSearch({
    company: req.companyId,
    q,
    type: req.query.type,
    page: Math.max(1, parseInt(req.query.page, 10) || 1),
    limit: Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20)),
  });
  res.json(result);
});
