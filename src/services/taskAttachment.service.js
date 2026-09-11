/**
 * Task attachment service — upload, list, soft-delete, download.
 * Stores files via configured storage (local disk or S3-compatible).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const TaskAttachment = require('../models/core/TaskAttachment');
const TaskActivity = require('../models/core/TaskActivity');
const { getIO } = require('../config/socket');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || String(10 * 1024 * 1024), 10);

function emitToTaskRoom(taskId, event, data) {
  try {
    const io = getIO();
    if (io) io.to(`task:${taskId}`).emit(event, data);
  } catch (_) {}
}

async function uploadAttachment({ tenantId, taskId, file, uploadedBy, isPublic = true, description = '' }) {
  if (!file) throw new ApiError(400, 'No file provided');
  if (file.size > MAX_SIZE) throw new ApiError(400, `File exceeds maximum size of ${MAX_SIZE} bytes`);

  const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const ext = path.extname(file.originalname) || '';
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const storageKey = `${tenantId}/${taskId}/${filename}`;

  const destDir = path.join(UPLOAD_DIR, tenantId, taskId);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, filename), file.buffer);

  const attachment = await TaskAttachment.create({
    tenantId, taskId, filename, originalName: file.originalname,
    mimeType: file.mimetype, size: file.size, storageKey,
    uploadedBy, isPublic, description, hash,
  });

  await TaskActivity.create({
    tenantId, taskId, type: 'attachment',
    content: `Attached: ${file.originalname}`, actor: uploadedBy, isPublic,
  });

  emitToTaskRoom(taskId, 'attachment:added', attachment);
  return attachment;
}

async function listAttachments(taskId, tenantId, { includeDeleted = false } = {}) {
  const query = { tenantId, taskId };
  if (!includeDeleted) query.isDeleted = false;
  return TaskAttachment.find(query).sort({ createdAt: -1 }).populate('uploadedBy', 'name email');
}

async function getAttachment(attachmentId, tenantId) {
  const att = await TaskAttachment.findOne({ _id: attachmentId, tenantId, isDeleted: false });
  if (!att) throw new ApiError(404, 'Attachment not found');
  return att;
}

async function softDeleteAttachment(attachmentId, tenantId, deletedBy) {
  const att = await TaskAttachment.findOne({ _id: attachmentId, tenantId, isDeleted: false });
  if (!att) throw new ApiError(404, 'Attachment not found');
  att.isDeleted = true;
  att.deletedAt = new Date();
  att.deletedBy = deletedBy;
  await att.save();

  await TaskActivity.create({
    tenantId, taskId: att.taskId, type: 'system',
    content: `Deleted attachment: ${att.originalName}`, actor: deletedBy, isPublic: false,
  });

  return att;
}

async function getDownloadPath(attachmentId, tenantId) {
  const att = await getAttachment(attachmentId, tenantId);
  const filePath = path.join(UPLOAD_DIR, tenantId, String(att.taskId), att.filename);
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'File not found on disk');
  return { filePath, attachment: att };
}

module.exports = {
  uploadAttachment, listAttachments, getAttachment, softDeleteAttachment, getDownloadPath,
};
