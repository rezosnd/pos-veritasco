'use strict';

/**
 * Production seed script.
 * Creates: 1 super admin, 1 demo restaurant, full menu, 10 tables, staff accounts.
 * Usage:
 *   node scripts/seed.js           — seed data
 *   node scripts/seed.js --clear   — clear + reseed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');

const Restaurant = require('../src/models/Restaurant');
const Menu = require('../src/models/Menu');
const Table = require('../src/models/Table');
const User = require('../src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant_pos';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const CLEAR = process.argv.includes('--clear');

const menuData = [
  // Starters
  { name: 'Crispy Onion Rings', price: 149, category: 'Starters', type: 'veg', description: 'Golden fried onion rings with sriracha dip' },
  { name: 'Chicken Tikka', price: 299, category: 'Starters', type: 'non_veg', description: 'Tandoor marinated chicken with mint chutney' },
  { name: 'Paneer Tikka', price: 249, category: 'Starters', type: 'veg', description: 'Grilled cottage cheese with bell peppers' },
  { name: 'Veg Spring Rolls', price: 179, category: 'Starters', type: 'veg', description: 'Crispy rolls with mixed vegetable filling' },
  { name: 'Fish Amritsari', price: 329, category: 'Starters', type: 'non_veg', description: 'Spiced battered fish fry' },
  // Main Course
  { name: 'Butter Chicken', price: 399, category: 'Main Course', type: 'non_veg', description: 'Creamy tomato-based chicken curry' },
  { name: 'Dal Makhani', price: 249, category: 'Main Course', type: 'veg', description: 'Slow-cooked black lentils in cream' },
  { name: 'Palak Paneer', price: 279, category: 'Main Course', type: 'veg', description: 'Fresh spinach with cottage cheese' },
  { name: 'Mutton Rogan Josh', price: 449, category: 'Main Course', type: 'non_veg', description: 'Aromatic Kashmiri lamb curry' },
  { name: 'Kadai Paneer', price: 299, category: 'Main Course', type: 'veg', description: 'Paneer in spiced tomato-capsicum gravy' },
  { name: 'Chicken Biryani', price: 349, category: 'Main Course', type: 'non_veg', description: 'Fragrant basmati rice with spiced chicken' },
  // Breads
  { name: 'Butter Naan', price: 49, category: 'Breads', type: 'veg', description: 'Soft leavened bread with butter' },
  { name: 'Garlic Naan', price: 59, category: 'Breads', type: 'veg', description: 'Naan with garlic and coriander' },
  { name: 'Tandoori Roti', price: 35, category: 'Breads', type: 'veg', description: 'Whole wheat flatbread from tandoor' },
  { name: 'Laccha Paratha', price: 69, category: 'Breads', type: 'veg', description: 'Flaky layered whole wheat bread' },
  // Beverages
  { name: 'Mango Lassi', price: 99, category: 'Beverages', type: 'veg', description: 'Chilled mango yogurt drink' },
  { name: 'Fresh Lime Soda', price: 79, category: 'Beverages', type: 'veg', description: 'Sweet or salty lime soda' },
  { name: 'Masala Chai', price: 49, category: 'Beverages', type: 'veg', description: 'Spiced Indian milk tea' },
  { name: 'Cold Coffee', price: 119, category: 'Beverages', type: 'veg', description: 'Blended coffee with ice cream' },
  // Desserts
  { name: 'Gulab Jamun', price: 99, category: 'Desserts', type: 'veg', description: 'Soft milk-solid dumplings in sugar syrup' },
  { name: 'Kulfi Falooda', price: 149, category: 'Desserts', type: 'veg', description: 'Traditional Indian ice cream with rose falooda' },
  { name: 'Rasgulla', price: 89, category: 'Desserts', type: 'veg', description: 'Spongy cottage cheese balls in syrup' },
];

async function seed() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected to MongoDB');

  if (CLEAR) {
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      Restaurant.deleteMany({}),
      Menu.deleteMany({}),
      Table.deleteMany({}),
      User.deleteMany({}),
    ]);
    console.log('✅ Data cleared');
  }

  // ── Super Admin ────────────────────────────────────────────────────────────
  let superAdmin = await User.findOne({ role: 'super_admin' });
  if (!superAdmin) {
    superAdmin = await User.create({
      name: 'Super Admin',
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@restaurantpos.com',
      password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456',
      role: 'super_admin',
    });
    console.log(`✅ Super admin created: ${superAdmin.email}`);
  } else {
    console.log(`ℹ️  Super admin already exists: ${superAdmin.email}`);
  }

  // ── Demo Restaurant ────────────────────────────────────────────────────────
  let restaurant = await Restaurant.findOne({ slug: 'spice-garden' });
  if (!restaurant) {
    restaurant = await Restaurant.create({
      name: 'Spice Garden',
      description: 'Authentic Indian cuisine in a warm, inviting atmosphere',
      theme_color: '#e85d04',
      latitude: 28.6139, // New Delhi
      longitude: 77.2090,
      geo_radius_meters: 100,
      upi_id: 'spicegarden@upi',
      whatsapp_number: '919876543210',
      gst_percent: 5,
      gst_number: '07AAACH7409R1ZZ',
      phone: '+919876543210',
      email: 'info@spicegarden.com',
      address: { line1: '42, Connaught Place', city: 'New Delhi', state: 'Delhi', pincode: '110001' },
      opening_hours: '11:00 AM - 11:00 PM',
    });
    console.log(`✅ Restaurant created: ${restaurant.name} [${restaurant._id}]`);
  } else {
    console.log(`ℹ️  Restaurant already exists: ${restaurant.name}`);
  }

  // ── Staff Accounts ─────────────────────────────────────────────────────────
  const staffAccounts = [
    { name: 'Restaurant Admin', email: 'restaurantadmin@spicegarden.com', password: 'Admin@123456', role: 'restaurant_admin' },
    { name: 'Waiter Raju', email: 'waiter@spicegarden.com', password: 'Waiter@123', role: 'waiter' },
    { name: 'Kitchen Display', email: 'kitchen@spicegarden.com', password: 'Kitchen@123', role: 'kitchen' },
  ];
  for (const acc of staffAccounts) {
    const exists = await User.findOne({ email: acc.email });
    if (!exists) {
      await User.create({ ...acc, restaurant_id: restaurant._id });
      console.log(`✅ Staff created: ${acc.email} [${acc.role}]`);
    } else {
      console.log(`ℹ️  Staff already exists: ${acc.email}`);
    }
  }

  // ── Menu Items ─────────────────────────────────────────────────────────────
  const existingItems = await Menu.countDocuments({ restaurant_id: restaurant._id });
  if (existingItems === 0) {
    const menuWithRestaurant = menuData.map((item, i) => ({
      ...item,
      restaurant_id: restaurant._id,
      is_available: true,
      sort_order: i,
      is_featured: i < 3,
    }));
    await Menu.insertMany(menuWithRestaurant);
    console.log(`✅ Menu items created: ${menuData.length}`);
  } else {
    console.log(`ℹ️  Menu items already exist: ${existingItems}`);
  }

  // ── Tables & QR Codes ─────────────────────────────────────────────────────
  const existingTables = await Table.countDocuments({ restaurant_id: restaurant._id });
  if (existingTables === 0) {
    const tables = [];
    const crypto = require('crypto');
    for (let i = 1; i <= 10; i++) {
      const tableNumber = `T${i}`;
      const qrToken = crypto.randomUUID();
      const qrUrl = `${FRONTEND_URL}/${restaurant.slug}/menu?table=${tableNumber}&token=${qrToken}`;
      const qrCode = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });
      tables.push({
        restaurant_id: restaurant._id,
        table_number: tableNumber,
        display_name: `Table ${i}`,
        capacity: i <= 5 ? 2 : 4,
        section: i <= 5 ? 'Indoor' : 'Outdoor',
        qr_url: qrUrl,
        qr_code: qrCode,
        qr_token: qrToken,
        status: 'inactive',
      });
    }
    await Table.insertMany(tables);
    console.log(`✅ Tables created: ${tables.length}`);
  } else {
    console.log(`ℹ️  Tables already exist: ${existingTables}`);
  }

  console.log('\n🎉 Seed complete!\n');
  console.log('─────────────────────────────────────────');
  console.log('LOGIN CREDENTIALS:');
  console.log(`  Super Admin  : ${process.env.SUPER_ADMIN_EMAIL || 'admin@restaurantpos.com'} / ${process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456'}`);
  console.log('  Rest. Admin  : restaurantadmin@spicegarden.com / Admin@123456');
  console.log('  Waiter       : waiter@spicegarden.com / Waiter@123');
  console.log('  Kitchen      : kitchen@spicegarden.com / Kitchen@123');
  console.log(`\nRESTAURANT ID: ${restaurant._id}`);
  console.log(`QR BASE URL  : ${FRONTEND_URL}/start?rid=${restaurant._id}&table=T1`);
  console.log('─────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
