import { supabase } from '../lib/supabase';

let cachedUserId = null;

async function getUserId() {
  if (cachedUserId) return cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('נדרשת התחברות');
  cachedUserId = user.id;
  return cachedUserId;
}

// Clear cache on auth state change
supabase.auth.onAuthStateChange(() => { cachedUserId = null; });

// Profile
export const getProfile = async () => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const updateProfile = async (updates) => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const logWeight = async ({ date, weight_kg, note }) => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('weight_log')
    .upsert({ user_id: userId, date, weight_kg, note }, { onConflict: 'user_id,date' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const getWeightHistory = async (params = '') => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('weight_log')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

// Meals
export const getMeals = async (date) => {
  const userId = await getUserId();
  const { data: meals, error } = await supabase
    .from('meals')
    .select('*, meal_items(*, foods(photo_url), recipes(photo_url))')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (meals || []).map(m => ({
    ...m,
    items: (m.meal_items || []).map(item => ({
      ...item,
      photo_url: item.foods?.photo_url || item.recipes?.photo_url || null,
    }))
  }));
};

export const getMealSummary = async (date) => {
  const userId = await getUserId();
  const { data: meals } = await supabase
    .from('meals')
    .select('id, meal_items(calories, protein_g, carbs_g, fat_g)')
    .eq('user_id', userId)
    .eq('date', date);

  let total_calories = 0, total_protein = 0, total_carbs = 0, total_fat = 0;
  let meal_count = 0, item_count = 0;

  if (meals) {
    meal_count = meals.length;
    for (const m of meals) {
      for (const item of (m.meal_items || [])) {
        total_calories += item.calories || 0;
        total_protein += item.protein_g || 0;
        total_carbs += item.carbs_g || 0;
        total_fat += item.fat_g || 0;
        item_count++;
      }
    }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('daily_calories_target, daily_protein_target, daily_carbs_target, daily_fat_target')
    .eq('user_id', userId)
    .single();

  return {
    total_calories, total_protein, total_carbs, total_fat,
    meal_count, item_count,
    targets: profile || { daily_calories_target: 2000, daily_protein_target: 120, daily_carbs_target: 250, daily_fat_target: 65 }
  };
};

export const addMeal = async ({ date, meal_type, items }) => {
  const userId = await getUserId();
  const mealDate = date || new Date().toISOString().split('T')[0];

  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .insert({ user_id: userId, date: mealDate, meal_type: meal_type || 'other' })
    .select()
    .single();
  if (mealError) throw new Error(mealError.message);

  const mealItems = items.map(item => ({
    meal_id: meal.id,
    food_id: item.food_id || null,
    recipe_id: item.recipe_id || null,
    product_name: item.product_name,
    brand: item.brand || '',
    amount_g: item.amount_g,
    serving_description: item.serving_description || '',
    calories: item.calories || 0,
    protein_g: item.protein_g || 0,
    carbs_g: item.carbs_g || 0,
    fat_g: item.fat_g || 0
  }));

  const { error: itemsError } = await supabase
    .from('meal_items')
    .insert(mealItems);
  if (itemsError) throw new Error(itemsError.message);

  return { id: meal.id, message: 'הארוחה נשמרה' };
};

export const updateMealItem = async (id, updates) => {
  const { error } = await supabase
    .from('meal_items')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { message: 'הפריט עודכן' };
};

export const deleteMeal = async (id) => {
  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { message: 'הארוחה נמחקה' };
};

export const deleteMealItem = async (id) => {
  const { data: item } = await supabase
    .from('meal_items')
    .select('meal_id')
    .eq('id', id)
    .single();

  await supabase.from('meal_items').delete().eq('id', id);

  if (item) {
    const { count } = await supabase
      .from('meal_items')
      .select('id', { count: 'exact', head: true })
      .eq('meal_id', item.meal_id);
    if (count === 0) {
      await supabase.from('meals').delete().eq('id', item.meal_id);
    }
  }

  return { message: 'הפריט נמחק' };
};

// Products (search foods + recipes with photos, categories, servings)
export const searchProducts = async (q) => {
  const query = `%${q}%`;
  const [{ data: foods }, { data: recipes }] = await Promise.all([
    supabase.from('foods')
      .select('*, food_categories(category_id, categories(name)), food_servings(name, amount_g)')
      .or(`name.ilike.${query},brand.ilike.${query}`)
      .limit(20),
    supabase.from('recipes')
      .select('*, recipe_categories(category_id, categories(name))')
      .or(`name.ilike.${query},author.ilike.${query}`)
      .limit(20),
  ]);

  const mapFood = f => ({
    ...f, type: 'food',
    category: (f.food_categories || []).map(c => c.categories?.name).filter(Boolean),
    serving_sizes: f.food_servings || [],
    nutrients_per_100g: { calories: f.calories_per_100g, protein_g: f.protein_per_100g, carbs_g: f.carbs_per_100g, fat_g: f.fat_per_100g }
  });
  const mapRecipe = r => ({
    ...r, type: 'recipe', brand: r.author,
    category: (r.recipe_categories || []).map(c => c.categories?.name).filter(Boolean),
    nutrients_per_100g: { calories: r.calories_per_100g, protein_g: r.protein_per_100g, carbs_g: r.carbs_per_100g, fat_g: r.fat_per_100g },
    serving_sizes: [{ name: 'מנה', amount_g: r.serving_weight_g || 300 }]
  });

  return [...(foods || []).map(mapFood), ...(recipes || []).map(mapRecipe)].slice(0, 20);
};

// AI Food Analysis
function getGeminiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || null;
}

async function buildProductCatalog() {
  const [{ data: foods }, { data: recipes }] = await Promise.all([
    supabase.from('foods')
      .select('id, name, brand, food_servings(name, amount_g)')
      .limit(500),
    supabase.from('recipes')
      .select('id, name, author, serving_weight_g')
      .limit(200),
  ]);

  const lines = [];
  for (const f of (foods || [])) {
    const servings = (f.food_servings || []).map(s => `${s.name}=${s.amount_g}g`).join(', ');
    lines.push(`[F${f.id}] ${f.name}${f.brand ? ` (${f.brand})` : ''}${servings ? ` | מנות: ${servings}` : ''}`);
  }
  for (const r of (recipes || [])) {
    lines.push(`[R${r.id}] ${r.name}${r.author ? ` (${r.author})` : ''} | מנות: מנה=${r.serving_weight_g || 300}g`);
  }
  return lines.join('\n');
}

const AI_PROMPT = `אתה עוזר תזונה עבור אפליקציית Trackfit.
המשתמש יתאר מה אכל בטקסט חופשי. זהה את המוצרים והתאם אותם לרשימת המוצרים שלנו.

חוקים:
1. התאם רק למוצרים מהרשימה. אם אין התאמה מדויקת, בחר את הקרוב ביותר.
2. אם אין התאמה כלל, השתמש ב-product_id: null.
3. הערך כמות בגרמים לפי התיאור (כפית=5g, כף=15g, כוס=240g, פרוסה=25g, יחידה=לפי מוצר).
4. ה-product_id כולל תחילית: F למזון, R למתכון.

החזר JSON בלבד (ללא markdown):
{
  "items": [
    { "product_id": "F123", "product_name": "שם", "brand": "", "amount_g": 30, "serving_description": "2 כפות" }
  ]
}`;

export const analyzeWithAI = async (text) => {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('מפתח AI לא מוגדר. פנה למנהל המערכת.');

  const catalog = await buildProductCatalog();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const result = await model.generateContent([
    { text: `${AI_PROMPT}\n\nרשימת המוצרים:\n${catalog}\n\n---\nהמשתמש אמר: ${text}` }
  ]);

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI לא הצליח לזהות מוצרים. נסה שוב.');
  const parsed = JSON.parse(jsonMatch[0]);

  // Enrich with nutritional data
  const enriched = await Promise.all((parsed.items || []).map(async (item) => {
    const rawId = String(item.product_id || '');
    let food = null;

    if (rawId.startsWith('F')) {
      const id = parseInt(rawId.slice(1));
      if (!isNaN(id)) {
        const { data } = await supabase.from('foods').select('*').eq('id', id).single();
        if (data) food = { ...data, type: 'food' };
      }
    } else if (rawId.startsWith('R')) {
      const id = parseInt(rawId.slice(1));
      if (!isNaN(id)) {
        const { data } = await supabase.from('recipes').select('*').eq('id', id).single();
        if (data) food = { ...data, type: 'recipe', brand: data.author };
      }
    }

    const g = item.amount_g || 100;
    if (food) {
      const factor = g / 100;
      return {
        food_id: food.type === 'food' ? food.id : null,
        recipe_id: food.type === 'recipe' ? food.id : null,
        product_name: food.name,
        brand: food.brand || '',
        amount_g: g,
        serving_description: item.serving_description || '',
        calories: Math.round((food.calories_per_100g || 0) * factor),
        protein_g: +((food.protein_per_100g || 0) * factor).toFixed(1),
        carbs_g: +((food.carbs_per_100g || 0) * factor).toFixed(1),
        fat_g: +((food.fat_per_100g || 0) * factor).toFixed(1),
        photo_url: food.photo_url || null,
      };
    }

    return {
      food_id: null, recipe_id: null,
      product_name: item.product_name || 'מוצר לא מזוהה',
      brand: item.brand || '', amount_g: g,
      serving_description: item.serving_description || '',
      calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, photo_url: null,
    };
  }));

  return enriched;
};
