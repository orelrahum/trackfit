import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FOODSD_FILE = 'C:\\Users\\orelr\\.copilot\\files\\file-1774117617857-0.json';
const RECIPES_FILE = 'C:\\Users\\orelr\\.copilot\\files\\file-1774117617942-1.json';

// ID offsets to avoid conflicts with fuder products (1-5307)
const FOODSD_OFFSET = 100000;
const RECIPE_OFFSET = 200000;

function importFoodsdProducts() {
  const marker = db.prepare("SELECT COUNT(*) as c FROM products WHERE id >= ? AND id < ?").get(FOODSD_OFFSET, RECIPE_OFFSET);
  if (marker.c > 0) {
    console.log(`Foodsd products already imported (${marker.c} in DB)`);
    return;
  }

  console.log('Importing foodsd products...');
  const raw = readFileSync(FOODSD_FILE, 'utf-8');
  const products = JSON.parse(raw);

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (id, name, brand, photo_url, url, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_custom, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'foodDictionary')
  `);

  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO product_categories (product_id, category) VALUES (?, ?)
  `);

  const insertServing = db.prepare(`
    INSERT INTO product_servings (product_id, name, amount_g) VALUES (?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    let imported = 0;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const id = FOODSD_OFFSET + i + 1;
      const n = p.nutrients_per_100g || {};

      // Extract brand from name if pattern is "product, brand"
      let name = p.name || '';
      let brand = null;
      const commaIdx = name.lastIndexOf(',');
      if (commaIdx > 0 && commaIdx < name.length - 1) {
        brand = name.substring(commaIdx + 1).trim();
        name = name.substring(0, commaIdx).trim();
      }

      insertProduct.run(
        id, name, brand,
        p.image_url || null,
        p.url ? `https://www.foodsd.co.il${p.url}` : null,
        n.calories || 0,
        n.protein || 0,
        n.carbohydrates || 0,
        n.total_fat || 0
      );

      // Tag with "מוצרי סופר" as general category
      insertCategory.run(id, 'מוצרי סופר');

      // Serving sizes
      if (p.serving_sizes) {
        for (const s of p.serving_sizes) {
          if (s.name && s.grams != null) {
            insertServing.run(id, s.name, s.grams);
          }
        }
      }

      imported++;
    }
    return imported;
  });

  const count = transaction();
  console.log(`Imported ${count} foodsd products`);
}

function importRecipes() {
  const marker = db.prepare("SELECT COUNT(*) as c FROM products WHERE id >= ?").get(RECIPE_OFFSET);
  if (marker.c > 0) {
    console.log(`Recipes already imported (${marker.c} in DB)`);
    return;
  }

  console.log('Importing recipes...');
  const raw = readFileSync(RECIPES_FILE, 'utf-8');
  const recipes = JSON.parse(raw);

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (id, name, brand, photo_url, url, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_custom, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'foodDictionary')
  `);

  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO product_categories (product_id, category) VALUES (?, ?)
  `);

  const insertServing = db.prepare(`
    INSERT INTO product_servings (product_id, name, amount_g) VALUES (?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    let imported = 0;
    for (let i = 0; i < recipes.length; i++) {
      const r = recipes[i];
      const id = RECIPE_OFFSET + i + 1;
      const n = r.nutrition_per_serving || {};

      // For recipes: nutrition is per serving, store as-is (label as per-serving)
      // Parse number of servings from the "servings" field like "4 מנות"
      let servingCount = 1;
      if (r.servings) {
        const match = r.servings.match(/(\d+)/);
        if (match) servingCount = parseInt(match[1]);
      }

      // Estimate per-100g from per-serving (assume ~300g per serving as rough estimate)
      const estimatedServingG = 300;
      const factor = 100 / estimatedServingG;

      insertProduct.run(
        id,
        r.name || '',
        r.author || null,
        r.image_url || null,
        r.url ? `https://www.foodsd.co.il${r.url}` : null,
        Math.round((n.calories || 0) * factor * 10) / 10,
        Math.round((n.protein || 0) * factor * 10) / 10,
        Math.round((n.carbohydrates || 0) * factor * 10) / 10,
        Math.round((n.total_fat || 0) * factor * 10) / 10
      );

      // Split comma-separated category into individual tags
      if (r.category) {
        const cats = r.category.split(',').map(c => c.trim()).filter(Boolean);
        for (const cat of cats) {
          insertCategory.run(id, cat);
        }
      }
      // Also tag as recipe
      insertCategory.run(id, 'מתכונים');

      // Add serving size
      insertServing.run(id, 'מנה', estimatedServingG);

      imported++;
    }
    return imported;
  });

  const count = transaction();
  console.log(`Imported ${count} recipes`);
}

export function seedExtraProducts() {
  // Add 'source' column if it doesn't exist
  try {
    db.exec("ALTER TABLE products ADD COLUMN source TEXT DEFAULT 'fuder'");
    console.log("Added 'source' column to products table");
  } catch {
    // Column already exists
  }

  importFoodsdProducts();
  importRecipes();
}
