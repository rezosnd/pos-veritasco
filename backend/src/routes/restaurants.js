'use strict';

const express = require('express');
const router = express.Router();
const Restaurant = require('../models/Restaurant');
const Table = require('../models/Table');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { ROLES } = require('../config/constants');
const QRCode = require('qrcode');
const logger = require('../utils/logger');
const crypto = require('crypto');

// GET /api/restaurants — Super admin: all, others: own
router.get('/', authenticate, async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role !== ROLES.SUPER_ADMIN) {
      query._id = req.user.restaurant_id;
    }
    const { page = 1, limit = 20, search, is_active } = req.query;
    if (search) query.$text = { $search: search };
    if (is_active !== undefined) query.is_active = is_active === 'true';
    const [restaurants, total] = await Promise.all([
      Restaurant.find(query)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .lean(),
      Restaurant.countDocuments(query),
    ]);
    res.json({ success: true, data: { restaurants, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/restaurants/public/:id — Public branding (by Mongo ID)
router.get('/public/:id', async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
      .select('name slug logo theme_color latitude longitude geo_radius_meters upi_id whatsapp_number gst_percent currency features opening_hours description address phone categories')
      .lean();
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    res.json({ success: true, data: { restaurant } });
  } catch (err) {
    next(err);
  }
});

// GET /api/restaurants/slug/:slug — Public branding (by slug for slug-based routes)
router.get('/slug/:slug', async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findOne({ slug: req.params.slug })
      .select('name slug logo theme_color latitude longitude geo_radius_meters upi_id whatsapp_number gst_percent currency features opening_hours description address phone categories')
      .lean();
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    res.json({ success: true, data: { restaurant } });
  } catch (err) {
    next(err);
  }
});

// GET /api/restaurants/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
      .populate('menuCount tableCount')
      .lean();
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, data: { restaurant } });
  } catch (err) {
    next(err);
  }
});

// POST /api/restaurants — Super admin creates restaurant
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN), upload.single('logo'), async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.logo = `/uploads/logos/${req.file.filename}`;
    if (data.features) {
      try { data.features = JSON.parse(data.features); } catch { /* ignore */ }
    }
    if (data.address) {
      try { data.address = JSON.parse(data.address); } catch { /* ignore */ }
    }
    const restaurant = await Restaurant.create(data);
    // Auto-generate tables if count specified
    if (data.table_count && parseInt(data.table_count) > 0) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const tableDocs = [];
      for (let i = 1; i <= parseInt(data.table_count); i++) {
        const qrToken = crypto.randomUUID(); // unique per table — avoids null dup-key on qr_token_1 index
        const qrUrl = `${frontendUrl}/${restaurant.slug}/menu?table=T${i}&token=${qrToken}`;
        let qrCode = null;
        try {
          qrCode = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });
        } catch (qrErr) {
          logger.warn(`QR generation failed for T${i}: ${qrErr.message}`);
        }
        tableDocs.push({
          restaurant_id: restaurant._id,
          table_number: `T${i}`,
          display_name: `Table ${i}`,
          qr_url: qrUrl,
          qr_token: qrToken,
          qr_code: qrCode,
        });
      }
      // ordered:false so one failure doesn't abort the whole batch
      await Table.insertMany(tableDocs, { ordered: false });
    }
    logger.info(`Restaurant created: ${restaurant.name} [${restaurant._id}]`);
    res.status(201).json({ success: true, data: { restaurant } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/restaurants/:id
router.put('/:id', authenticate, upload.single('logo'), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const data = { ...req.body };
    if (req.file) data.logo = `/uploads/logos/${req.file.filename}`;
    if (data.features) {
      try { data.features = JSON.parse(data.features); } catch { /* ignore */ }
    }
    if (data.address) {
      try { data.address = JSON.parse(data.address); } catch { /* ignore */ }
    }
    if (data.categories && typeof data.categories === 'string') {
      try { data.categories = JSON.parse(data.categories); } catch { /* ignore */ }
    }
    const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    res.json({ success: true, data: { restaurant } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/restaurants/:id — Super admin only
router.delete('/:id', authenticate, authorize(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    res.json({ success: true, message: 'Restaurant deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
