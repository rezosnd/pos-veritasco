'use strict';

const express = require('express');
const router = express.Router();
const Table = require('../models/Table');
const Session = require('../models/Session');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES, TABLE_STATUS, SESSION_STATUS } = require('../config/constants');
const QRCode = require('qrcode');
const logger = require('../utils/logger');
const crypto = require('crypto');
const Restaurant = require('../models/Restaurant');

// GET /api/tables/:restaurantId — All tables for a restaurant
router.get('/:restaurantId', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { status, section } = req.query;
    const query = { restaurant_id: req.params.restaurantId, is_active: true };
    if (status) query.status = status;
    if (section) query.section = section;
    const tables = await Table.find(query)
      .populate('activated_by', 'name')
      .populate('current_session_id', 'total order_ids users status')
      .sort({ table_number: 1 })
      .lean();
    res.json({ success: true, data: { tables } });
  } catch (err) {
    next(err);
  }
});

// GET /api/tables/:restaurantId/public/:tableNumber — Public check (for QR scan)
router.get('/:restaurantId/public/:tableNumber', async (req, res, next) => {
  try {
    const { token } = req.query;
    
    // Check if the request is from an authenticated staff member (waiter/admin)
    let isStaff = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwtToken = authHeader.split(' ')[1];
      try {
        const jwt = require('jsonwebtoken');
        jwt.verify(jwtToken, process.env.JWT_SECRET || 'secret');
        isStaff = true;
      } catch (e) {
        // invalid token, treat as public
      }
    }

    const table = await Table.findOne({
      restaurant_id: req.params.restaurantId,
      table_number: req.params.tableNumber,
      is_active: true,
    }).select('status table_number display_name capacity current_session_id qr_token').lean();
    
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    
    // Determine if token validation is required
    // Bypass if isStaff, or if ENFORCE_QR_TOKEN is explicitly set to 'false'
    // Default to true in production, false in development
    const isDev = process.env.NODE_ENV === 'development';
    const enforceToken = process.env.ENFORCE_QR_TOKEN 
      ? process.env.ENFORCE_QR_TOKEN === 'true' 
      : !isDev; // Default to true in prod, false in dev

    if (enforceToken && !isStaff) {
      if (!token || !table.qr_token || table.qr_token !== token) {
        return res.status(401).json({ success: false, message: 'Invalid QR Code. Please scan the newly generated QR code on your table.' });
      }
    }
    
    // Remove token from response
    delete table.qr_token;

    res.json({ success: true, data: { table } });
  } catch (err) {
    next(err);
  }
});

// POST /api/tables/:restaurantId/public/:tableNumber/activate — Customer self-activates table (no auth)
// Used when customer scans QR on an inactive table and activates it themselves
router.post('/:restaurantId/public/:tableNumber/activate', async (req, res, next) => {
  try {
    const { customer_name, customer_phone, token } = req.body;
    
    // Check if the request is from an authenticated staff member (waiter/admin)
    let isStaff = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwtToken = authHeader.split(' ')[1];
      try {
        const jwt = require('jsonwebtoken');
        jwt.verify(jwtToken, process.env.JWT_SECRET || 'secret');
        isStaff = true;
      } catch (e) {
        // invalid token, treat as public
      }
    }

    const table = await Table.findOne({
      restaurant_id: req.params.restaurantId,
      table_number: req.params.tableNumber,
      is_active: true,
    });
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    
    // Determine if token validation is required
    // Bypass if isStaff, or if ENFORCE_QR_TOKEN is explicitly set to 'false'
    // Default to true in production, false in development
    const isDev = process.env.NODE_ENV === 'development';
    const enforceToken = process.env.ENFORCE_QR_TOKEN 
      ? process.env.ENFORCE_QR_TOKEN === 'true' 
      : !isDev; // Default to true in prod, false in dev

    if (enforceToken && !isStaff) {
      if (!token || !table.qr_token || table.qr_token !== token) {
        return res.status(401).json({ success: false, message: 'Invalid QR Code. Please scan the newly generated QR code on your table.' });
      }
    }

    // If already active/occupied, return existing session
    if (['active', 'occupied'].includes(table.status) && table.current_session_id) {
      const session = await Session.findById(table.current_session_id);
      
      // Optionally update name/phone if they weren't set yet
      if (session && customer_name && !session.customer_name) {
        session.customer_name = customer_name;
        if (customer_phone) session.customer_phone = customer_phone;
        await session.save();
      }

      return res.json({ success: true, data: { table, session, alreadyActive: true } });
    }

    // Create new session
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.SESSION_EXPIRY_HOURS || 12));
    const session = await Session.create({
      restaurant_id: req.params.restaurantId,
      table_id: table._id,
      table_number: table.table_number,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      expires_at: expiresAt,
    });

    table.status = TABLE_STATUS.ACTIVE;
    table.activated_at = new Date();
    table.current_session_id = session._id;
    await table.save();

    // Notify staff via socket
    const io = req.app.get('io');
    io?.to(`restaurant:${req.params.restaurantId}`).emit('table-activated', {
      table_id: table._id,
      table_number: table.table_number,
      session_id: session._id,
      self_activated: true, // customer activated, not waiter
    });

    logger.info(`Table ${table.table_number} self-activated by customer at restaurant ${req.params.restaurantId}`);
    res.json({ success: true, data: { table, session } });
  } catch (err) {
    next(err);
  }
});

// POST /api/tables/:restaurantId — Create table
router.post('/:restaurantId', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { table_number, display_name, capacity, section } = req.body;
    const restaurant = await Restaurant.findById(req.params.restaurantId).select('slug');
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrToken = crypto.randomUUID();
    const qrUrl = `${frontendUrl}/${restaurant.slug}/menu?table=${table_number}&token=${qrToken}`;
    const qrCode = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });
    
    const table = await Table.create({
      restaurant_id: req.params.restaurantId,
      table_number,
      display_name: display_name || `Table ${table_number}`,
      capacity,
      section,
      qr_url: qrUrl,
      qr_code: qrCode,
      qr_token: qrToken,
    });
    res.status(201).json({ success: true, data: { table } });
  } catch (err) {
    next(err);
  }
});

// POST /api/tables/:restaurantId/:tableId/activate — Waiter activates table
router.post('/:restaurantId/:tableId/activate', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN, ROLES.WAITER), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const table = await Table.findOne({
      _id: req.params.tableId,
      restaurant_id: req.params.restaurantId,
    });
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    if (table.status === TABLE_STATUS.OCCUPIED) {
      return res.status(400).json({ success: false, message: 'Table is already occupied with an active session' });
    }
    const { customer_name, customer_phone } = req.body;

    // Create a new session
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.SESSION_EXPIRY_HOURS || 12));
    const session = await Session.create({
      restaurant_id: req.params.restaurantId,
      table_id: table._id,
      table_number: table.table_number,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      managed_by: req.user._id,
      expires_at: expiresAt,
    });
    table.status = TABLE_STATUS.ACTIVE;
    table.activated_by = req.user._id;
    table.activated_at = new Date();
    table.current_session_id = session._id;
    await table.save();
    // Emit socket event
    const io = req.app.get('io');
    io?.to(`restaurant:${req.params.restaurantId}`).emit('table-activated', {
      table_id: table._id,
      table_number: table.table_number,
      session_id: session._id,
    });
    logger.info(`Table ${table.table_number} activated by ${req.user.name} at restaurant ${req.params.restaurantId}`);
    res.json({ success: true, data: { table, session } });
  } catch (err) {
    next(err);
  }
});

// POST /api/tables/:restaurantId/:tableId/deactivate — Waiter deactivates table
router.post('/:restaurantId/:tableId/deactivate', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN, ROLES.WAITER), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const table = await Table.findOne({ _id: req.params.tableId, restaurant_id: req.params.restaurantId });
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    // Close active session
    const activeSessionId = table.current_session_id;
    if (activeSessionId) {
      await Session.findByIdAndUpdate(activeSessionId, {
        status: SESSION_STATUS.CLOSED,
        closed_at: new Date(),
      });
    }
    table.status = TABLE_STATUS.INACTIVE;
    table.current_session_id = null;
    table.activated_by = null;
    table.activated_at = null;
    await table.save();
    const io = req.app.get('io');
    io?.to(`restaurant:${req.params.restaurantId}`).emit('table-deactivated', { table_id: table._id });
    if (activeSessionId) {
      io?.to(`session:${activeSessionId}`).emit('session-closed', { session_id: activeSessionId });
    }
    res.json({ success: true, data: { table } });
  } catch (err) {
    next(err);
  }
});

// POST /api/tables/:restaurantId/regenerate-qr — Regenerate all QR codes
router.post('/:restaurantId/regenerate-qr', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const restaurant = await Restaurant.findById(req.params.restaurantId).select('slug');
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const tables = await Table.find({ restaurant_id: req.params.restaurantId });
    await Promise.all(tables.map(async (table) => {
      const qrToken = crypto.randomUUID();
      const qrUrl = `${frontendUrl}/${restaurant.slug}/menu?table=${table.table_number}&token=${qrToken}`;
      const qrCode = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });
      table.qr_url = qrUrl;
      table.qr_code = qrCode;
      table.qr_token = qrToken;
      return table.save();
    }));
    res.json({ success: true, message: `Regenerated QR for ${tables.length} tables` });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tables/:restaurantId/:tableId
router.delete('/:restaurantId/:tableId', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const table = await Table.findOneAndDelete({ _id: req.params.tableId, restaurant_id: req.params.restaurantId });
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    res.json({ success: true, message: 'Table deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
