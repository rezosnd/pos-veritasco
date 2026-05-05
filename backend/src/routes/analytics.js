'use strict';

const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Session = require('../models/Session');
const Menu = require('../models/Menu');
const { authenticate } = require('../middleware/auth');
const { ROLES, PAYMENT_STATUS } = require('../config/constants');

// GET /api/analytics/:restaurantId/dashboard — Dashboard stats
router.get('/:restaurantId/dashboard', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const [
      todaySessions,
      todayOrders,
      totalMenuItems,
      topItems,
      revenueByDay,
    ] = await Promise.all([
      // Today's paid sessions
      Session.find({
        restaurant_id: req.params.restaurantId,
        payment_status: PAYMENT_STATUS.PAID,
        closed_at: { $gte: today, $lte: todayEnd },
      }).lean(),
      // Today's orders
      Order.countDocuments({
        restaurant_id: req.params.restaurantId,
        createdAt: { $gte: today, $lte: todayEnd },
        is_cancelled: false,
      }),
      // Total menu items
      Menu.countDocuments({ restaurant_id: req.params.restaurantId, is_available: true }),
      // Top 5 items (last 30 days)
      Order.aggregate([
        {
          $match: {
            restaurant_id: req.params.restaurantId,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            is_cancelled: false,
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.menu_item_id',
            name: { $first: '$items.name' },
            totalQty: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.subtotal' },
          },
        },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
      ]),
      // Revenue last 7 days
      Session.aggregate([
        {
          $match: {
            restaurant_id: req.params.restaurantId,
            payment_status: PAYMENT_STATUS.PAID,
            closed_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$closed_at' } },
            revenue: { $sum: '$total' },
            sessions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const todayRevenue = todaySessions.reduce((s, sess) => s + (sess.total || 0), 0);
    const avgOrderValue = todaySessions.length > 0 ? todayRevenue / todaySessions.length : 0;

    res.json({
      success: true,
      data: {
        today: {
          revenue: Math.round(todayRevenue * 100) / 100,
          sessions: todaySessions.length,
          orders: todayOrders,
          avg_order_value: Math.round(avgOrderValue * 100) / 100,
        },
        total_menu_items: totalMenuItems,
        top_items: topItems,
        revenue_by_day: revenueByDay,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
