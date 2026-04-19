import supabase from '../db/supabase.js';

let foodCache = null;
let recipeCache = null;

async function ensureCache() {
  if (!foodCache || !recipeCache) {
    await rebuildCache();
  }
}

export async function rebuildCache() {
  const { data: foods } = await supabase
    .from('foods')
    .select('*, food_categories(category_id, categories(name)), food_servings(name, amount_g)');

  foodCache = (foods || []).map(f => ({
    ...f,
    type: 'food',
    category: (f.food_categories || []).map(c => c.categories?.name).filter(Boolean),
    nutrients_per_100g: {
      calories: f.calories_per_100g,
      protein_g: f.protein_per_100g,
      carbs_g: f.carbs_per_100g,
      fat_g: f.fat_per_100g
    },
    serving_sizes: f.food_servings || []
  }));

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, recipe_categories(category_id, categories(name))');

  recipeCache = (recipes || []).map(r => ({
    ...r,
    type: 'recipe',
    brand: r.author,
    category: (r.recipe_categories || []).map(c => c.categories?.name).filter(Boolean),
    nutrients_per_100g: {
      calories: r.calories_per_100g,
      protein_g: r.protein_per_100g,
      carbs_g: r.carbs_per_100g,
      fat_g: r.fat_per_100g
    },
    serving_sizes: [{ name: 'מנה', amount_g: r.serving_weight_g || 300 }]
  }));

  console.log(`Cache built: ${foodCache.length} foods, ${recipeCache.length} recipes`);
}

export async function getAllProducts() {
  await ensureCache();
  return [...(foodCache || []), ...(recipeCache || [])];
}

export async function getAllFoods() {
  await ensureCache();
  return foodCache || [];
}

export async function getAllRecipes() {
  await ensureCache();
  return recipeCache || [];
}

export async function getProductById(id, type) {
  if (type === 'recipe') {
    const { data: r } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*, foods(name))')
      .eq('id', id)
      .single();
    if (!r) return null;
    return {
      ...r, type: 'recipe', brand: r.author,
      nutrients_per_100g: { calories: r.calories_per_100g, protein_g: r.protein_per_100g, carbs_g: r.carbs_per_100g, fat_g: r.fat_per_100g },
      serving_sizes: [{ name: 'מנה', amount_g: r.serving_weight_g || 300 }],
      ingredients: r.recipe_ingredients || []
    };
  }

  const { data: f } = await supabase
    .from('foods')
    .select('*, food_servings(name, amount_g)')
    .eq('id', id)
    .single();
  if (!f) return null;
  return {
    ...f, type: 'food',
    serving_sizes: f.food_servings || [],
    nutrients_per_100g: { calories: f.calories_per_100g, protein_g: f.protein_per_100g, carbs_g: f.carbs_per_100g, fat_g: f.fat_per_100g }
  };
}

export async function searchProducts(query, limit = 20) {
  const q = `%${query}%`;

  const { data: foods } = await supabase
    .from('foods')
    .select('*, food_categories(category_id, categories(name))')
    .or(`name.ilike.${q},brand.ilike.${q}`)
    .limit(limit);

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, recipe_categories(category_id, categories(name))')
    .or(`name.ilike.${q},author.ilike.${q}`)
    .limit(limit);

  const mapFood = f => ({
    ...f, type: 'food',
    category: (f.food_categories || []).map(c => c.categories?.name).filter(Boolean),
    nutrients_per_100g: { calories: f.calories_per_100g, protein_g: f.protein_per_100g, carbs_g: f.carbs_per_100g, fat_g: f.fat_per_100g }
  });
  const mapRecipe = r => ({
    ...r, type: 'recipe', brand: r.author,
    category: (r.recipe_categories || []).map(c => c.categories?.name).filter(Boolean),
    nutrients_per_100g: { calories: r.calories_per_100g, protein_g: r.protein_per_100g, carbs_g: r.carbs_per_100g, fat_g: r.fat_per_100g }
  });

  return [...(foods || []).map(mapFood), ...(recipes || []).map(mapRecipe)].slice(0, limit);
}

export function getProductCatalogForAI() {
  ensureCache();
  const all = [...(foodCache || []), ...(recipeCache || [])];
  return all.map(p => {
    const servings = (p.serving_sizes || []).map(s => `${s.name}=${s.amount_g}g`).join(', ');
    const n = p.nutrients_per_100g;
    const prefix = p.type === 'recipe' ? 'R' : 'F';
    return `[${prefix}${p.id}] ${p.name}${p.brand ? ` (${p.brand})` : ''} | per100g: ${n.calories}cal ${n.protein_g}p ${n.carbs_g}c ${n.fat_g}f${servings ? ` | מנות: ${servings}` : ''}`;
  }).join('\n');
}

export async function getAllCategories() {
  const { data } = await supabase.from('categories').select('id, name').order('name');
  return (data || []).map(r => r.name);
}

export async function addCustomProduct(userId, { name, brand, calories, protein, carbs, fat, servings }) {
  const { data: food, error } = await supabase
    .from('foods')
    .insert({
      name, brand: brand || null,
      calories_per_100g: calories || 0, protein_per_100g: protein || 0,
      carbs_per_100g: carbs || 0, fat_per_100g: fat || 0,
      source: 'custom', created_by: userId
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (servings?.length > 0) {
    await supabase.from('food_servings').insert(
      servings.map(s => ({ food_id: food.id, name: s.name, amount_g: s.amount_g }))
    );
  }

  await rebuildCache();
  return getProductById(food.id, 'food');
}
