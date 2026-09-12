const auditService = require("../../services/auditEvent.service");

const ok = (res, data, status = 200) => res.status(status).json(data);

exports.list = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const result = await auditService.listEvents({
      tenantId,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      action: req.query.action,
      actor: req.query.actor,
      page: parseInt(req.query.page, 10) || 1,
      limit: Math.min(parseInt(req.query.limit, 10) || 50, 200),
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
};
