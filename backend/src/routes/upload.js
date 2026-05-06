'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { authenticate } = require('../middleware/auth');

// ── Storage ───────────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage(); // process in memory, then write via sharp

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ── POST /api/upload/image ────────────────────────────────────────────────────
// Upload and auto-resize an image. Returns { url }
router.post('/image', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    const outputPath = path.join(uploadDir, filename);

    // Convert to WebP and resize (max 800px wide)
    await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outputPath);

    const url = `/uploads/${filename}`;

    res.json({ success: true, data: { url, filename } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/upload/logo (square crop for logos) ─────────────────────────────
router.post('/logo', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });

    const filename = `logo-${Date.now()}.webp`;
    const outputPath = path.join(uploadDir, filename);

    await sharp(req.file.buffer)
      .resize({ width: 400, height: 400, fit: 'cover' })
      .webp({ quality: 90 })
      .toFile(outputPath);

    const url = `/uploads/${filename}`;

    res.json({ success: true, data: { url, filename } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
