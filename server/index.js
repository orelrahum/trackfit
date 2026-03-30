import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { seedProducts } from './db/seed.js';
import { seedExtraProducts } from './db/seedExtra.js';
import { rebuildCache } from './services/productService.js';
import { initializeAI } from './services/aiService.js';
import db from './db/database.js';

import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import mealsRouter from './routes/meals.js';
import analyzeRouter from './routes/analyze.js';
import productsRouter from './routes/products.js';
import settingsRouter from './routes/settings.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Seed products from JSON into DB (runs once)
seedProducts();
seedExtraProducts();
rebuildCache();

// Initialize AI if key is available
const savedKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
const apiKey = savedKey?.value || process.env.GEMINI_API_KEY;
if (apiKey && apiKey !== 'your_gemini_api_key_here') {
  try {
    initializeAI(apiKey);
  } catch (e) {
    console.warn('Failed to initialize AI:', e.message);
  }
}

// Routes
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/products', productsRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', (req, res) => {
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  res.json({ status: 'ok', products: productCount, users: userCount });
});

app.listen(PORT, () => {
  console.log(`Trackfit server running on http://localhost:${PORT}`);
});
