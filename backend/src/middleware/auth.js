'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROLES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Verify JWT and attach user to request.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    const user = await User.findById(decoded.id).select('+password_reset_token');
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }
    req.user = user;
    next();
  } catch (err) {
    logger.error('Auth middleware error:', err);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

/**
 * Authorize by role(s).
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(' or ')}`,
    });
  }
  next();
};

/**
 * Ensure the user belongs to the restaurant in the request.
 */
const authorizeRestaurant = (paramName = 'restaurantId') => async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (req.user.role === ROLES.SUPER_ADMIN) return next();
    const restaurantId = req.params[paramName] || req.body.restaurant_id || req.query.restaurant_id;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Restaurant ID required' });
    }
    if (!req.user.belongsTo(restaurantId)) {
      return res.status(403).json({ success: false, message: 'Access denied to this restaurant' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Generate access + refresh token pair.
 */
const generateTokens = (user) => {
  const payload = {
    id: user._id,
    role: user.role,
    restaurant_id: user.restaurant_id,
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { accessToken, refreshToken };
};

/**
 * Verify a refresh token.
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  authenticate,
  authorize,
  authorizeRestaurant,
  generateTokens,
  verifyRefreshToken,
};
