const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const PlatformResource = require('../models/PlatformResource');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { requirePlatformPermission } = require('../middleware/auth');
const { P } = require('../config/platformPermissions');

const router = express.Router();
const KINDS = new Set(['integration', 'email_domain', 'storage_policy', 'backup', 'disaster_recovery', 'compliance_policy', 'support_incident', 'announcement', 'abuse_case', 'api_key', 'license', 'migration', 'feature_flag']);
const readPermission = (kind) => ['backup', 'disaster_recovery', 'support_incident'].includes(kind) ? P.OPERATIONS_READ : kind === 'abuse_case' ? P.SECURITY_READ : P.PLATFORM_CONFIGURE;
const writePermission = (kind) => ['backup', 'disaster_recovery', 'support_incident', 'migration'].includes(kind) ? P.OPERATIONS_MANAGE : kind === 'abuse_case' ? P.SECURITY_CONFIGURE : kind === 'feature_flag' ? P.MODULE_FEATURE_FLAGS : P.PLATFORM_CONFIGURE;
const validateKind = (req, _res, next) => KINDS.has(req.params.kind) ? next() : next(new ApiError(404, 'Unknown platform resource type'));
const audit = (req, action, resource, details = {}) => AuditLog.create({ superAdmin: req.superAdmin._id, company: resource.tenant || null, action, entityType: 'PlatformResource', entityId: String(resource._id), details: { kind: resource.kind, name: resource.name, ...details }, ip: req.ip || '', userAgent: req.get('user-agent') || '' });

router.param('kind', validateKind);
router.get('/:kind', (req, res, next) => requirePlatformPermission(readPermission(req.params.kind))(req, res, next), asyncHandler(async (req, res) => {
  const query = { kind: req.params.kind };
  if (req.query.status) query.status = req.query.status;
  if (req.query.tenant) query.tenant = req.query.tenant;
  const data = await PlatformResource.find(query).populate('tenant', 'name status').populate('plan', 'name code').sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 200, 500));
  res.json({ success: true, data });
}));

router.post('/:kind', (req, res, next) => requirePlatformPermission(writePermission(req.params.kind))(req, res, next), asyncHandler(async (req, res) => {
  const payload = { ...req.body, kind: req.params.kind, createdBy: req.superAdmin._id, updatedBy: req.superAdmin._id };
  let plaintextKey;
  if (req.params.kind === 'api_key') {
    plaintextKey = `ost_${crypto.randomBytes(30).toString('base64url')}`;
    payload.secretHash = crypto.createHash('sha256').update(plaintextKey).digest('hex');
    payload.config = { ...(payload.config || {}), prefix: plaintextKey.slice(0, 12) };
  }
  const resource = await PlatformResource.create(payload);
  await audit(req, `platform.${req.params.kind}.created`, resource);
  res.status(201).json({ success: true, data: resource, secret: plaintextKey });
}));

router.put('/:kind/:id', (req, res, next) => requirePlatformPermission(writePermission(req.params.kind))(req, res, next), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(422, 'Invalid resource id');
  const blocked = ['kind', 'secretHash', 'createdBy', '_id'];
  const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => !blocked.includes(key)));
  update.updatedBy = req.superAdmin._id;
  const resource = await PlatformResource.findOneAndUpdate({ _id: req.params.id, kind: req.params.kind }, { $set: update }, { new: true, runValidators: true });
  if (!resource) throw new ApiError(404, 'Resource not found');
  await audit(req, `platform.${req.params.kind}.updated`, resource);
  res.json({ success: true, data: resource });
}));

router.delete('/:kind/:id', (req, res, next) => requirePlatformPermission(writePermission(req.params.kind))(req, res, next), asyncHandler(async (req, res) => {
  const resource = await PlatformResource.findOneAndUpdate({ _id: req.params.id, kind: req.params.kind }, { $set: { status: 'revoked', updatedBy: req.superAdmin._id } }, { new: true });
  if (!resource) throw new ApiError(404, 'Resource not found');
  await audit(req, `platform.${req.params.kind}.revoked`, resource, { reason: req.body?.reason || '' });
  res.json({ success: true, data: resource });
}));

module.exports = router;
