'use strict';

const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Table = require('../models/Table');
const { authenticate } = require('../middleware/auth');
const { ROLES, SESSION_STATUS, TABLE_STATUS, PAYMENT_STATUS } = require('../config/constants');
const logger = require('../utils/logger');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const { calculateBill } = require('../utils/helpers');

// POST /api/payments/:sessionId/confirm — Waiter confirms payment
router.post('/:sessionId/confirm', authenticate, async (req, res, next) => {
  try {
    const { payment_method, payment_reference } = req.body;
    const session = await Session.findById(req.params.sessionId).populate('order_ids');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(session.restaurant_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (session.payment_status === PAYMENT_STATUS.PAID) {
      return res.status(400).json({ success: false, message: 'Payment already confirmed' });
    }

    if (session.status !== SESSION_STATUS.BILLED || !session.total) {
      const restaurant = await Restaurant.findById(session.restaurant_id).select('gst_percent');
      const gstPercent = restaurant?.gst_percent ?? 5;
      const orderedItems = {};
      (session.order_ids || []).forEach(order => {
        if (!order.is_cancelled) {
          order.items.forEach(item => {
            const key = item.menu_item_id?.toString() || item.name;
            if (orderedItems[key]) {
              orderedItems[key].quantity += item.quantity;
              orderedItems[key].subtotal += item.subtotal;
            } else {
              orderedItems[key] = { ...item.toObject ? item.toObject() : item };
            }
          });
        }
      });
      const consolidatedItems = Object.values(orderedItems);
      const bill = calculateBill(consolidatedItems, gstPercent);
      session.subtotal = bill.subtotal;
      session.gst_percent = bill.gstPercent;
      session.gst_amount = bill.gst;
      session.total = bill.total;
    }

    session.payment_status = PAYMENT_STATUS.PAID;
    session.payment_method = payment_method || 'upi';
    session.payment_reference = payment_reference || null;
    session.status = SESSION_STATUS.CLOSED;
    session.closed_at = new Date();
    await session.save();
    // Reset table status to inactive
    await Table.findByIdAndUpdate(session.table_id, {
      status: TABLE_STATUS.INACTIVE,
      current_session_id: null,
      activated_by: null,
      activated_at: null,
    });
    // Broadcast
    const io = req.app.get('io');
    io?.to(`session:${req.params.sessionId}`).emit('payment-confirmed', {
      session_id: session._id,
      payment_method: session.payment_method,
      total: session.total,
    });
    io?.to(`session:${req.params.sessionId}`).emit('session-closed', {
      session_id: session._id,
    });
    io?.to(`restaurant:${session.restaurant_id}`).emit('session-closed', {
      session_id: session._id,
      table_id: session.table_id,
    });
    logger.info(`Payment confirmed for session ${req.params.sessionId} — Method: ${payment_method}`);
    res.json({ success: true, data: { session } });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/summary/:restaurantId — Daily revenue summary
router.get('/summary/:restaurantId', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { date } = req.query;
    const start = date ? new Date(date) : new Date();
    if (isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const sessions = await Session.find({
      restaurant_id: req.params.restaurantId,
      payment_status: PAYMENT_STATUS.PAID,
      closed_at: { $gte: start, $lte: end },
    }).lean();
    const summary = {
      total_sessions: sessions.length,
      total_revenue: sessions.reduce((sum, s) => sum + (s.total || 0), 0),
      total_gst: sessions.reduce((sum, s) => sum + (s.gst_amount || 0), 0),
      by_method: {},
    };
    sessions.forEach(s => {
      const method = s.payment_method || 'unknown';
      if (!summary.by_method[method]) summary.by_method[method] = { count: 0, amount: 0 };
      summary.by_method[method].count++;
      summary.by_method[method].amount += s.total || 0;
    });
    res.json({ success: true, data: { summary, date: start } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
