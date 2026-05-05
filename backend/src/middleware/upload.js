'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } = require('../config/constants');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_PATH || './uploads';
['uploads', 'uploads/logos', 'uploads/menu', 'uploads/avatars'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = file.fieldname === 'logo' ? 'logos' : file.fieldname === 'avatar' ? 'avatars' : 'menu';
    cb(null, path.join(uploadDir, type));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`), false);
  }
};

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

module.exports = upload;
