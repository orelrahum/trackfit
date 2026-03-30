-- =============================================
-- TrackFit Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================

-- =====================
-- User Profiles (linked to Supabase Auth)
-- =====================
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')) DEFAULT 'moderate',
  goal TEXT CHECK (goal IN ('lose', 'maintain', 'gain')) DEFAULT 'maintain',
  daily_calories_target NUMERIC DEFAULT 2000,
  daily_protein_target NUMERIC DEFAULT 120,
  daily_carbs_target NUMERIC DEFAULT 250,
  daily_fat_target NUMERIC DEFAULT 65,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Products Catalog
-- =====================
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  photo_url TEXT,
  url TEXT,
  calories_per_100g NUMERIC NOT NULL DEFAULT 0,
  protein_per_100g NUMERIC NOT NULL DEFAULT 0,
  carbs_per_100g NUMERIC NOT NULL DEFAULT 0,
  fat_per_100g NUMERIC NOT NULL DEFAULT 0,
  is_custom BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'fuder',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_categories (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  PRIMARY KEY (product_id, category)
);

CREATE TABLE IF NOT EXISTS product_servings (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_g NUMERIC NOT NULL
);

-- =====================
-- Meals & Tracking
-- =====================
CREATE TABLE IF NOT EXISTS meals (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_items (
  id SERIAL PRIMARY KEY,
  meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  brand TEXT,
  amount_g NUMERIC NOT NULL,
  serving_description TEXT,
  calories NUMERIC NOT NULL DEFAULT 0,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0
);

-- =====================
-- Weight Tracking
-- =====================
CREATE TABLE IF NOT EXISTS weight_log (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- =====================
-- App Settings
-- =====================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- =====================
-- Indexes
-- =====================
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON meal_items(meal_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_product_categories ON product_categories(category);
CREATE INDEX IF NOT EXISTS idx_weight_log_user ON weight_log(user_id, date);

-- =====================
-- Auto-create profile on user signup
-- =====================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================
-- Row Level Security (RLS)
-- =====================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_servings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Service role (backend) bypasses RLS automatically.
-- These policies allow authenticated users to read products (public data).
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (true);
CREATE POLICY "Categories are viewable by everyone" ON product_categories FOR SELECT USING (true);
CREATE POLICY "Servings are viewable by everyone" ON product_servings FOR SELECT USING (true);
CREATE POLICY "Settings viewable by everyone" ON settings FOR SELECT USING (true);

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own meals" ON meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meals" ON meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own meals" ON meals FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own meal items" ON meal_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid())
);
CREATE POLICY "Users can insert own meal items" ON meal_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid())
);
CREATE POLICY "Users can delete own meal items" ON meal_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid())
);
CREATE POLICY "Users can view own weight" ON weight_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight" ON weight_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight" ON weight_log FOR UPDATE USING (auth.uid() = user_id);
