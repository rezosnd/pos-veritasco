'use strict';

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, generateTokens, verifyRefreshToken } = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { ROLES } = require('../config/constants');
const logger = require('../utils/logger');

// POST /api/auth/login
router.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }
    const { accessToken, refreshToken } = generateTokens(user);
    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    user.refresh_tokens.push({ token: refreshToken, device: req.headers['user-agent'] || 'unknown', expires_at: expiresAt });
    // Keep max 5 refresh tokens
    if (user.refresh_tokens.length > 5) user.refresh_tokens.shift();
    user.last_login = new Date();
    await user.save();
    logger.info(`User login: ${user.email} [${user.role}]`);
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          restaurant_id: user.restaurant_id,
          avatar: user.avatar,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    const user = await User.findById(decoded.id);
    if (!user || !user.is_active) return res.status(401).json({ success: false, message: 'User not found' });
    const tokenExists = user.refresh_tokens.some(t => t.token === refreshToken && t.expires_at > new Date());
    if (!tokenExists) return res.status(401).json({ success: false, message: 'Refresh token expired or revoked' });
    // Issue new access token
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    // Replace old refresh token
    user.refresh_tokens = user.refresh_tokens.filter(t => t.token !== refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    user.refresh_tokens.push({ token: newRefreshToken, device: req.headers['user-agent'] || 'unknown', expires_at: expiresAt });
    await user.save();
    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      req.user.refresh_tokens = req.user.refresh_tokens.filter(t => t.token !== refreshToken);
      await req.user.save();
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

// PATCH /api/auth/change-password
router.patch('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new password required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    user.refresh_tokens = []; // Invalidate all sessions
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
