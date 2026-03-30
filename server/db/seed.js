import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (count > 0) {
    console.log(`Products already seeded (${count} products in DB)`);
    return count;
  }

  console.log('Seeding products from fuder_products.json...');
  const raw = readFileSync(join(__dirname, '..', '..', 'fuder_products.json'), 'utf-8');
  const products = JSON.parse(raw);

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (id, name, brand, photo_url, url, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO product_categories (product_id, category)
    VALUES (?, ?)
  `);

  const insertServing = db.prepare(`
    INSERT INTO product_servings (product_id, name, amount_g)
    VALUES (?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    let imported = 0;
    for (const p of products) {
      const n = p.nutrients_per_100g || {};
      insertProduct.run(
        p.id,
        p.name,
        p.brand || null,
        p.photo_url || null,
        p.url || null,
        n.calories || 0,
        n.protein_g || 0,
        n.carbs_g || 0,
        n.fat_g || 0
      );

      if (p.category) {
        for (const cat of p.category) {
          insertCategory.run(p.id, cat);
        }
      }

      if (p.serving_sizes) {
        for (const s of p.serving_sizes) {
          if (s.name && s.amount_g != null) {
            insertServing.run(p.id, s.name, s.amount_g);
          }
        }
      }

      imported++;
    }
    return imported;
  });

  const imported = transaction();
  console.log(`Seeded ${imported} products into database`);
  return imported;
}
