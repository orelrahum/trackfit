-- Allow users to update their own meal items
CREATE POLICY "Users can update own meal items" ON meal_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid())
);
x