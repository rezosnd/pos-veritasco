'use strict';

const Order = require('../models/Order');
const { SOCKET_EVENTS, ORDER_STATUS } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Handle all order-related socket events (primarily for KDS).
 */
const handleOrderEvents = (io, socket) => {
  // Kitchen updates order status — requires authenticated staff
  socket.on(SOCKET_EVENTS.ORDER_STATUS_CHANGE, async (data) => {
    try {
      if (!socket.user) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Authentication required' });
      }
      const { order_id, status, note = '' } = data;
      if (!order_id || !status) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'order_id and status required' });
      }
      if (!Object.values(ORDER_STATUS).includes(status)) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid order status' });
      }
      const order = await Order.findById(order_id);
      if (!order) return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Order not found' });
      // Verify the user belongs to the same restaurant as the order
      if (socket.user.role !== 'super_admin' &&
          socket.user.restaurant_id?.toString() !== order.restaurant_id?.toString()) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Access denied' });
      }
      order.status = status;
      order.status_history.push({
        status,
        changed_by: socket.user?._id || null,
        note,
        timestamp: new Date(),
      });
      if (status === ORDER_STATUS.READY) order.prepared_at = new Date();
      if (status === ORDER_STATUS.SERVED) order.served_at = new Date();
      await order.save();
      const orderData = order.toJSON();
      // Notify customer table
      io.to(`session:${order.session_id}`).emit(SOCKET_EVENTS.ORDER_UPDATED, {
        order_id: order._id,
        order_number: order.order_number,
        status,
      });
      // Notify all kitchen displays
      io.to(`kitchen:${order.restaurant_id}`).emit(SOCKET_EVENTS.ORDER_UPDATED, orderData);
      // Notify waiter dashboard
      io.to(`restaurant:${order.restaurant_id}`).emit(SOCKET_EVENTS.ORDER_UPDATED, orderData);
      logger.info(`Order ${order.order_number} status → ${status}`);
    } catch (err) {
      logger.error('order-status-change error:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update order status' });
    }
  });

  // Subscribe to kitchen feed — requires authenticated staff belonging to the restaurant
  socket.on('subscribe-kitchen', (data) => {
    if (!socket.user) {
      return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Authentication required' });
    }
    const { restaurant_id } = data;
    if (!restaurant_id) return;
    if (socket.user.role !== 'super_admin' &&
        socket.user.restaurant_id?.toString() !== restaurant_id.toString()) {
      return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Access denied' });
    }
    socket.join(`kitchen:${restaurant_id}`);
    logger.info(`Socket ${socket.id} subscribed to kitchen:${restaurant_id}`);
  });

  // Subscribe to restaurant dashboard — requires authenticated staff belonging to the restaurant
  socket.on('subscribe-restaurant', (data) => {
    if (!socket.user) {
      return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Authentication required' });
    }
    const { restaurant_id } = data;
    if (!restaurant_id) return;
    if (socket.user.role !== 'super_admin' &&
        socket.user.restaurant_id?.toString() !== restaurant_id.toString()) {
      return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Access denied' });
    }
    socket.join(`restaurant:${restaurant_id}`);
    logger.info(`Socket ${socket.id} subscribed to restaurant:${restaurant_id}`);
  });
};

module.exports = { handleOrderEvents };
