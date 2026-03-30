import db from '../db/database.js';

// In-memory cache for AI context (rebuilt on startup and when products change)
let productCache = null;

function ensureCache() {
  if (!productCache) {
    rebuildCache();
  }
}

export function rebuildCache() {
  const products = db.prepare(`
    SELECT p.*, 
      GROUP_CONCAT(DISTINCT pc.category) as categories
    FROM products p
    LEFT JOIN product_categories pc ON pc.product_id = p.id
    GROUP BY p.id
  `).all();

  productCache = products.map(p => ({
    ...p,
    category: p.categories ? p.categories.split(',') : [],
    nutrients_per_100g: {
      calories: p.calories_per_100g,
      protein_g: p.protein_per_100g,
      carbs_g: p.carbs_per_100g,
      fat_g: p.fat_per_100g
    },
    serving_sizes: db.prepare(
      'SELECT name, amount_g FROM product_servings WHERE product_id = ?'
    ).all(p.id)
  }));

  console.log(`Product cache built: ${productCache.length} products`);
}

export function getAllProducts() {
  ensureCache();
  return productCache;
}

export function getProductById(id) {
  const p = db.prepare(`
    SELECT * FROM products WHERE id = ?
  `).get(id);
  if (!p) return null;

  p.serving_sizes = db.prepare(
    'SELECT name, amount_g FROM product_servings WHERE product_id = ?'
  ).all(id);
  p.nutrients_per_100g = {
    calories: p.calories_per_100g,
    protein_g: p.protein_per_100g,
    carbs_g: p.carbs_per_100g,
    fat_g: p.fat_per_100g
  };
  return p;
}

export function searchProducts(query, limit = 20) {
  const q = `%${query}%`;
  const products = db.prepare(`
    SELECT p.*, GROUP_CONCAT(DISTINCT pc.category) as categories
    FROM products p
    LEFT JOIN product_categories pc ON pc.product_id = p.id
    WHERE p.name LIKE ? OR p.brand LIKE ?
    GROUP BY p.id
    LIMIT ?
  `).all(q, q, limit);

  return products.map(p => ({
    ...p,
    category: p.categories ? p.categories.split(',') : [],
    nutrients_per_100g: {
      calories: p.calories_per_100g,
      protein_g: p.protein_per_100g,
      carbs_g: p.carbs_per_100g,
      fat_g: p.fat_per_100g
    }
  }));
}

// Compact product catalog for AI context
export function getProductCatalogForAI() {
  ensureCache();
  return productCache.map(p => {
    const servings = (p.serving_sizes || [])
      .map(s => `${s.name}=${s.amount_g}g`)
      .join(', ');
    const n = p.nutrients_per_100g;
    return `[${p.id}] ${p.name}${p.brand ? ` (${p.brand})` : ''} | per100g: ${n.calories}cal ${n.protein_g}p ${n.carbs_g}c ${n.fat_g}f${servings ? ` | מנות: ${servings}` : ''}`;
  }).join('\n');
}

export function getAllCategories() {
  const rows = db.prepare(
    'SELECT DISTINCT category FROM product_categories ORDER BY category'
  ).all();
  return rows.map(r => r.category);
}

// Add a custom product (user-created)
export function addCustomProduct(userId, { name, brand, calories, protein, carbs, fat, servings }) {
  const result = db.prepare(`
    INSERT INTO products (name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_custom, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `).run(name, brand || null, calories || 0, protein || 0, carbs || 0, fat || 0, userId);

  const productId = result.lastInsertRowid;

  if (servings && servings.length > 0) {
    const insertServing = db.prepare(
      'INSERT INTO product_servings (product_id, name, amount_g) VALUES (?, ?, ?)'
    );
    for (const s of servings) {
      insertServing.run(productId, s.name, s.amount_g);
    }
  }

  // Rebuild cache to include new product
  rebuildCache();

  return getProductById(productId);
}
