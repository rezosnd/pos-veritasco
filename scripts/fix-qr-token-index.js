'use strict';
/**
 * Fix script: Drop the broken non-sparse qr_token index on the tables collection
 * and recreate it as sparse+unique so multiple null values are allowed.
 *
 * Run once: node scripts/fix-qr-token-index.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const mongoose = require('mongoose');

async function fix() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) { console.error('❌ MONGODB_URI not found in .env'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;
  const col = db.collection('tables');

  // List existing indexes
  const indexes = await col.indexes();
  console.log('Current indexes:', indexes.map(i => i.name));

  // Drop the old broken index (non-sparse unique on qr_token)
  try {
    await col.dropIndex('qr_token_1');
    console.log('✅ Dropped old qr_token_1 index');
  } catch (e) {
    console.log('ℹ️  qr_token_1 index not found or already dropped:', e.message);
  }

  // Recreate as sparse + unique (nulls won't conflict)
  await col.createIndex({ qr_token: 1 }, { unique: true, sparse: true, name: 'qr_token_1' });
  console.log('✅ Recreated qr_token_1 as sparse+unique — nulls allowed now');

  await mongoose.disconnect();
  console.log('✅ Done. You can now create restaurants without the duplicate null error.');
}

fix().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
