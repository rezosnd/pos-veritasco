'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant_pos';

const options = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 10000,
  family: 4,
};

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    const conn = await mongoose.connect(MONGODB_URI, options);
    isConnected = true;
    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);

    // Enable query profiling in development
    if (process.env.NODE_ENV === 'development') {
      mongoose.set('debug', true);
    }
  } catch (err) {
    logger.error('❌ MongoDB connection failed:', err.message);
    // Let the process crash or handle gracefully at top level, avoid infinite reconnect loops
  }
};

// Monitor connection events
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('⚠️ MongoDB disconnected — relying on mongoose auto-reconnect');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  logger.info('✅ MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
  isConnected = false;
});

module.exports = connectDB;
