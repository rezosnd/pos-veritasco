'use strict';

const express = require('express');
const router = express.Router();
const Menu = require('../models/Menu');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { ROLES } = require('../config/constants');

// GET /api/menu/:restaurantId — Public: get all menu items
router.get('/:restaurantId', async (req, res, next) => {
  try {
    const { category, type, search, available = 'true', featured } = req.query;
    const query = { restaurant_id: req.params.restaurantId };

    if (available !== 'all') query.is_available = available === 'true';
    if (category && category !== 'All') query.category = category;
    if (type) query.type = type;
    if (featured === 'true') query.is_featured = true;
    if (search) query.$text = { $search: search };

    const items = await Menu.find(query)
      .sort({ category: 1, sort_order: 1, createdAt: 1 })
      .lean();

    // Build categories list (merge distinct with restaurant.categories)
    const Restaurant = require('../models/Restaurant');
    const rest = await Restaurant.findById(req.params.restaurantId).lean();
    
    const allItems = await Menu.find({ restaurant_id: req.params.restaurantId, is_available: true }).distinct('category');
    
    // Map categories to object with image
    const finalCategories = allItems.map(c => {
      const existing = rest?.categories?.find(rc => rc.name === c);
      return { name: c, image: existing ? existing.image : null };
    });

    res.json({ success: true, data: { items, categories: finalCategories } });
  } catch (err) {
    next(err);
  }
});

// GET /api/menu/:restaurantId/categories — Get categories only
router.get('/:restaurantId/categories', async (req, res, next) => {
  try {
    const Restaurant = require('../models/Restaurant');
    const rest = await Restaurant.findById(req.params.restaurantId).lean();
    
    const allItems = await Menu.find({
      restaurant_id: req.params.restaurantId,
      is_available: true,
    }).distinct('category');
    
    const categories = allItems.map(c => {
      const existing = rest?.categories?.find(rc => rc.name.toLowerCase() === c.toLowerCase());
      return { name: c, image: existing ? existing.image : null };
    });
    
    res.json({ success: true, data: { categories } });
  } catch (err) {
    next(err);
  }
});

// POST /api/menu/:restaurantId — Admin/waiter creates item
router.post('/:restaurantId', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), upload.single('image'), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const data = { ...req.body, restaurant_id: req.params.restaurantId };
    if (req.file) data.image = `/uploads/menu/${req.file.filename}`;
    if (data.variants) { try { data.variants = JSON.parse(data.variants); } catch { /* ignore */ } }
    if (data.allergens) { try { data.allergens = JSON.parse(data.allergens); } catch { /* ignore */ } }
    const item = await Menu.create(data);
    res.status(201).json({ success: true, data: { item } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/menu/:restaurantId/:itemId
router.put('/:restaurantId/:itemId', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), upload.single('image'), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const data = { ...req.body };
    if (req.file) data.image = `/uploads/menu/${req.file.filename}`;
    if (data.variants) { try { data.variants = JSON.parse(data.variants); } catch { /* ignore */ } }
    const item = await Menu.findOneAndUpdate(
      { _id: req.params.itemId, restaurant_id: req.params.restaurantId },
      data,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    res.json({ success: true, data: { item } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/menu/:restaurantId/:itemId/availability
router.patch('/:restaurantId/:itemId/availability', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN, ROLES.WAITER), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const item = await Menu.findOneAndUpdate(
      { _id: req.params.itemId, restaurant_id: req.params.restaurantId },
      { is_available: req.body.is_available },
      { new: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    // Emit socket event
    const io = req.app.get('io');
    io?.to(`restaurant:${req.params.restaurantId}`).emit('menu-availability-changed', {
      item_id: item._id,
      is_available: item.is_available,
    });
    res.json({ success: true, data: { item } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/menu/:restaurantId/:itemId
router.delete('/:restaurantId/:itemId', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const item = await Menu.findOneAndDelete({ _id: req.params.itemId, restaurant_id: req.params.restaurantId });
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    res.json({ success: true, message: 'Menu item deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/menu/:restaurantId/bulk — Bulk insert menu items
router.post('/:restaurantId/bulk', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const items = req.body.items?.map(item => ({ ...item, restaurant_id: req.params.restaurantId }));
    if (!items?.length) return res.status(400).json({ success: false, message: 'items array is required' });
    const created = await Menu.insertMany(items);
    res.status(201).json({ success: true, data: { count: created.length, items: created } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
