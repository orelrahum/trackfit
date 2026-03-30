import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'trackfit-secret-change-in-production';
const JWT_EXPIRES = '7d';

export function registerUser(email, password, name) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw new Error('כתובת האימייל כבר רשומה');
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
  ).run(email, passwordHash, name);

  const userId = result.lastInsertRowid;

  // Create default profile
  db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(userId);

  return { id: userId, email, name };
}

export function loginUser(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    throw new Error('אימייל או סיסמה שגויים');
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    throw new Error('אימייל או סיסמה שגויים');
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES
  });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, profile_completed: isProfileCompleted(user.id) }
  };
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function isProfileCompleted(userId) {
  const profile = db.prepare(
    'SELECT height_cm, weight_kg, gender, birth_date FROM user_profiles WHERE user_id = ?'
  ).get(userId);
  if (!profile) return false;
  return !!(profile.height_cm && profile.weight_kg && profile.gender && profile.birth_date);
}

export function getUserById(id) {
  return db.prepare(
    'SELECT id, email, name, created_at FROM users WHERE id = ?'
  ).get(id);
}
