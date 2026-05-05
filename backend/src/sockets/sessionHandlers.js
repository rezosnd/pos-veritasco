'use strict';

const Session = require('../models/Session');
const Table = require('../models/Table');
const { SESSION_STATUS, SOCKET_EVENTS, TABLE_STATUS } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Handle all session-related socket events.
 */
const handleSessionEvents = (io, socket) => {
  // Customer joins a table session
  socket.on(SOCKET_EVENTS.JOIN_SESSION, async (data) => {
    try {
      const { session_id, user_name = 'Guest' } = data;
      if (!session_id) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'session_id required' });
      }
      const session = await Session.findById(session_id)
        .populate('order_ids')
        .lean();
      if (!session || session.status !== SESSION_STATUS.ACTIVE) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Session not found or closed', code: 'SESSION_INVALID' });
      }
      // Join session room
      socket.join(`session:${session_id}`);
      // Add user to session
      await Session.findByIdAndUpdate(session_id, {
        $push: {
          users: {
            socket_id: socket.id,
            name: user_name,
            joined_at: new Date(),
          },
        },
      });
      socket.emit(SOCKET_EVENTS.SESSION_JOINED, {
        session,
        message: `Joined table ${session.table_number}`,
      });
      // Notify others in the room
      socket.to(`session:${session_id}`).emit('user-joined', {
        socket_id: socket.id,
        name: user_name,
      });
      logger.info(`Socket ${socket.id} joined session ${session_id}`);
    } catch (err) {
      logger.error('join-session error:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join session' });
    }
  });

  // Leave session
  socket.on(SOCKET_EVENTS.LEAVE_SESSION, async (data) => {
    try {
      const { session_id } = data;
      if (!session_id) return;
      socket.leave(`session:${session_id}`);
      await Session.findByIdAndUpdate(session_id, {
        $pull: { users: { socket_id: socket.id } },
      });
      socket.to(`session:${session_id}`).emit('user-left', { socket_id: socket.id });
    } catch (err) {
      logger.error('leave-session error:', err);
    }
  });

  // Real-time cart update (shared cart)
  socket.on(SOCKET_EVENTS.CART_UPDATE, async (data) => {
    try {
      const { session_id, cart } = data;
      if (!session_id || !Array.isArray(cart)) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'session_id and cart array required' });
      }
      const session = await Session.findById(session_id);
      if (!session || session.status !== SESSION_STATUS.ACTIVE) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Session not found or closed' });
      }
      session.cart = cart;
      session.recalculate();
      await session.save();
      // Broadcast updated cart to ALL users in this session (including sender)
      io.to(`session:${session_id}`).emit(SOCKET_EVENTS.CART_UPDATED, {
        cart: session.cart,
        subtotal: session.subtotal,
        gst_amount: session.gst_amount,
        total: session.total,
      });
    } catch (err) {
      logger.error('cart-update error:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update cart' });
    }
  });

  // Request bill
  socket.on(SOCKET_EVENTS.REQUEST_BILL, async (data) => {
    try {
      const { session_id } = data;
      // Notify waiter dashboard
      const session = await Session.findById(session_id).lean();
      if (session) {
        io.to(`restaurant:${session.restaurant_id}`).emit('bill-requested', {
          session_id,
          table_number: session.table_number,
        });
      }
    } catch (err) {
      logger.error('request-bill error:', err);
    }
  });

  // Cleanup on disconnect
  socket.on('disconnect', async () => {
    try {
      // Remove user from any sessions they were in
      await Session.updateMany(
        { 'users.socket_id': socket.id },
        { $pull: { users: { socket_id: socket.id } } }
      );
    } catch (err) {
      logger.error('Socket disconnect cleanup error:', err);
    }
  });
};

module.exports = { handleSessionEvents };
