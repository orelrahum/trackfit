import { Router } from 'express';
import supabase from '../db/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Get meals for a date
router.get('/', async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const { data: meals, error } = await supabase
    .from('meals')
    .select('*, meal_items(*)')
    .eq('user_id', req.user.id)
    .eq('date', date)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const parsed = meals.map(m => ({
    ...m,
    items: m.meal_items || []
  }));

  res.json(parsed);
});

// Get daily summary
router.get('/summary', async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const { data: meals } = await supabase
    .from('meals')
    .select('id, meal_items(calories, protein_g, carbs_g, fat_g)')
    .eq('user_id', req.user.id)
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
    .eq('user_id', req.user.id)
    .single();

  res.json({
    total_calories, total_protein, total_carbs, total_fat,
    meal_count, item_count,
    targets: profile || { daily_calories_target: 2000, daily_protein_target: 120, daily_carbs_target: 250, daily_fat_target: 65 }
  });
});

// Add a meal with items
router.post('/', async (req, res) => {
  const { date, meal_type, items } = req.body;
  const mealDate = date || new Date().toISOString().split('T')[0];
  const type = meal_type || 'other';

  const { data: meal, error: mealError } = await supabase
    .from('meals')
    .insert({ user_id: req.user.id, date: mealDate, meal_type: type })
    .select()
    .single();

  if (mealError) return res.status(500).json({ error: mealError.message });

  const mealItems = items.map(item => ({
    meal_id: meal.id,
    product_id: item.product_id || null,
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

  if (itemsError) return res.status(500).json({ error: itemsError.message });

  res.json({ id: meal.id, message: 'הארוחה נשמרה' });
});

// Delete a meal
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'הארוחה נמחקה' });
});

// Delete a single meal item
router.delete('/item/:id', async (req, res) => {
  // Verify ownership
  const { data: item } = await supabase
    .from('meal_items')
    .select('meal_id, meals!inner(user_id)')
    .eq('id', req.params.id)
    .single();

  if (!item || item.meals?.user_id !== req.user.id) {
    return res.status(404).json({ error: 'פריט לא נמצא' });
  }

  await supabase.from('meal_items').delete().eq('id', req.params.id);

  // Delete meal if no items left
  const { count } = await supabase
    .from('meal_items')
    .select('id', { count: 'exact', head: true })
    .eq('meal_id', item.meal_id);

  if (count === 0) {
    await supabase.from('meals').delete().eq('id', item.meal_id);
  }

  res.json({ message: 'הפריט נמחק' });
});

export default router;
