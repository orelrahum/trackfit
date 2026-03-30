/**
 * Migration script: SQLite → Supabase
 * 
 * Migrates product data from the local SQLite database to Supabase.
 * Users are NOT migrated (fresh start with Supabase Auth).
 * 
 * Usage:
 *   1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in ../.env
 *   2. Run: node server/db/migrate.js
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const dbPath = join(__dirname, 'trackfit.db');
let db;
try {
  db = new Database(dbPath, { readonly: true });
} catch (e) {
  console.error(`❌ Cannot open SQLite DB at ${dbPath}: ${e.message}`);
  process.exit(1);
}

const BATCH_SIZE = 500;

async function batchInsert(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`  ❌ Error inserting into ${table} (batch ${i / BATCH_SIZE + 1}):`, error.message);
      // Try one by one for this batch to find the problematic row
      let succeeded = 0;
      for (const row of batch) {
        const { error: rowError } = await supabase.from(table).insert(row);
        if (!rowError) succeeded++;
      }
      console.log(`  ⚠️  Recovered ${succeeded}/${batch.length} rows from failed batch`);
    }
    process.stdout.write(`  Inserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  console.log();
}

async function migrate() {
  console.log('🚀 Starting migration: SQLite → Supabase\n');

  // 1. Products
  console.log('📦 Migrating products...');
  const products = db.prepare('SELECT * FROM products').all();
  const productRows = products.map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand || null,
    photo_url: p.photo_url || null,
    url: p.url || null,
    calories_per_100g: p.calories_per_100g || 0,
    protein_per_100g: p.protein_per_100g || 0,
    carbs_per_100g: p.carbs_per_100g || 0,
    fat_per_100g: p.fat_per_100g || 0,
    is_custom: p.is_custom === 1,
    source: p.source || 'fuder',
    created_by: null
  }));
  await batchInsert('products', productRows);
  console.log(`  ✅ ${productRows.length} products migrated\n`);

  // 2. Product categories
  console.log('🏷️  Migrating categories...');
  const categories = db.prepare('SELECT * FROM product_categories').all();
  await batchInsert('product_categories', categories);
  console.log(`  ✅ ${categories.length} categories migrated\n`);

  // 3. Product servings
  console.log('🥄 Migrating servings...');
  const servings = db.prepare('SELECT product_id, name, amount_g FROM product_servings').all();
  await batchInsert('product_servings', servings);
  console.log(`  ✅ ${servings.length} servings migrated\n`);

  // 4. Settings (optional)
  console.log('⚙️  Migrating settings...');
  const settings = db.prepare('SELECT * FROM settings').all();
  if (settings.length > 0) {
    await batchInsert('settings', settings);
    console.log(`  ✅ ${settings.length} settings migrated\n`);
  } else {
    console.log('  ℹ️  No settings to migrate\n');
  }

  console.log('🎉 Migration complete!');
  console.log('\nNote: Users were NOT migrated. Register fresh accounts via Supabase Auth.');
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
