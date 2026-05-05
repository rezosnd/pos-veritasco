'use strict';

const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Session = require('../models/Session');
const Table = require('../models/Table');
const Menu = require('../models/Menu');
const { authenticate, authorize } = require('../middleware/auth');
const { orderRateLimiter } = require('../middleware/rateLimiter');
const { ROLES, ORDER_STATUS, TABLE_STATUS, SESSION_STATUS } = require('../config/constants');
const logger = require('../utils/logger');

// POST /api/orders — Place new order (customer or waiter)
router.post('/', orderRateLimiter, async (req, res, next) => {
  try {
    const { session_id, items, kitchen_notes = '' } = req.body;
    if (!session_id || !items?.length) {
      return res.status(400).json({ success: false, message: 'session_id and items are required' });
    }
    const session = await Session.findById(session_id).populate('table_id');
    if (!session || session.status !== SESSION_STATUS.ACTIVE) {
      return res.status(404).json({ success: false, message: 'Session not found or closed' });
    }

    // Determine placed_by server-side — never trust the client for this
    const placed_by = req.user ? 'waiter' : 'customer';

    // Fetch authoritative prices from Menu DB — never trust client-supplied prices
    const menuItemIds = items.map(i => i.menu_item_id).filter(Boolean);
    const menuDocs = await Menu.find({
      _id: { $in: menuItemIds },
      restaurant_id: session.restaurant_id,
      is_available: true,
    }).select('_id name price').lean();
    const menuMap = new Map(menuDocs.map(m => [m._id.toString(), m]));

    const orderItems = [];
    for (const item of items) {
      const menuItem = menuMap.get(item.menu_item_id?.toString());
      if (!menuItem) {
        return res.status(400).json({
          success: false,
          message: `Menu item not found or unavailable: ${item.menu_item_id}`,
        });
      }
      const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
      const subtotal = Math.round(menuItem.price * quantity * 100) / 100;
      orderItems.push({
        ...item,
        price: menuItem.price,   // authoritative price from DB
        quantity,
        subtotal,
      });
    }
    const subtotal = orderItems.reduce((sum, i) => sum + i.subtotal, 0);
    const order = await Order.create({
      restaurant_id: session.restaurant_id,
      session_id,
      table_id: session.table_id._id,
      table_number: session.table_number,
      items: orderItems,
      subtotal: Math.round(subtotal * 100) / 100,
      placed_by,
      placed_by_user: req.user?._id || null,
      kitchen_notes,
    });
    // Add order to session
    session.order_ids.push(order._id);
    // Update table status to occupied
    if (session.table_id.status === TABLE_STATUS.ACTIVE) {
      await Table.findByIdAndUpdate(session.table_id._id, { status: TABLE_STATUS.OCCUPIED });
    }
    await session.save();
    logger.info(`Order ${order.order_number} placed for session ${session_id}`);
    // Broadcast via Socket.IO
    const io = req.app.get('io');
    const orderData = order.toJSON();
    // Notify kitchen
    io?.to(`kitchen:${session.restaurant_id}`).emit('new-order', orderData);
    // Notify table
    io?.to(`session:${session_id}`).emit('order-placed', orderData);
    // Notify waiter dashboard
    io?.to(`restaurant:${session.restaurant_id}`).emit('new-order', orderData);
    res.status(201).json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/restaurant/:restaurantId — All orders (waiter/admin/kitchen)
router.get('/restaurant/:restaurantId', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { status, session_id, page = 1, limit = 50 } = req.query;
    const query = { restaurant_id: req.params.restaurantId };
    if (status) query.status = status;
    if (session_id) query.session_id = session_id;
    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments(query),
    ]);
    res.json({ success: true, data: { orders, total, page: parseInt(page) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/session/:sessionId — Orders for a session (public)
router.get('/session/:sessionId', async (req, res, next) => {
  try {
    const orders = await Order.find({ session_id: req.params.sessionId })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ success: true, data: { orders } });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/kitchen/:restaurantId — KDS: pending/preparing orders
router.get('/kitchen/:restaurantId', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN, ROLES.KITCHEN, ROLES.WAITER), async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const orders = await Order.find({
      restaurant_id: req.params.restaurantId,
      status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY] },
      is_cancelled: false,
    }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: { orders } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:orderId/status — Update order status (kitchen/waiter)
router.patch('/:orderId/status', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.RESTAURANT_ADMIN, ROLES.KITCHEN, ROLES.WAITER), async (req, res, next) => {
  try {
    const { status, note = '' } = req.body;
    if (!Object.values(ORDER_STATUS).includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(order.restaurant_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    order.status = status;
    order.status_history.push({ status, changed_by: req.user._id, note });
    if (status === ORDER_STATUS.READY) order.prepared_at = new Date();
    if (status === ORDER_STATUS.SERVED) order.served_at = new Date();
    await order.save();
    // Broadcast
    const io = req.app.get('io');
    io?.to(`session:${order.session_id}`).emit('order-updated', { order_id: order._id, status });
    io?.to(`kitchen:${order.restaurant_id}`).emit('order-updated', order.toJSON());
    io?.to(`restaurant:${order.restaurant_id}`).emit('order-updated', order.toJSON());
    res.json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:orderId/cancel
router.patch('/:orderId/cancel', authenticate, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(order.restaurant_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (order.status === ORDER_STATUS.SERVED) {
      return res.status(400).json({ success: false, message: 'Cannot cancel a served order' });
    }
    order.is_cancelled = true;
    order.status = ORDER_STATUS.CANCELLED;
    order.cancel_reason = req.body.reason || '';
    order.status_history.push({ status: ORDER_STATUS.CANCELLED, changed_by: req.user._id });
    await order.save();
    const io = req.app.get('io');
    io?.to(`session:${order.session_id}`).emit('order-updated', { order_id: order._id, status: ORDER_STATUS.CANCELLED });
    io?.to(`kitchen:${order.restaurant_id}`).emit('order-updated', order.toJSON());
    res.json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
