'use strict';

const mongoose = require('mongoose');
const { ITEM_TYPE } = require('../config/constants');

const menuItemSchema = new mongoose.Schema(
  {
    restaurant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [150, 'Name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      maxlength: 500,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    image: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(ITEM_TYPE),
      default: ITEM_TYPE.VEG,
    },
    tags: [{ type: String, trim: true }],
    is_available: {
      type: Boolean,
      default: true,
      index: true,
    },
    is_featured: {
      type: Boolean,
      default: false,
    },
    sort_order: {
      type: Number,
      default: 0,
    },
    // Nutritional info (optional)
    calories: { type: Number, default: null },
    allergens: [{ type: String }],
    // Customization options
    variants: [
      {
        name: { type: String, required: true },
        options: [
          {
            label: { type: String, required: true },
            extra_price: { type: Number, default: 0 },
          },
        ],
      },
    ],
    preparation_time_minutes: {
      type: Number,
      default: 15,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound Indexes ─────────────────────────────────────────────────────────
menuItemSchema.index({ restaurant_id: 1, category: 1 });
menuItemSchema.index({ restaurant_id: 1, is_available: 1 });
menuItemSchema.index({ restaurant_id: 1, is_featured: 1 });
menuItemSchema.index({ restaurant_id: 1, sort_order: 1 });
menuItemSchema.index({ name: 'text', description: 'text', tags: 'text' }); // Full-text search

module.exports = mongoose.model('Menu', menuItemSchema);
