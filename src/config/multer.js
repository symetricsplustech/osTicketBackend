const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('./config');

let uploadsDir = path.join(__dirname, '../../uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.accessSync(uploadsDir, fs.constants.W_OK);
} catch (err) {
  // Read-only filesystem (e.g. Vercel serverless) — fall back to the temp dir.
  uploadsDir = path.join(os.tmpdir(), 'osticket-uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  },
});

const ALLOWED = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/json',
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize, files: 5 },
  fileFilter,
});

/**
 * Post-upload malware gate (§47). Every stored file is passed to the malware
 * scanner (ClamAV when CLAMAV_HOST/CLAMAV_ENABLED is set, mock-clean
 * otherwise). Infected files are deleted and the request rejected before any
 * ticket/thread record references them. Mount AFTER upload.array/single.
 */
const scanUploads = async (req, res, next) => {
  try {
    const files = [...(req.files || []), ...(req.file ? [req.file] : [])];
    if (!files.length) return next();
    const { scanFile } = require('../services/integrations.service');
    for (const file of files) {
      let result = { clean: true };
      try {
        const buffer = fs.readFileSync(file.path);
        result = await scanFile(file.path, buffer);
      } catch (err) {
        result = { clean: false, threat: `scan error: ${err.message}` };
      }
      if (!result || result.clean === false) {
        for (const f of files) {
          try { fs.unlinkSync(f.path); } catch (_) { /* best-effort */ }
        }
        const err = new Error(`Upload rejected by malware scan${result?.threat ? `: ${result.threat}` : ''}`);
        err.statusCode = 422;
        return next(err);
      }
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { upload, uploadsDir, scanUploads };
