'use strict';

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const restaurantRoutes = require('./restaurants');
const menuRoutes = require('./menu');
const tableRoutes = require('./tables');
const sessionRoutes = require('./sessions');
const orderRoutes = require('./orders');
const billingRoutes = require('./billing');
const paymentRoutes = require('./payments');
const userRoutes = require('./users');
const analyticsRoutes = require('./analytics');

const uploadRoutes = require('./upload');

// Mount routes
router.use('/auth', authRoutes);
router.use('/restaurants', restaurantRoutes);
router.use('/menu', menuRoutes);
router.use('/tables', tableRoutes);
router.use('/sessions', sessionRoutes);
router.use('/orders', orderRoutes);
router.use('/billing', billingRoutes);
router.use('/payments', paymentRoutes);
router.use('/users', userRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/upload', uploadRoutes);

// API info
router.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Restaurant POS API',
    version: '1.0.0',
    endpoints: [
      '/api/auth',
      '/api/restaurants',
      '/api/menu',
      '/api/tables',
      '/api/sessions',
      '/api/orders',
      '/api/billing',
      '/api/payments',
      '/api/users',
      '/api/analytics',
    ],
  });
});

module.exports = router;
