'use strict';

const mongoose = require('mongoose');
const { TABLE_STATUS } = require('../config/constants');

const tableSchema = new mongoose.Schema(
  {
    restaurant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    table_number: {
      type: String,
      required: [true, 'Table number is required'],
      trim: true,
    },
    display_name: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      default: 4,
      min: 1,
      max: 50,
    },
    status: {
      type: String,
      enum: Object.values(TABLE_STATUS),
      default: TABLE_STATUS.INACTIVE,
      index: true,
    },
    section: {
      type: String,
      trim: true,
      default: 'Main',
    },
    qr_code: {
      type: String, // Base64 QR image
      default: null,
    },
    qr_url: {
      type: String, // Full URL encoded in QR
      default: null,
    },
    qr_token: {
      type: String, // Secure random UUID for URL validation
      default: null,
      sparse: true,
      unique: true,
    },
    // Track who activated
    activated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    activated_at: {
      type: Date,
      default: null,
    },
    // Current active session
    current_session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound Indexes ─────────────────────────────────────────────────────────
tableSchema.index({ restaurant_id: 1, table_number: 1 }, { unique: true });
tableSchema.index({ restaurant_id: 1, status: 1 });
tableSchema.index({ restaurant_id: 1, section: 1 });

module.exports = mongoose.model('Table', tableSchema);
