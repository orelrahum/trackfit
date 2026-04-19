import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import supabase from './db/supabase.js';
import { rebuildCache } from './services/productService.js';
import { initializeAI } from './services/aiService.js';

import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import mealsRouter from './routes/meals.js';
import analyzeRouter from './routes/analyze.js';
import productsRouter from './routes/products.js';
import settingsRouter from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Build product cache from Supabase
await rebuildCache();

// Initialize AI if key is available
const { data: savedKey } = await supabase.from('settings').select('value').eq('key', 'gemini_api_key').single();
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
app.get('/api/health', async (req, res) => {
  const { count: foodCount } = await supabase.from('foods').select('id', { count: 'exact', head: true });
  const { count: recipeCount } = await supabase.from('recipes').select('id', { count: 'exact', head: true });
  res.json({ status: 'ok', foods: foodCount, recipes: recipeCount });
});

app.listen(PORT, () => {
  console.log(`Trackfit server running on http://localhost:${PORT}`);
});
