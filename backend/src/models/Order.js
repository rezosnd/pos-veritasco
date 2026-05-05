'use strict';

const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../config/constants');

const orderItemSchema = new mongoose.Schema(
  {
    menu_item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    type: { type: String },
    category: { type: String },
    image: { type: String },
    special_instructions: { type: String, default: '' },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    restaurant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    table_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
    },
    table_number: { type: String, required: true },
    order_number: {
      type: String,
      required: true,
    },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    // Status history for audit
    status_history: [
      {
        status: { type: String, enum: Object.values(ORDER_STATUS) },
        changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],
    subtotal: { type: Number, required: true },
    // Source
    placed_by: {
      type: String,
      enum: ['customer', 'waiter'],
      default: 'customer',
    },
    placed_by_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Kitchen
    kitchen_notes: { type: String, default: '' },
    estimated_time_minutes: { type: Number, default: null },
    prepared_at: { type: Date, default: null },
    served_at: { type: Date, default: null },
    is_cancelled: { type: Boolean, default: false },
    cancel_reason: { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound Indexes ─────────────────────────────────────────────────────────
orderSchema.index({ restaurant_id: 1, status: 1 });
orderSchema.index({ restaurant_id: 1, createdAt: -1 });
orderSchema.index({ session_id: 1, createdAt: 1 });
orderSchema.index({ restaurant_id: 1, order_number: 1 }, { unique: true });

// ─── Pre-save: generate order number ─────────────────────────────────────────
orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Order').countDocuments({
      restaurant_id: this.restaurant_id,
    });
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    this.order_number = `ORD-${dateStr}-${String(count + 1).padStart(4, '0')}`;
    // Add initial status to history
    this.status_history.push({ status: this.status });
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
