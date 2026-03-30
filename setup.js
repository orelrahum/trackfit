#!/usr/bin/env node
/**
 * TrackFit Supabase Setup
 * 
 * One-command setup: creates tables + migrates all product data.
 * 
 * Usage:
 *   node setup.js <your-service-role-key>
 * 
 * Get the key from: Supabase Dashboard → Settings → API → service_role (secret)
 */

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://stssbztzelcqdrwylvvs.supabase.co';
const SERVICE_KEY = process.argv[2];

if (!SERVICE_KEY || !SERVICE_KEY.startsWith('eyJ')) {
  console.error(`
╔══════════════════════════════════════════════════════════════╗
║  TrackFit Setup                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Usage:  node setup.js <service-role-key>                    ║
║                                                              ║
║  1. Go to Supabase Dashboard → Settings → API                ║
║  2. Copy the "service_role" secret key (starts with eyJ...)  ║
║  3. Run:  node setup.js eyJ...your_key_here                 ║
║                                                              ║
║  ⚠️  FIRST: Run supabase/schema.sql in SQL Editor!           ║
║     Dashboard → SQL Editor → paste schema.sql → Run          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Also save to .env files
import { writeFileSync, existsSync } from 'fs';

function updateEnvFile(filePath, updates) {
  let content = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content += `\n${line}`;
    }
  }
  writeFileSync(filePath, content.trim() + '\n');
}

const BATCH_SIZE = 500;

async function batchInsert(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      let succeeded = 0;
      for (const row of batch) {
        const { error: e } = await supabase.from(table).insert(row);
        if (!e) succeeded++;
      }
      console.log(`  ⚠️  Batch error in ${table}, recovered ${succeeded}/${batch.length}`);
    }
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  console.log();
}

async function setup() {
  console.log('\n🚀 TrackFit Setup\n');

  // Step 1: Verify connection
  console.log('1️⃣  Checking Supabase connection...');
  const { data, error } = await supabase.from('products').select('id', { count: 'exact', head: true });
  if (error && error.code === 'PGRST205') {
    console.error('❌ Tables not found! Please run supabase/schema.sql in SQL Editor first.');
    console.error('   Dashboard → SQL Editor → New Query → paste schema.sql → Run');
    process.exit(1);
  }
  const count = data;
  console.log(`  ✅ Connected! (${count || 0} products currently in DB)\n`);

  if (count > 0) {
    console.log('  ℹ️  Products already exist. Skipping migration.\n');
  } else {
    // Step 2: Migrate data from SQLite
    console.log('2️⃣  Migrating products from SQLite...');
    const dbPath = join(__dirname, 'server', 'db', 'trackfit.db');
    let db;
    try {
      db = new Database(dbPath, { readonly: true });
    } catch (e) {
      console.error(`  ❌ SQLite DB not found at ${dbPath}`);
      process.exit(1);
    }

    // Products
    console.log('  📦 Products...');
    const products = db.prepare('SELECT * FROM products').all();
    const productRows = products.map(p => ({
      id: p.id, name: p.name, brand: p.brand || null,
      photo_url: p.photo_url || null, url: p.url || null,
      calories_per_100g: p.calories_per_100g || 0,
      protein_per_100g: p.protein_per_100g || 0,
      carbs_per_100g: p.carbs_per_100g || 0,
      fat_per_100g: p.fat_per_100g || 0,
      is_custom: p.is_custom === 1, source: p.source || 'fuder',
      created_by: null
    }));
    await batchInsert('products', productRows);
    console.log(`  ✅ ${productRows.length} products\n`);

    // Categories
    console.log('  🏷️  Categories...');
    const categories = db.prepare('SELECT * FROM product_categories').all();
    await batchInsert('product_categories', categories);
    console.log(`  ✅ ${categories.length} categories\n`);

    // Servings
    console.log('  🥄 Servings...');
    const servings = db.prepare('SELECT product_id, name, amount_g FROM product_servings').all();
    await batchInsert('product_servings', servings);
    console.log(`  ✅ ${servings.length} servings\n`);

    // Settings
    const settings = db.prepare('SELECT * FROM settings').all();
    if (settings.length > 0) {
      await batchInsert('settings', settings);
      console.log(`  ⚙️  ${settings.length} settings migrated\n`);
    }

    db.close();
  }

  // Step 3: Save keys to .env files
  console.log('3️⃣  Saving config to .env files...');
  updateEnvFile(join(__dirname, '.env'), {
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY
  });
  updateEnvFile(join(__dirname, 'client', '.env'), {
    VITE_SUPABASE_URL: SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0c3NienR6ZWxjcWRyd3lsdnZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjU2NTcsImV4cCI6MjA5MDQ0MTY1N30.-S_xiublH04QDMxMPK4n1dx6iN7yxsOB5l1OoSQ8AjI'
  });
  console.log('  ✅ .env files updated\n');

  console.log('🎉 Setup complete! Run: npm run dev\n');
}

setup().catch(e => { console.error('Setup failed:', e.message); process.exit(1); });
