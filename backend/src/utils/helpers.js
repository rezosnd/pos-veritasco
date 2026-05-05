'use strict';

const crypto = require('crypto');

/**
 * Haversine formula to calculate distance between two coordinates in meters.
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Check if a user is within the allowed radius of the restaurant.
 */
const isWithinRestaurantRadius = (userLat, userLon, restLat, restLon, radiusMeters = 100) => {
  const distance = haversineDistance(userLat, userLon, restLat, restLon);
  return { allowed: distance <= radiusMeters, distance: Math.round(distance) };
};

/**
 * Paginate a mongoose query.
 */
const paginate = (query, page = 1, limit = 20) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;
  return query.skip(skip).limit(limitNum);
};

/**
 * Build pagination metadata.
 */
const paginationMeta = (total, page, limit) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  return {
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    hasNext: pageNum * limitNum < total,
    hasPrev: pageNum > 1,
  };
};

/**
 * Format currency to INR string.
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Build a UPI payment URL.
 */
const buildUpiUrl = ({ upiId, name, amount, note = 'Restaurant Bill' }) => {
  const params = new URLSearchParams({
    pa: upiId,
    pn: name,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
};

/**
 * Build WhatsApp bill message URL.
 */
const buildWhatsAppUrl = ({ phone, restaurantName, items, subtotal, gst, total }) => {
  const lines = [
    `🍽️ *${restaurantName}*`,
    `━━━━━━━━━━━━━━━━━`,
    `📋 *Bill Summary*`,
    ``,
    ...items.map(i => `• ${i.name} x${i.quantity}  ₹${(i.price * i.quantity).toFixed(2)}`),
    ``,
    `━━━━━━━━━━━━━━━━━`,
    `Subtotal: ₹${subtotal.toFixed(2)}`,
    `GST (5%): ₹${gst.toFixed(2)}`,
    `*Total: ₹${total.toFixed(2)}*`,
    ``,
    `Thank you for dining with us! 🙏`,
  ];
  const text = encodeURIComponent(lines.join('\n'));
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${text}`
    : `https://wa.me/?text=${text}`;
};

/**
 * Calculate bill from cart items.
 */
const calculateBill = (items, gstPercent = 5) => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const gst = (subtotal * gstPercent) / 100;
  const total = subtotal + gst;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    gstPercent,
    total: Math.round(total * 100) / 100,
  };
};

/**
 * Sanitize phone number (add country code if missing).
 */
const sanitizePhone = (phone, countryCode = '91') => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `${countryCode}${digits}`;
  return digits;
};

/**
 * Generate a short random token.
 */
const generateToken = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

/**
 * Sleep (promisified timeout).
 */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports = {
  haversineDistance,
  isWithinRestaurantRadius,
  paginate,
  paginationMeta,
  formatCurrency,
  buildUpiUrl,
  buildWhatsAppUrl,
  calculateBill,
  sanitizePhone,
  generateToken,
  sleep,
};
