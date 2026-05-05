'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { handleSessionEvents } = require('./sessionHandlers');
const { handleOrderEvents } = require('./orderHandlers');
const logger = require('../utils/logger');

/**
 * Initialize Socket.IO event handlers.
 * @param {import('socket.io').Server} io
 */
const initializeSockets = (io) => {
  // Middleware: optional JWT auth for socket connections
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password -refresh_tokens').lean();
        if (user && user.is_active) {
          socket.user = user;
        }
      } catch {
        // Anonymous connection — allowed for customers
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} | User: ${socket.user?.name || 'guest'}`);

    // Auto-join restaurant room if authenticated
    if (socket.user?.restaurant_id) {
      socket.join(`restaurant:${socket.user.restaurant_id}`);
    }

    // Auto-join kitchen room if kitchen role
    if (socket.user?.role === 'kitchen' || socket.user?.role === 'waiter') {
      socket.join(`kitchen:${socket.user.restaurant_id}`);
    }

    // Register event handlers
    handleSessionEvents(io, socket);
    handleOrderEvents(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} — ${reason}`);
    });

    socket.on('error', (err) => {
      logger.error(`Socket error [${socket.id}]:`, err);
    });
  });

  logger.info('✅ Socket.IO initialized');
};

module.exports = { initializeSockets };
