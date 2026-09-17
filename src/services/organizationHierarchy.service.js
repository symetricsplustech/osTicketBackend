const OrganizationUnit = require("../models/OrganizationUnit");
const OrganizationUnitLabel = require("../models/OrganizationUnitLabel");
const ApiError = require("../utils/ApiError");

const normalizeType = (value) => String(value || "").trim().toLowerCase();
const validType = (value) => /^[a-z][a-z0-9_]{1,48}$/.test(value);

async function listTypes(company) {
  const [stored, used] = await Promise.all([
    OrganizationUnitLabel.find({ company }).sort({ type: 1 }),
    OrganizationUnit.distinct("type", { company }),
  ]);
  const types = new Map(stored.map((item) => [item.type, item]));
  // Existing units predate the registry. Keep them editable without a data rewrite.
  for (const type of used) {
    if (!types.has(type)) types.set(type, { type, label: type.replace(/_/g, " "), legacy: true });
  }
  return [...types.values()].sort((a, b) => a.type.localeCompare(b.type));
}

async function assertType(company, value) {
  const type = normalizeType(value);
  if (!validType(type)) throw new ApiError(422, "Use a lowercase type key with letters, digits or underscores");
  const registered = await OrganizationUnitLabel.exists({ company, type });
  const existing = registered || await OrganizationUnit.exists({ company, type });
  if (!existing) throw new ApiError(422, "Create the organization unit type first");
  return type;
}

async function assertParent(company, parentId, itemId, instanceCompany) {
  if (!parentId) return null;
  const visited = new Set(itemId ? [String(itemId)] : []);
  let cursor = await OrganizationUnit.findOne({ _id: parentId, company });
  if (!cursor) throw new ApiError(422, "Parent unit is outside this company");
  const parent = cursor;
  while (cursor) {
    if (instanceCompany && String(cursor.instanceCompany || "") !== String(instanceCompany))
      throw new ApiError(422, "Parent unit must belong to the same instance company");
    const id = String(cursor._id);
    if (visited.has(id)) throw new ApiError(422, "Organization hierarchy cannot contain a cycle");
    visited.add(id);
    cursor = cursor.parent
      ? await OrganizationUnit.findOne({ _id: cursor.parent, company })
      : null;
  }
  return parent;
}

module.exports = { normalizeType, validType, listTypes, assertType, assertParent };
