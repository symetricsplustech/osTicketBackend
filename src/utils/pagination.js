const getPagination = (req, defaults = { page: 1, limit: 20, sort: '-createdAt' }) => {
  const page = Math.max(parseInt(req.query.page, 10) || defaults.page, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaults.limit, 1), 100);
  const sort = req.query.sort || defaults.sort;
  return { page, limit, skip: (page - 1) * limit, sort };
};

const getSortObj = (sort) => {
  const obj = {};
  String(sort)
    .split(',')
    .forEach((s) => {
      const field = s.replace(/^-/, '');
      if (!field) return;
      obj[field] = s.startsWith('-') ? -1 : 1;
    });
  return obj;
};

module.exports = { getPagination, getSortObj };
