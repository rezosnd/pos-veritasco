'use strict';

const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const Table = require('../models/Table');
const { authenticate } = require('../middleware/auth');
const { ROLES, SESSION_STATUS, TABLE_STATUS, PAYMENT_STATUS } = require('../config/constants');
const { calculateBill, buildWhatsAppUrl, buildUpiUrl } = require('../utils/helpers');

// GET /api/billing/:sessionId — Get full bill for a session (public)
router.get('/:sessionId', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.sessionId)
      .populate('order_ids')
      .lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    const restaurant = await Restaurant.findById(session.restaurant_id)
      .select('name logo upi_id whatsapp_number gst_percent gst_number theme_color address phone')
      .lean();
    // Consolidate all items across all orders
    const orderedItems = {};
    (session.order_ids || []).forEach(order => {
      if (!order.is_cancelled) {
        order.items.forEach(item => {
          const key = item.menu_item_id?.toString() || item.name;
          if (orderedItems[key]) {
            orderedItems[key].quantity += item.quantity;
            orderedItems[key].subtotal += item.subtotal;
          } else {
            orderedItems[key] = { ...item };
          }
        });
      }
    });
    const consolidatedItems = Object.values(orderedItems);
    const gstPercent = restaurant?.gst_percent ?? 5;
    const bill = calculateBill(consolidatedItems, gstPercent);
    // Build WhatsApp URL
    const waUrl = buildWhatsAppUrl({
      phone: session.customer_phone || restaurant?.whatsapp_number,
      restaurantName: restaurant?.name,
      items: consolidatedItems,
      ...bill,
    });
    // Build UPI URL
    const upiUrl = restaurant?.upi_id
      ? buildUpiUrl({ upiId: restaurant.upi_id, name: restaurant.name, amount: bill.total })
      : null;
    res.json({
      success: true,
      data: {
        session: {
          _id: session._id,
          table_number: session.table_number,
          status: session.status,
          payment_status: session.payment_status,
          created_at: session.createdAt,
          customer_name: session.customer_name,
          customer_phone: session.customer_phone,
        },
        restaurant,
        orders: session.order_ids,
        items: consolidatedItems,
        bill,
        waUrl,
        upiUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/billing/:sessionId/finalize — Waiter finalizes bill
router.post('/:sessionId/finalize', authenticate, async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.sessionId).populate('order_ids');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(session.restaurant_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (session.status === SESSION_STATUS.CLOSED) {
      return res.status(400).json({ success: false, message: 'Session already closed' });
    }
    const restaurant = await Restaurant.findById(session.restaurant_id).select('gst_percent').lean();
    const gstPercent = restaurant?.gst_percent ?? 5;
    // Consolidate items
    const orderedItems = {};
    session.order_ids.forEach(order => {
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
    session.status = SESSION_STATUS.BILLED;
    session.subtotal = bill.subtotal;
    session.gst_percent = bill.gstPercent;
    session.gst_amount = bill.gst;
    session.total = bill.total;
    const discount = Math.round((Number(req.body.discount) || 0) * 100) / 100;
    if (discount < 0) {
      return res.status(400).json({ success: false, message: 'Discount cannot be negative' });
    }
    if (discount > bill.subtotal) {
      return res.status(400).json({ success: false, message: 'Discount cannot exceed subtotal' });
    }
    session.discount = discount;
    await session.save();
    // Broadcast bill to table
    const io = req.app.get('io');
    io?.to(`session:${req.params.sessionId}`).emit('bill-finalized', { bill, session_id: session._id });
    res.json({ success: true, data: { session, bill } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
