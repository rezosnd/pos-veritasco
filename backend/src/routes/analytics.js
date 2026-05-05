'use strict';

const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Session = require('../models/Session');
const Menu = require('../models/Menu');
const Table = require('../models/Table');
const { authenticate } = require('../middleware/auth');
const { ROLES, PAYMENT_STATUS } = require('../config/constants');

// GET /api/analytics/:restaurantId/dashboard — Dashboard stats
router.get('/:restaurantId/dashboard', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.SUPER_ADMIN && !req.user.belongsTo(req.params.restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOf7DaysAgo = new Date();
    startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 7);
    startOf7DaysAgo.setHours(0, 0, 0, 0);

    const startOf30DaysAgo = new Date();
    startOf30DaysAgo.setDate(startOf30DaysAgo.getDate() - 30);
    startOf30DaysAgo.setHours(0, 0, 0, 0);

    const [
      todaySessions,
      weekSessions,
      monthSessions,
      todayOrders,
      totalMenuItems,
      activeTablesCount,
      topItems,
      revenueByDay,
    ] = await Promise.all([
      // Today's paid sessions
      Session.find({
        restaurant_id: req.params.restaurantId,
        payment_status: PAYMENT_STATUS.PAID,
        closed_at: { $gte: startOfToday },
      }).select('total').lean(),
      // Week's paid sessions
      Session.find({
        restaurant_id: req.params.restaurantId,
        payment_status: PAYMENT_STATUS.PAID,
        closed_at: { $gte: startOf7DaysAgo },
      }).select('total').lean(),
      // Month's paid sessions
      Session.find({
        restaurant_id: req.params.restaurantId,
        payment_status: PAYMENT_STATUS.PAID,
        closed_at: { $gte: startOf30DaysAgo },
      }).select('total').lean(),
      // Today's orders
      Order.countDocuments({
        restaurant_id: req.params.restaurantId,
        createdAt: { $gte: startOfToday },
        is_cancelled: false,
      }),
      // Total menu items
      Menu.countDocuments({ restaurant_id: req.params.restaurantId, is_available: true }),
      // Active tables count
      Table.countDocuments({ restaurant_id: req.params.restaurantId, status: 'active' }),
      // Top 5 items (last 30 days)
      Order.aggregate([
        {
          $match: {
            restaurant_id: req.params.restaurantId,
            createdAt: { $gte: startOf30DaysAgo },
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
            closed_at: { $gte: startOf7DaysAgo },
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
    const weekRevenue = weekSessions.reduce((s, sess) => s + (sess.total || 0), 0);
    const monthRevenue = monthSessions.reduce((s, sess) => s + (sess.total || 0), 0);

    res.json({
      success: true,
      data: {
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        weekRevenue: Math.round(weekRevenue * 100) / 100,
        monthRevenue: Math.round(monthRevenue * 100) / 100,
        activeTables: activeTablesCount,
        todayOrders,
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
