import supabase from '../db/supabase.js';

export async function isProfileCompleted(userId) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('height_cm, weight_kg, gender, birth_date')
    .eq('user_id', userId)
    .single();

  if (!profile) return false;
  return !!(profile.height_cm && profile.weight_kg && profile.gender && profile.birth_date);
}
