import { Router } from 'express';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All meal routes require authentication
router.use(authMiddleware);

// Get meals for a date
router.get('/', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  
  const meals = db.prepare(`
    SELECT m.*, 
      json_group_array(json_object(
        'id', mi.id,
        'product_id', mi.product_id,
        'product_name', mi.product_name,
        'brand', mi.brand,
        'amount_g', mi.amount_g,
        'serving_description', mi.serving_description,
        'calories', mi.calories,
        'protein_g', mi.protein_g,
        'carbs_g', mi.carbs_g,
        'fat_g', mi.fat_g
      )) as items
    FROM meals m
    LEFT JOIN meal_items mi ON mi.meal_id = m.id
    WHERE m.date = ? AND m.user_id = ?
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `).all(date, req.user.id);
  
  const parsed = meals.map(m => ({
    ...m,
    items: JSON.parse(m.items).filter(i => i.id !== null)
  }));
  
  res.json(parsed);
});

// Get daily summary (includes user targets)
router.get('/summary', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  
  const summary = db.prepare(`
    SELECT 
      COALESCE(SUM(mi.calories), 0) as total_calories,
      COALESCE(SUM(mi.protein_g), 0) as total_protein,
      COALESCE(SUM(mi.carbs_g), 0) as total_carbs,
      COALESCE(SUM(mi.fat_g), 0) as total_fat,
      COUNT(DISTINCT m.id) as meal_count,
      COUNT(mi.id) as item_count
    FROM meals m
    LEFT JOIN meal_items mi ON mi.meal_id = m.id
    WHERE m.date = ? AND m.user_id = ?
  `).get(date, req.user.id);

  // Add user targets
  const profile = db.prepare(
    'SELECT daily_calories_target, daily_protein_target, daily_carbs_target, daily_fat_target FROM user_profiles WHERE user_id = ?'
  ).get(req.user.id);

  res.json({
    ...summary,
    targets: profile || { daily_calories_target: 2000, daily_protein_target: 120, daily_carbs_target: 250, daily_fat_target: 65 }
  });
});

// Add a meal with items
router.post('/', (req, res) => {
  const { date, meal_type, items } = req.body;
  const mealDate = date || new Date().toISOString().split('T')[0];
  const type = meal_type || 'other';
  
  const insertMeal = db.prepare('INSERT INTO meals (user_id, date, meal_type) VALUES (?, ?, ?)');
  const insertItem = db.prepare(`
    INSERT INTO meal_items (meal_id, product_id, product_name, brand, amount_g, serving_description, calories, protein_g, carbs_g, fat_g)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction(() => {
    const result = insertMeal.run(req.user.id, mealDate, type);
    const mealId = result.lastInsertRowid;
    
    for (const item of items) {
      insertItem.run(
        mealId,
        item.product_id || null,
        item.product_name,
        item.brand || '',
        item.amount_g,
        item.serving_description || '',
        item.calories || 0,
        item.protein_g || 0,
        item.carbs_g || 0,
        item.fat_g || 0
      );
    }
    
    return mealId;
  });
  
  try {
    const mealId = transaction();
    res.json({ id: mealId, message: 'הארוחה נשמרה' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete a meal (only own meals)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM meals WHERE id = ? AND user_id = ?').run(id, req.user.id);
  res.json({ message: 'הארוחה נמחקה' });
});

// Delete a single meal item (only from own meals)
router.delete('/item/:id', (req, res) => {
  const { id } = req.params;
  const item = db.prepare(`
    SELECT mi.meal_id FROM meal_items mi
    JOIN meals m ON m.id = mi.meal_id
    WHERE mi.id = ? AND m.user_id = ?
  `).get(id, req.user.id);

  if (!item) {
    return res.status(404).json({ error: 'פריט לא נמצא' });
  }

  db.prepare('DELETE FROM meal_items WHERE id = ?').run(id);
  
  const remaining = db.prepare('SELECT COUNT(*) as count FROM meal_items WHERE meal_id = ?').get(item.meal_id);
  if (remaining.count === 0) {
    db.prepare('DELETE FROM meals WHERE id = ?').run(item.meal_id);
  }
  
  res.json({ message: 'הפריט נמחק' });
});

export default router;
