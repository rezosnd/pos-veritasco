'use strict';

module.exports = {
  // Roles
  ROLES: {
    SUPER_ADMIN: 'super_admin',
    RESTAURANT_ADMIN: 'restaurant_admin',
    WAITER: 'waiter',
    KITCHEN: 'kitchen',
  },

  // Table statuses
  TABLE_STATUS: {
    INACTIVE: 'inactive',
    ACTIVE: 'active',
    OCCUPIED: 'occupied',
    BILL_REQUESTED: 'bill_requested',
  },

  // Session statuses
  SESSION_STATUS: {
    ACTIVE: 'active',
    BILLED: 'billed',
    CLOSED: 'closed',
  },

  // Order statuses
  ORDER_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    PREPARING: 'preparing',
    READY: 'ready',
    SERVED: 'served',
    CANCELLED: 'cancelled',
  },

  // Payment statuses
  PAYMENT_STATUS: {
    PENDING: 'pending',
    PAID: 'paid',
    PARTIAL: 'partial',
    REFUNDED: 'refunded',
  },

  // Menu item types
  ITEM_TYPE: {
    VEG: 'veg',
    NON_VEG: 'non_veg',
    VEGAN: 'vegan',
    EGG: 'egg',
  },

  // Default categories
  DEFAULT_CATEGORIES: ['Starters', 'Main Course', 'Breads', 'Rice & Biryani', 'Desserts', 'Beverages', 'Specials'],

  // Geo distance
  GEO_RADIUS_METERS: 100,

  // Session expiry
  SESSION_EXPIRY_HOURS: parseInt(process.env.SESSION_EXPIRY_HOURS) || 12,

  // GST
  DEFAULT_GST_PERCENT: 5,

  // File upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Socket events
  SOCKET_EVENTS: {
    // Client → Server
    JOIN_SESSION: 'join-session',
    LEAVE_SESSION: 'leave-session',
    CART_UPDATE: 'cart-update',
    PLACE_ORDER: 'place-order',
    ORDER_STATUS_CHANGE: 'order-status-change',
    REQUEST_BILL: 'request-bill',

    // Server → Client
    SESSION_JOINED: 'session-joined',
    CART_UPDATED: 'cart-updated',
    NEW_ORDER: 'new-order',
    ORDER_UPDATED: 'order-updated',
    BILL_UPDATED: 'bill-updated',
    TABLE_ACTIVATED: 'table-activated',
    SESSION_CLOSED: 'session-closed',
    ERROR: 'error',
  },
};
