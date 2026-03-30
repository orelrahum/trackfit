import { Router } from 'express';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All profile routes require authentication
router.use(authMiddleware);

// Get user profile
router.get('/', (req, res) => {
  const profile = db.prepare(`
    SELECT u.id, u.email, u.name, u.created_at,
      p.height_cm, p.weight_kg, p.birth_date, p.gender,
      p.activity_level, p.goal,
      p.daily_calories_target, p.daily_protein_target,
      p.daily_carbs_target, p.daily_fat_target
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ?
  `).get(req.user.id);

  res.json(profile);
});

// Update user profile
router.put('/', (req, res) => {
  const {
    name, height_cm, weight_kg, birth_date, gender,
    activity_level, goal,
    daily_calories_target, daily_protein_target,
    daily_carbs_target, daily_fat_target
  } = req.body;

  const transaction = db.transaction(() => {
    // Update user name if provided
    if (name) {
      db.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(name, req.user.id);
    }

    // Update profile
    db.prepare(`
      INSERT INTO user_profiles (user_id, height_cm, weight_kg, birth_date, gender, activity_level, goal,
        daily_calories_target, daily_protein_target, daily_carbs_target, daily_fat_target, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        height_cm = COALESCE(?, height_cm),
        weight_kg = COALESCE(?, weight_kg),
        birth_date = COALESCE(?, birth_date),
        gender = COALESCE(?, gender),
        activity_level = COALESCE(?, activity_level),
        goal = COALESCE(?, goal),
        daily_calories_target = COALESCE(?, daily_calories_target),
        daily_protein_target = COALESCE(?, daily_protein_target),
        daily_carbs_target = COALESCE(?, daily_carbs_target),
        daily_fat_target = COALESCE(?, daily_fat_target),
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user.id,
      height_cm, weight_kg, birth_date, gender, activity_level, goal,
      daily_calories_target, daily_protein_target, daily_carbs_target, daily_fat_target,
      height_cm, weight_kg, birth_date, gender, activity_level, goal,
      daily_calories_target, daily_protein_target, daily_carbs_target, daily_fat_target
    );
  });

  try {
    transaction();
    // Return updated profile
    const profile = db.prepare(`
      SELECT u.id, u.email, u.name, u.created_at,
        p.height_cm, p.weight_kg, p.birth_date, p.gender,
        p.activity_level, p.goal,
        p.daily_calories_target, p.daily_protein_target,
        p.daily_carbs_target, p.daily_fat_target
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = ?
    `).get(req.user.id);
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Log weight
router.post('/weight', (req, res) => {
  const { date, weight_kg, note } = req.body;
  const logDate = date || new Date().toISOString().split('T')[0];

  try {
    db.prepare(`
      INSERT INTO weight_log (user_id, date, weight_kg, note)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        weight_kg = ?, note = ?
    `).run(req.user.id, logDate, weight_kg, note || null, weight_kg, note || null);

    res.json({ message: 'נשמר בהצלחה' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get weight history
router.get('/weight', (req, res) => {
  const { from, to, limit } = req.query;
  let query = 'SELECT * FROM weight_log WHERE user_id = ?';
  const params = [req.user.id];

  if (from) { query += ' AND date >= ?'; params.push(from); }
  if (to) { query += ' AND date <= ?'; params.push(to); }
  query += ' ORDER BY date DESC';
  if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

export default router;
