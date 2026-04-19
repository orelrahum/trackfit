import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { rebuildCache } from '../services/productService.js';
import supabase from '../db/supabase.js';

const router = Router();

// All admin routes require auth + admin
router.use(authMiddleware, adminMiddleware);

// Check admin status
router.get('/check', (req, res) => {
  res.json({ isAdmin: true });
});

// List all registered users with profiles
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });

    const users = data?.users || [];

    const { data: profiles } = await supabase.from('user_profiles').select('*');
    const profileMap = {};
    for (const p of (profiles || [])) {
      profileMap[p.user_id] = p;
    }

    const result = users.map(u => ({
      id: u.id,
      email: u.email,
      name: profileMap[u.id]?.name || u.user_metadata?.full_name || '',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      profile: profileMap[u.id] || null,
    }));

    res.json(result);
  } catch (e) {
    console.error('Admin users error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get all foods (for admin management)
router.get('/foods', async (req, res) => {
  const { page = 0, limit = 50, q } = req.query;
  const pageNum = parseInt(page);
  const pageSize = parseInt(limit);

  let query = supabase
    .from('foods')
    .select('*', { count: 'exact' })
    .order('id', { ascending: true })
    .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

  if (q) {
    query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%`);
  }

  const { data: foods, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ products: foods || [], total: count || 0, page: pageNum, pageSize });
});

// Update a food item
router.put('/foods/:id', async (req, res) => {
  const { id } = req.params;
  const { name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (brand !== undefined) updates.brand = brand;
  if (calories_per_100g !== undefined) updates.calories_per_100g = calories_per_100g;
  if (protein_per_100g !== undefined) updates.protein_per_100g = protein_per_100g;
  if (carbs_per_100g !== undefined) updates.carbs_per_100g = carbs_per_100g;
  if (fat_per_100g !== undefined) updates.fat_per_100g = fat_per_100g;

  const { data, error } = await supabase
    .from('foods')
    .update(updates)
    .eq('id', parseInt(id))
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await rebuildCache();
  res.json(data);
});

// Delete a food item
router.delete('/foods/:id', async (req, res) => {
  const { id } = req.params;
  const foodId = parseInt(id);

  await supabase.from('food_servings').delete().eq('food_id', foodId);
  await supabase.from('food_categories').delete().eq('food_id', foodId);

  const { error } = await supabase.from('foods').delete().eq('id', foodId);
  if (error) return res.status(500).json({ error: error.message });

  await rebuildCache();
  res.json({ success: true });
});

export default router;
