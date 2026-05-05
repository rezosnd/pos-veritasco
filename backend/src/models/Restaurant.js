'use strict';

const mongoose = require('mongoose');
const slugify = require('slugify');

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    logo: {
      type: String, // URL or path
      default: null,
    },
    theme_color: {
      type: String,
      default: '#e85d04',
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color'],
    },
    description: {
      type: String,
      maxlength: 500,
      default: '',
    },
    address: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    phone: {
      type: String,
      match: [/^\+?[0-9]{10,15}$/, 'Invalid phone number'],
      default: null,
    },
    email: {
      type: String,
      lowercase: true,
      default: null,
    },
    // Geolocation for GPS-gated ordering
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: -180,
      max: 180,
    },
    geo_radius_meters: {
      type: Number,
      default: 100,
      min: 10,
      max: 1000,
    },
    // Payment
    upi_id: {
      type: String,
      trim: true,
      default: null,
    },
    whatsapp_number: {
      type: String,
      default: null,
    },
    // Tax settings
    gst_number: {
      type: String,
      default: null,
    },
    gst_percent: {
      type: Number,
      default: 5,
      min: 0,
      max: 28,
    },
    // Config
    currency: {
      type: String,
      default: 'INR',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    opening_hours: {
      type: String,
      default: '10:00 AM - 11:00 PM',
    },
    // Feature flags
    features: {
      gps_validation: { type: Boolean, default: true },
      qr_ordering: { type: Boolean, default: true },
      table_service: { type: Boolean, default: true },
      whatsapp_bill: { type: Boolean, default: true },
      upi_payment: { type: Boolean, default: true },
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    subscription: {
      plan: { type: String, enum: ['free', 'starter', 'pro', 'enterprise'], default: 'free' },
      expires_at: { type: Date, default: null },
    },
    categories: [{
      name: { type: String, required: true },
      image: { type: String, default: null }
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
restaurantSchema.index({ slug: 1 }, { unique: true });
restaurantSchema.index({ is_active: 1 });
restaurantSchema.index({ 'subscription.plan': 1 });
restaurantSchema.index({ createdAt: -1 });

// ─── Pre-save hook: generate slug ────────────────────────────────────────────
restaurantSchema.pre('save', async function (next) {
  if (this.isModified('name') || this.isNew) {
    let baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;
    while (await mongoose.model('Restaurant').exists({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter++}`;
    }
    this.slug = slug;
  }
  next();
});

// ─── Virtual: menu items count ───────────────────────────────────────────────
restaurantSchema.virtual('menuCount', {
  ref: 'Menu',
  localField: '_id',
  foreignField: 'restaurant_id',
  count: true,
});

// ─── Virtual: table count ────────────────────────────────────────────────────
restaurantSchema.virtual('tableCount', {
  ref: 'Table',
  localField: '_id',
  foreignField: 'restaurant_id',
  count: true,
});

module.exports = mongoose.model('Restaurant', restaurantSchema);
