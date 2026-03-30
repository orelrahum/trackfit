import db from './database.js';

// 1. Fix HTML entities in product names
console.log('Fixing HTML entities in names...');
const dirty = db.prepare("SELECT id, name FROM products WHERE name LIKE '%&%'").all();
console.log(`Found ${dirty.length} products with HTML entities`);

const update = db.prepare('UPDATE products SET name = ? WHERE id = ?');
let fixed = 0;
for (const p of dirty) {
  let clean = p.name
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#40;/g, '(')
    .replace(/&#41;/g, ')')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .trim();
  if (clean !== p.name) {
    update.run(clean, p.id);
    fixed++;
  }
}
console.log(`Fixed ${fixed} names`);

// 2. Add 'foodDictionary' category to all foodDictionary-source products
console.log('Adding foodDictionary category tags...');
const addCat = db.prepare("INSERT OR IGNORE INTO product_categories (product_id, category) VALUES (?, 'foodDictionary')");
const fdProducts = db.prepare("SELECT id FROM products WHERE source = 'foodDictionary'").all();
let tagged = 0;
for (const p of fdProducts) {
  const r = addCat.run(p.id);
  if (r.changes > 0) tagged++;
}
console.log(`Tagged ${tagged} new products with foodDictionary category`);

// 3. Verify
const sources = db.prepare("SELECT source, COUNT(*) as c FROM products GROUP BY source").all();
console.log('Sources:', JSON.stringify(sources));

const sampleFixed = db.prepare("SELECT name FROM products WHERE id >= 200000 LIMIT 5").all();
console.log('Sample names after fix:', sampleFixed.map(p => p.name));

console.log('Done!');
process.exit(0);
