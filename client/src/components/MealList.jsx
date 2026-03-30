import { Trash2 } from 'lucide-react';

const MEAL_TYPE_LABELS = {
  breakfast: '🌅 ארוחת בוקר',
  lunch: '☀️ ארוחת צהריים',
  dinner: '🌙 ארוחת ערב',
  snack: '🍎 חטיף',
  other: '🍽️ ארוחה',
};

export default function MealList({ meals, onDeleteMeal, onDeleteItem }) {
  if (!meals || meals.length === 0) {
    return (
      <div className="empty-state">
        <p>עדיין לא נרשמו ארוחות להיום</p>
        <p>תתחיל לתעד מה אכלת! 🍽️</p>
      </div>
    );
  }

  return (
    <div className="meal-list">
      {meals.map((meal) => {
        const mealTotals = meal.items.reduce((acc, item) => ({
          calories: acc.calories + (item.calories || 0),
          protein: acc.protein + (item.protein_g || 0),
          carbs: acc.carbs + (item.carbs_g || 0),
          fat: acc.fat + (item.fat_g || 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        return (
          <div key={meal.id} className="meal-card">
            <div className="meal-header">
              <h3>{MEAL_TYPE_LABELS[meal.meal_type] || MEAL_TYPE_LABELS.other}</h3>
              <div className="meal-header-actions">
                <span className="meal-time">
                  {new Date(meal.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button 
                  className="icon-btn small danger" 
                  onClick={() => onDeleteMeal?.(meal.id)}
                  title="מחק ארוחה"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            
            <div className="meal-items">
              {meal.items.map((item) => (
                <div key={item.id} className="meal-item">
                  <div className="meal-item-info">
                    <span className="meal-item-name">{item.product_name}</span>
                    {item.brand && <span className="meal-item-brand">{item.brand}</span>}
                    <span className="meal-item-amount">
                      {item.serving_description && `${item.serving_description} · `}
                      {item.amount_g}g
                    </span>
                  </div>
                  <div className="meal-item-nutrients">
                    <span className="cal">{Math.round(item.calories)}</span>
                    <button 
                      className="icon-btn tiny danger"
                      onClick={() => onDeleteItem?.(item.id)}
                      title="מחק פריט"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="meal-totals">
              <span>{Math.round(mealTotals.calories)} קק״ל</span>
              <span>ח: {mealTotals.protein.toFixed(1)}g</span>
              <span>פ: {mealTotals.carbs.toFixed(1)}g</span>
              <span>ש: {mealTotals.fat.toFixed(1)}g</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
