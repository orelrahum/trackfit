import { Router } from 'express';
import supabase from '../db/supabase.js';
import { initializeAI } from '../services/aiService.js';

const router = Router();

// Get a setting
router.get('/:key', async (req, res) => {
  const { data: row } = await supabase
    .from('settings')
    .select('value')
    .eq('key', req.params.key)
    .single();

  if (row) {
    if (req.params.key === 'gemini_api_key') {
      const val = row.value;
      res.json({ value: val.slice(0, 6) + '...' + val.slice(-4), configured: true });
    } else {
      res.json({ value: row.value });
    }
  } else {
    res.json({ value: null, configured: false });
  }
});

// Set a setting
router.post('/', async (req, res) => {
  const { key, value } = req.body;
  await supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' });

  if (key === 'gemini_api_key') {
    try {
      initializeAI(value);
      res.json({ message: 'API key saved and AI initialized' });
    } catch (e) {
      res.json({ message: 'API key saved but initialization failed: ' + e.message });
    }
  } else {
    res.json({ message: 'Setting saved' });
  }
});

export default router;
