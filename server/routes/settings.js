import { Router } from 'express';
import db from '../db/database.js';
import { initializeAI } from '../services/aiService.js';

const router = Router();

// Get a setting
router.get('/:key', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key);
  if (row) {
    // Mask API key for security
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
router.post('/', (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  
  // If API key was set, reinitialize AI
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
