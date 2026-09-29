const { getDB } = require("../../config/db");
const auditService = require("../../services/auditEvent.service");

const domains = new Set(["improvement", "service-operations", "employee-center", "conversational-service", "intelligent-automation", "workforce", "vendor", "experience-feedback", "benchmarks", "performance-analytics"]);
const tenantId = (req) => req.tenantId || req.companyId;
const actorId = (req) => req.user?.id || req.user?._id || null;
const scope = (req) => ({ tenant_id: tenantId(req), domain: req.params.domain, resource: req.params.resource });
const allowed = (req, res) => domains.has(req.params.domain) || (res.status(404).json({ success: false, message: "Operational domain not found" }), false);
const audit = (req, action, before, after) => auditService.record({ tenantId: tenantId(req), entityType: `${req.params.domain}.${req.params.resource}`, entityId: after?.id || before?.id, action, actor: actorId(req), before, after, ipAddress: req.ip, userAgent: req.get("user-agent"), correlationId: req.correlationId });

exports.list = async (req, res, next) => {
  try {
    if (!allowed(req, res)) return;
    const query = getDB()("experience_records").where(scope(req)).orderBy("updated_at", "desc").limit(Math.min(Number(req.query.limit) || 100, 250));
    if (req.query.status) query.andWhere("status", req.query.status);
    if (req.query.search) query.andWhere((builder) => builder.whereILike("name", `%${req.query.search}%`).orWhereILike("number", `%${req.query.search}%`));
    res.json({ success: true, data: await query });
  } catch (error) { next(error); }
};

exports.get = async (req, res, next) => {
  try {
    if (!allowed(req, res)) return;
    const record = await getDB()("experience_records").where({ ...scope(req), id: req.params.id }).first();
    if (!record) return res.status(404).json({ success: false, message: "Record not found" });
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    if (!allowed(req, res)) return;
    const payload = { ...scope(req), number: req.body.number || null, name: req.body.name || req.body.title, description: req.body.description || null, status: req.body.status || "active", priority: req.body.priority || "P3", owner_id: req.body.ownerId || null, details: req.body.details || {}, created_by: actorId(req), updated_by: actorId(req) };
    if (!payload.name) return res.status(422).json({ success: false, message: "Name is required" });
    const [record] = await getDB()("experience_records").insert(payload).returning("*");
    await audit(req, "create", null, record);
    res.status(201).json({ success: true, data: record });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    if (!allowed(req, res)) return;
    const before = await getDB()("experience_records").where({ ...scope(req), id: req.params.id }).first();
    if (!before) return res.status(404).json({ success: false, message: "Record not found" });
    const payload = {}; for (const key of ["number", "name", "description", "status", "priority", "details"]) if (req.body[key] !== undefined) payload[key] = req.body[key];
    if (req.body.ownerId !== undefined) payload.owner_id = req.body.ownerId;
    payload.updated_by = actorId(req); payload.updated_at = getDB().fn.now();
    const [record] = await getDB()("experience_records").where({ ...scope(req), id: req.params.id }).update(payload).returning("*");
    await audit(req, "update", before, record);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
};

exports.transition = async (req, res, next) => {
  try {
    if (!req.body.status) return res.status(422).json({ success: false, message: "Status is required" });
    req.body = { status: req.body.status };
    return exports.update(req, res, next);
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!allowed(req, res)) return;
    const [record] = await getDB()("experience_records").where({ ...scope(req), id: req.params.id }).del().returning("*");
    if (!record) return res.status(404).json({ success: false, message: "Record not found" });
    await audit(req, "delete", record, null);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
};
