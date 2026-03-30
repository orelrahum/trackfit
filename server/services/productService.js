import supabase from '../db/supabase.js';

let productCache = null;

function ensureCache() {
  if (!productCache) {
    return rebuildCache();
  }
}

export async function rebuildCache() {
  const { data: products } = await supabase
    .from('products')
    .select('*, product_categories(category), product_servings(name, amount_g)');

  productCache = (products || []).map(p => ({
    ...p,
    category: (p.product_categories || []).map(c => c.category),
    nutrients_per_100g: {
      calories: p.calories_per_100g,
      protein_g: p.protein_per_100g,
      carbs_g: p.carbs_per_100g,
      fat_g: p.fat_per_100g
    },
    serving_sizes: p.product_servings || []
  }));

  console.log(`Product cache built: ${productCache.length} products`);
}

export function getAllProducts() {
  ensureCache();
  return productCache || [];
}

export async function getProductById(id) {
  const { data: p } = await supabase
    .from('products')
    .select('*, product_servings(name, amount_g)')
    .eq('id', id)
    .single();

  if (!p) return null;

  p.serving_sizes = p.product_servings || [];
  p.nutrients_per_100g = {
    calories: p.calories_per_100g,
    protein_g: p.protein_per_100g,
    carbs_g: p.carbs_per_100g,
    fat_g: p.fat_per_100g
  };
  return p;
}

export async function searchProducts(query, limit = 20) {
  const q = `%${query}%`;
  const { data: products } = await supabase
    .from('products')
    .select('*, product_categories(category)')
    .or(`name.ilike.${q},brand.ilike.${q}`)
    .limit(limit);

  return (products || []).map(p => ({
    ...p,
    category: (p.product_categories || []).map(c => c.category),
    nutrients_per_100g: {
      calories: p.calories_per_100g,
      protein_g: p.protein_per_100g,
      carbs_g: p.carbs_per_100g,
      fat_g: p.fat_per_100g
    }
  }));
}

export function getProductCatalogForAI() {
  ensureCache();
  return (productCache || []).map(p => {
    const servings = (p.serving_sizes || [])
      .map(s => `${s.name}=${s.amount_g}g`)
      .join(', ');
    const n = p.nutrients_per_100g;
    return `[${p.id}] ${p.name}${p.brand ? ` (${p.brand})` : ''} | per100g: ${n.calories}cal ${n.protein_g}p ${n.carbs_g}c ${n.fat_g}f${servings ? ` | מנות: ${servings}` : ''}`;
  }).join('\n');
}

export async function getAllCategories() {
  const { data } = await supabase
    .from('product_categories')
    .select('category')
    .order('category');

  const unique = [...new Set((data || []).map(r => r.category))];
  return unique;
}

export async function addCustomProduct(userId, { name, brand, calories, protein, carbs, fat, servings }) {
  // Find next available ID
  const { data: maxRow } = await supabase
    .from('products')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .single();

  const newId = (maxRow?.id || 0) + 1;

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      id: newId,
      name, brand: brand || null,
      calories_per_100g: calories || 0,
      protein_per_100g: protein || 0,
      carbs_per_100g: carbs || 0,
      fat_per_100g: fat || 0,
      is_custom: true,
      created_by: userId
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (servings && servings.length > 0) {
    const servingRows = servings.map(s => ({
      product_id: product.id, name: s.name, amount_g: s.amount_g
    }));
    await supabase.from('product_servings').insert(servingRows);
  }

  await rebuildCache();
  return getProductById(product.id);
}
