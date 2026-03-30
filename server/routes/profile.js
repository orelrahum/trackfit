import { Router } from 'express';
import supabase from '../db/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Get user profile
router.get('/', async (req, res) => {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', req.user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    id: req.user.id,
    email: req.user.email,
    name: profile?.name || req.user.name,
    ...profile
  });
});

// Update user profile
router.put('/', async (req, res) => {
  const {
    name, height_cm, weight_kg, birth_date, gender,
    activity_level, goal,
    daily_calories_target, daily_protein_target,
    daily_carbs_target, daily_fat_target
  } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (height_cm !== undefined) updates.height_cm = height_cm;
  if (weight_kg !== undefined) updates.weight_kg = weight_kg;
  if (birth_date !== undefined) updates.birth_date = birth_date;
  if (gender !== undefined) updates.gender = gender;
  if (activity_level !== undefined) updates.activity_level = activity_level;
  if (goal !== undefined) updates.goal = goal;
  if (daily_calories_target !== undefined) updates.daily_calories_target = daily_calories_target;
  if (daily_protein_target !== undefined) updates.daily_protein_target = daily_protein_target;
  if (daily_carbs_target !== undefined) updates.daily_carbs_target = daily_carbs_target;
  if (daily_fat_target !== undefined) updates.daily_fat_target = daily_fat_target;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: req.user.id, ...updates }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ id: req.user.id, email: req.user.email, ...data });
});

// Log weight
router.post('/weight', async (req, res) => {
  const { date, weight_kg, note } = req.body;
  const logDate = date || new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('weight_log')
    .upsert(
      { user_id: req.user.id, date: logDate, weight_kg, note: note || null },
      { onConflict: 'user_id,date' }
    );

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'נשמר בהצלחה' });
});

// Get weight history
router.get('/weight', async (req, res) => {
  const { from, to, limit } = req.query;

  let query = supabase
    .from('weight_log')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (limit) query = query.limit(parseInt(limit));

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
