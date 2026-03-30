-- =============================================
-- TrackFit Schema V2 - Migration
-- Separates foods from recipes, normalizes categories
-- Run this in Supabase SQL Editor AFTER the initial schema
-- =============================================

-- =====================
-- Categories (normalized master table)
-- =====================
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- =====================
-- Foods (individual food items)
-- =====================
CREATE TABLE IF NOT EXISTS foods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  photo_url TEXT,
  url TEXT,
  barcode TEXT,
  calories_per_100g NUMERIC NOT NULL DEFAULT 0,
  protein_per_100g NUMERIC NOT NULL DEFAULT 0,
  carbs_per_100g NUMERIC NOT NULL DEFAULT 0,
  fat_per_100g NUMERIC NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'custom',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_servings (
  id SERIAL PRIMARY KEY,
  food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_g NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS food_categories (
  food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (food_id, category_id)
);

-- =====================
-- Recipes
-- =====================
CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  author TEXT,
  description TEXT,
  photo_url TEXT,
  url TEXT,
  servings_count INTEGER DEFAULT 1,
  serving_weight_g NUMERIC DEFAULT 300,
  calories_per_100g NUMERIC DEFAULT 0,
  protein_per_100g NUMERIC DEFAULT 0,
  carbs_per_100g NUMERIC DEFAULT 0,
  fat_per_100g NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'custom',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
  ingredient_name TEXT NOT NULL,
  amount_g NUMERIC NOT NULL,
  calories NUMERIC DEFAULT 0,
  protein_g NUMERIC DEFAULT 0,
  carbs_g NUMERIC DEFAULT 0,
  fat_g NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipe_categories (
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, category_id)
);

-- =====================
-- Update meal_items to reference foods or recipes
-- =====================
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL;
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL;

-- =====================
-- Indexes
-- =====================
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
CREATE INDEX IF NOT EXISTS idx_foods_source ON foods(source);
CREATE INDEX IF NOT EXISTS idx_food_categories_cat ON food_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name);
CREATE INDEX IF NOT EXISTS idx_recipes_source ON recipes(source);
CREATE INDEX IF NOT EXISTS idx_recipe_categories_cat ON recipe_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

-- =====================
-- RLS Policies
-- =====================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_servings ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Foods viewable by everyone" ON foods FOR SELECT USING (true);
CREATE POLICY "Food servings viewable by everyone" ON food_servings FOR SELECT USING (true);
CREATE POLICY "Food categories viewable by everyone" ON food_categories FOR SELECT USING (true);
CREATE POLICY "Categories viewable by everyone" ON categories FOR SELECT USING (true);
CREATE POLICY "Recipes viewable by everyone" ON recipes FOR SELECT USING (true);
CREATE POLICY "Recipe ingredients viewable by everyone" ON recipe_ingredients FOR SELECT USING (true);
CREATE POLICY "Recipe categories viewable by everyone" ON recipe_categories FOR SELECT USING (true);
