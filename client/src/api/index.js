import { supabase } from '../lib/supabase';

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('נדרשת התחברות');
  return user.id;
}

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
    .select('*, meal_items(*)')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (meals || []).map(m => ({ ...m, items: m.meal_items || [] }));
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

// Products (search foods + recipes)
export const searchProducts = async (q) => {
  const query = `%${q}%`;
  const [{ data: foods }, { data: recipes }] = await Promise.all([
    supabase.from('foods').select('*').or(`name.ilike.${query},brand.ilike.${query}`).limit(20),
    supabase.from('recipes').select('*').or(`name.ilike.${query},author.ilike.${query}`).limit(20),
  ]);

  const mapFood = f => ({
    ...f, type: 'food',
    nutrients_per_100g: { calories: f.calories_per_100g, protein_g: f.protein_per_100g, carbs_g: f.carbs_per_100g, fat_g: f.fat_per_100g }
  });
  const mapRecipe = r => ({
    ...r, type: 'recipe', brand: r.author,
    nutrients_per_100g: { calories: r.calories_per_100g, protein_g: r.protein_per_100g, carbs_g: r.carbs_per_100g, fat_g: r.fat_per_100g },
    serving_sizes: [{ name: 'מנה', amount_g: r.serving_weight_g || 300 }]
  });

  return [...(foods || []).map(mapFood), ...(recipes || []).map(mapRecipe)].slice(0, 20);
};
