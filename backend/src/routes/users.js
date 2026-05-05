'use strict';

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// GET /api/users — List users (admin-scoped)
router.get('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), async (req, res, next) => {
  try {
    const query = {};
    if (req.user.role === ROLES.RESTAURANT_ADMIN) {
      query.restaurant_id = req.user.restaurant_id;
    } else if (req.query.restaurant_id) {
      query.restaurant_id = req.query.restaurant_id;
    }
    if (req.query.role) query.role = req.query.role;
    if (req.query.is_active !== undefined) query.is_active = req.query.is_active === 'true';
    const users = await User.find(query).select('-password -refresh_tokens').sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: { users } });
  } catch (err) {
    next(err);
  }
});

// POST /api/users — Create user
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), async (req, res, next) => {
  try {
    const { name, email, password, role, restaurant_id, phone } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'name, email, password, role are required' });
    }
    // Restaurant admin can only create waiter/kitchen for own restaurant
    if (req.user.role === ROLES.RESTAURANT_ADMIN) {
      if (![ROLES.WAITER, ROLES.KITCHEN].includes(role)) {
        return res.status(403).json({ success: false, message: 'You can only create waiter or kitchen accounts' });
      }
    }
    const user = await User.create({
      name,
      email,
      password,
      role,
      restaurant_id: restaurant_id || req.user.restaurant_id,
      phone,
    });
    res.status(201).json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refresh_tokens').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && req.user._id.toString() !== req.params.id &&
      !req.user.belongsTo(user.restaurant_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && req.user._id.toString() !== req.params.id &&
      !req.user.belongsTo(target.restaurant_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { name, phone, is_active } = req.body;
    if (name) target.name = name;
    if (phone !== undefined) target.phone = phone;
    if (is_active !== undefined && req.user.role !== ROLES.WAITER && req.user.role !== ROLES.KITCHEN) {
      target.is_active = is_active;
    }
    await target.save();
    res.json({ success: true, data: { user: target } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/password — Admin changes staff password
router.patch('/:id/password', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    // Restaurant admin can only change password of their own staff
    if (req.user.role === ROLES.RESTAURANT_ADMIN) {
      if (target.restaurant_id?.toString() !== req.user.restaurant_id?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if ([ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN].includes(target.role)) {
        return res.status(403).json({ success: false, message: 'Cannot change admin passwords' });
      }
    }
    target.password = password; // hashed by pre-save hook
    target.refresh_tokens = []; // invalidate all sessions
    await target.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id
router.delete('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
