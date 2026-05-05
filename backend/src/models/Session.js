'use strict';

const mongoose = require('mongoose');
const { SESSION_STATUS, PAYMENT_STATUS } = require('../config/constants');

const cartItemSchema = new mongoose.Schema(
  {
    menu_item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    type: { type: String },
    image: { type: String },
    category: { type: String },
    special_instructions: { type: String, default: '' },
    added_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    restaurant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    table_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
      index: true,
    },
    table_number: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.ACTIVE,
      index: true,
    },
    // Customer Details (from onboarding)
    customer_name: { type: String, default: null },
    customer_phone: { type: String, default: null },
    
    // Users in this session (socket IDs or anonymous identifiers)
    users: [
      {
        socket_id: { type: String },
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        name: { type: String, default: 'Guest' },
        joined_at: { type: Date, default: Date.now },
      },
    ],
    // Real-time shared cart
    cart: [cartItemSchema],
    // Orders placed (references)
    order_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    // Bill
    subtotal: { type: Number, default: 0 },
    gst_percent: { type: Number, default: 5 },
    gst_amount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    // Payment
    payment_status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    payment_method: {
      type: String,
      enum: ['upi', 'cash', 'card', 'other', null],
      default: null,
    },
    payment_reference: { type: String, default: null },
    // Timestamps
    expires_at: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL index
    },
    closed_at: { type: Date, default: null },
    // Waiter who manages this session
    managed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound Indexes ─────────────────────────────────────────────────────────
sessionSchema.index({ restaurant_id: 1, status: 1 });
sessionSchema.index({ table_id: 1, status: 1 });
sessionSchema.index({ restaurant_id: 1, createdAt: -1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
sessionSchema.virtual('orders', {
  ref: 'Order',
  localField: 'order_ids',
  foreignField: '_id',
});

// ─── Methods ─────────────────────────────────────────────────────────────────
sessionSchema.methods.recalculate = function (gstPercent) {
  const gst = gstPercent ?? this.gst_percent;
  const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const gstAmount = (subtotal * gst) / 100;
  const total = subtotal + gstAmount - this.discount;
  this.subtotal = Math.round(subtotal * 100) / 100;
  this.gst_amount = Math.round(gstAmount * 100) / 100;
  this.total = Math.round(total * 100) / 100;
  return this;
};

module.exports = mongoose.model('Session', sessionSchema);
