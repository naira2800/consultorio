'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `orden-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safe);
  },
});

const ALLOWED = ['.pdf', '.jpg', '.jpeg', '.png'];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED.includes(ext)) return cb(null, true);
  cb(new Error('Formato de archivo no permitido. Use PDF, JPG o PNG.'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

module.exports = { upload, UPLOAD_DIR };
