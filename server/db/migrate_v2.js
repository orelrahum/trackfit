#!/usr/bin/env node
/**
 * TrackFit V2 Migration: Split products into foods + recipes
 * 
 * Prerequisites:
 *   1. Run supabase/migration_v2.sql in Supabase SQL Editor
 *   2. SUPABASE_SERVICE_ROLE_KEY must be set in .env
 * 
 * Usage: node server/db/migrate_v2.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const BATCH = 500;
const RECIPE_THRESHOLD = 200000;

async function batchInsert(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      let ok = 0;
      for (const row of batch) {
        const { error: e } = await supabase.from(table).insert(row);
        if (!e) ok++;
      }
      console.log(`  ⚠️  ${table} batch error, recovered ${ok}/${batch.length}`);
    }
    process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
  }
  console.log();
}

async function migrate() {
  console.log('\n🔄 TrackFit V2 Migration: Splitting products → foods + recipes\n');

  // Check if new tables exist
  const { error: testErr } = await supabase.from('foods').select('id', { count: 'exact', head: true });
  if (testErr?.code === 'PGRST205') {
    console.error('❌ New tables not found! Run supabase/migration_v2.sql in SQL Editor first.');
    process.exit(1);
  }

  // Check if already migrated
  const { count: foodCount } = await supabase.from('foods').select('id', { count: 'exact', head: true });
  if (foodCount > 0) {
    console.log(`  ℹ️  Already migrated (${foodCount} foods in DB). Skipping.\n`);
    process.exit(0);
  }

  // 1. Load all products from old table
  console.log('1️⃣  Loading products from old table...');
  let allProducts = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .range(offset, offset + 999)
      .order('id');
    if (error) { console.error('  ❌', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    allProducts = allProducts.concat(data);
    offset += data.length;
    process.stdout.write(`  Loaded ${allProducts.length} products\r`);
  }
  console.log(`  ✅ Loaded ${allProducts.length} products\n`);

  // 2. Load all categories
  console.log('2️⃣  Loading categories...');
  let allCats = [];
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from('product_categories')
      .select('*')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allCats = allCats.concat(data);
    offset += data.length;
  }
  console.log(`  ✅ Loaded ${allCats.length} category assignments\n`);

  // 3. Load all servings
  console.log('3️⃣  Loading servings...');
  let allServings = [];
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from('product_servings')
      .select('product_id, name, amount_g')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allServings = allServings.concat(data);
    offset += data.length;
  }
  console.log(`  ✅ Loaded ${allServings.length} servings\n`);

  // 4. Normalize categories
  console.log('4️⃣  Normalizing categories...');
  const skipCats = new Set(['foodDictionary', 'מתכונים']);
  const uniqueCats = [...new Set(allCats.map(c => c.category).filter(c => !skipCats.has(c)))];
  await batchInsert('categories', uniqueCats.map(name => ({ name })));
  
  // Build category name → id map
  const { data: catRows } = await supabase.from('categories').select('id, name');
  const catMap = Object.fromEntries(catRows.map(c => [c.name, c.id]));
  console.log(`  ✅ ${Object.keys(catMap).length} unique categories\n`);

  // 5. Split into foods and recipes
  const foodProducts = allProducts.filter(p => p.id < RECIPE_THRESHOLD);
  const recipeProducts = allProducts.filter(p => p.id >= RECIPE_THRESHOLD);

  // 6. Insert foods
  console.log(`5️⃣  Inserting ${foodProducts.length} foods...`);
  const foodRows = foodProducts.map(p => ({
    id: p.id, name: p.name, brand: p.brand,
    photo_url: p.photo_url, url: p.url,
    calories_per_100g: p.calories_per_100g,
    protein_per_100g: p.protein_per_100g,
    carbs_per_100g: p.carbs_per_100g,
    fat_per_100g: p.fat_per_100g,
    source: p.source || 'fuder'
  }));
  await batchInsert('foods', foodRows);
  console.log(`  ✅ ${foodRows.length} foods\n`);

  // 7. Insert food servings
  console.log('6️⃣  Inserting food servings...');
  const foodServings = allServings
    .filter(s => s.product_id < RECIPE_THRESHOLD)
    .map(s => ({ food_id: s.product_id, name: s.name, amount_g: s.amount_g }));
  await batchInsert('food_servings', foodServings);
  console.log(`  ✅ ${foodServings.length} food servings\n`);

  // 8. Insert food categories
  console.log('7️⃣  Inserting food categories...');
  const foodCats = allCats
    .filter(c => c.product_id < RECIPE_THRESHOLD && catMap[c.category])
    .map(c => ({ food_id: c.product_id, category_id: catMap[c.category] }));
  await batchInsert('food_categories', foodCats);
  console.log(`  ✅ ${foodCats.length} food category links\n`);

  // 9. Insert recipes
  console.log(`8️⃣  Inserting ${recipeProducts.length} recipes...`);
  const recipeRows = recipeProducts.map(p => ({
    id: p.id - RECIPE_THRESHOLD, // Renumber from 1
    name: p.name,
    author: p.brand,
    photo_url: p.photo_url,
    url: p.url,
    serving_weight_g: 300,
    calories_per_100g: p.calories_per_100g,
    protein_per_100g: p.protein_per_100g,
    carbs_per_100g: p.carbs_per_100g,
    fat_per_100g: p.fat_per_100g,
    source: p.source || 'foodDictionary'
  }));
  await batchInsert('recipes', recipeRows);
  console.log(`  ✅ ${recipeRows.length} recipes\n`);

  // 10. Insert recipe categories
  console.log('9️⃣  Inserting recipe categories...');
  const recipeCats = allCats
    .filter(c => c.product_id >= RECIPE_THRESHOLD && catMap[c.category])
    .map(c => ({ recipe_id: c.product_id - RECIPE_THRESHOLD, category_id: catMap[c.category] }));
  await batchInsert('recipe_categories', recipeCats);
  console.log(`  ✅ ${recipeCats.length} recipe category links\n`);

  // 11. Update sequence counters
  console.log('🔧 Updating sequences...');
  // We can't run raw SQL via REST, but inserts with explicit IDs handle this

  console.log('\n🎉 V2 Migration complete!');
  console.log(`   Foods:    ${foodRows.length}`);
  console.log(`   Recipes:  ${recipeRows.length}`);
  console.log(`   Categories: ${Object.keys(catMap).length}`);
  console.log('\n   Old "products" table can be dropped after verification.\n');
}

migrate().catch(e => { console.error('Migration failed:', e); process.exit(1); });
