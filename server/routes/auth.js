import { Router } from 'express';
import supabase from '../db/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Get current user + profile
router.get('/me', authMiddleware, async (req, res) => {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', req.user.id)
    .single();

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: profile?.name || req.user.name,
      profile_completed: !!(profile?.height_cm && profile?.weight_kg && profile?.gender && profile?.birth_date)
    }
  });
});

export default router;
