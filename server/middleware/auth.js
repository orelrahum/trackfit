import supabase from '../db/supabase.js';

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'נדרשת התחברות' });
  }

  const token = authHeader.split(' ')[1];

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'טוקן לא תקין או פג תוקף' });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  req.user = {
    id: user.id,
    email: user.email,
    name: profile?.name || user.user_metadata?.full_name || '',
    profile_completed: !!(profile?.height_cm && profile?.weight_kg && profile?.gender && profile?.birth_date)
  };
  next();
}
