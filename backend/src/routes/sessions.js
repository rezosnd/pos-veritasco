'use strict';

const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Table = require('../models/Table');
const Menu = require('../models/Menu');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES, TABLE_STATUS, SESSION_STATUS } = require('../config/constants');

// GET /api/sessions/table/:tableId — Get active session for a table (public, used after QR scan)
router.get('/table/:restaurantId/:tableNumber', async (req, res, next) => {
  try {
    const table = await Table.findOne({
      restaurant_id: req.params.restaurantId,
      table_number: req.params.tableNumber,
    }).lean();
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    if (table.status === TABLE_STATUS.INACTIVE) {
      return res.status(423).json({ success: false, message: 'Table is not active. Please ask your waiter to activate it.', code: 'TABLE_INACTIVE' });
    }
    const session = await Session.findById(table.current_session_id)
      .populate('order_ids')
      .lean();
    if (!session || session.status !== SESSION_STATUS.ACTIVE) {
      return res.status(423).json({ success: false, message: 'No active session for this table', code: 'NO_SESSION' });
    }
    res.json({ success: true, data: { session, table } });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:sessionId — Get session by ID
router.get('/:sessionId', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.sessionId)
      .populate('order_ids')
      .lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: { session } });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/restaurant/:restaurantId — All sessions (waiter/admin view)
router.get('/restaurant/:restaurantId', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { status, page = 1, limit = 20 } = req.query;
    const query = { restaurant_id: req.params.restaurantId };
    if (status) query.status = status;
    const [sessions, total] = await Promise.all([
      Session.find(query)
        .populate('order_ids')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Session.countDocuments(query),
    ]);
    res.json({ success: true, data: { sessions, total, page: parseInt(page) } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sessions/:sessionId/cart — Update shared cart
router.patch('/:sessionId/cart', async (req, res, next) => {
  try {
    const { cart } = req.body;
    if (!Array.isArray(cart)) return res.status(400).json({ success: false, message: 'cart must be an array' });
    const session = await Session.findById(req.params.sessionId);
    if (!session || session.status !== SESSION_STATUS.ACTIVE) {
      return res.status(404).json({ success: false, message: 'Session not found or closed' });
    }

    // Enforce a reasonable cart size limit
    if (cart.length > 100) {
      return res.status(400).json({ success: false, message: 'Cart exceeds maximum item limit' });
    }

    // Look up authoritative prices from Menu DB — never trust client-supplied prices
    const menuItemIds = cart.map(i => i.menu_item_id).filter(Boolean);
    const menuDocs = await Menu.find({
      _id: { $in: menuItemIds },
      restaurant_id: session.restaurant_id,
      is_available: true,
    }).select('_id price').lean();
    const menuMap = new Map(menuDocs.map(m => [m._id.toString(), m]));

    const sanitizedCart = cart
      .filter(item => menuMap.has(item.menu_item_id?.toString()))
      .map(item => ({
        ...item,
        price: menuMap.get(item.menu_item_id.toString()).price,
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
      }));

    const removedCount = cart.length - sanitizedCart.length;
    session.cart = sanitizedCart;
    session.recalculate();
    await session.save();
    const io = req.app.get('io');
    io?.to(`session:${req.params.sessionId}`).emit('cart-updated', {
      cart: session.cart,
      subtotal: session.subtotal,
      gst_amount: session.gst_amount,
      total: session.total,
    });
    const responseData = { cart: session.cart, total: session.total };
    if (removedCount > 0) {
      responseData.warning = `${removedCount} unavailable item(s) were removed from your cart.`;
    }
    res.json({ success: true, data: responseData });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:sessionId/request-bill — Customer requests the bill (public)
router.post('/:sessionId/request-bill', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status === SESSION_STATUS.CLOSED) {
      return res.status(400).json({ success: false, message: 'Session already closed' });
    }
    // Update table status to bill_requested
    await Table.findByIdAndUpdate(session.table_id, { status: 'bill_requested' });
    // Notify waiter dashboard via socket
    const io = req.app.get('io');
    io?.to(`restaurant:${session.restaurant_id}`).emit('bill-requested', {
      session_id: session._id,
      table_number: session.table_number,
    });
    res.json({ success: true, message: 'Bill requested. Your waiter will be with you shortly.' });
  } catch (err) {
    next(err);
  }
});


// PATCH /api/sessions/:sessionId/notes
router.patch('/:sessionId/notes', authenticate, async (req, res, next) => {
  try {
    const session = await Session.findByIdAndUpdate(
      req.params.sessionId,
      { notes: req.body.notes },
      { new: true }
    );
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: { session } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
