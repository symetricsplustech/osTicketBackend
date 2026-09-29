const UniversalRequest = require("../models/helpdesk/UniversalRequest");
const numberingService = require("./numbering.service");

const requireTenant = (ctx) => {
  if (!ctx.tenantId) throw Object.assign(new Error("Tenant context required"), { statusCode: 400 });
  return ctx.tenantId;
};

const pick = (object, keys) => Object.fromEntries(keys.filter((key) => object[key] !== undefined).map((key) => [key, object[key]]));
const editable = ["title", "description", "status", "priority", "requesterId", "assignedTo", "assignmentGroup", "parentId", "sourceType", "sourceId", "metadata"];

exports.list = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, ...pick(query, ["status", "priority", "requesterId", "assignedTo", "assignmentGroup"]) };
  if (query.search) filter.$or = [{ number: { $regex: query.search, $options: "i" } }, { title: { $regex: query.search, $options: "i" } }];
  return UniversalRequest.find(filter).sort({ updatedAt: -1 });
};

exports.get = async (ctx, id) => {
  const request = await UniversalRequest.findOne({ _id: id, tenantId: requireTenant(ctx) });
  if (!request) throw Object.assign(new Error("Universal request not found"), { statusCode: 404 });
  return request;
};

exports.create = async (ctx, data, actor) => UniversalRequest.create({
  ...pick(data, editable),
  tenantId: requireTenant(ctx),
  number: await numberingService.nextNumber(ctx.tenantId, "UREQ"),
  status: data.status || "new",
  createdBy: actor.userId || actor._id,
});

exports.update = async (ctx, id, data) => {
  const request = await exports.get(ctx, id);
  Object.assign(request, pick(data, editable));
  await request.save();
  return request;
};

exports.transition = async (ctx, id, status, actor) => {
  const request = await exports.get(ctx, id);
  const transitions = { new: ["open", "cancelled"], open: ["pending", "resolved", "cancelled"], pending: ["open", "resolved", "cancelled"], resolved: ["closed", "open"], closed: [], cancelled: [] };
  if (!(transitions[request.status] || []).includes(status)) throw Object.assign(new Error(`Transition from ${request.status} to ${status} is not allowed`), { statusCode: 409 });
  request.status = status;
  request.updatedBy = actor.userId || actor._id;
  await request.save();
  return request;
};

exports.remove = async (ctx, id) => {
  const request = await exports.get(ctx, id);
  if (!["new", "cancelled"].includes(request.status)) throw Object.assign(new Error("Only new or cancelled universal requests can be deleted"), { statusCode: 409 });
  await request.deleteOne();
  return { success: true };
};
