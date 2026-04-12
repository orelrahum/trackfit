import { useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Plus, Trash2, Pencil, Check, X, Search, Sparkles } from 'lucide-react';
import FoodInput from '../components/FoodInput';
import AIFoodInput from '../components/AIFoodInput';
import DailySummary from '../components/DailySummary';
import { getMeals, getMealSummary, addMeal, deleteMeal, deleteMealItem, updateMealItem } from '../api';
import { useEffect } from 'react';

const MEAL_TYPES = [
  { value: 'breakfast', label: '🌅 בוקר', full: '🌅 ארוחת בוקר' },
  { value: 'lunch', label: '☀️ צהריים', full: '☀️ ארוחת צהריים' },
  { value: 'dinner', label: '🌙 ערב', full: '🌙 ארוחת ערב' },
  { value: 'snack', label: '🍎 חטיף', full: '🍎 חטיף' },
];

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateHebrew(date) {
  return date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Home() {
  const [date, setDate] = useState(new Date());
  const [meals, setMeals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState('search');
  const [mealType, setMealType] = useState('breakfast');
  const [editingItem, setEditingItem] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      const dateStr = formatDate(date);
      const [mealsData, summaryData] = await Promise.all([
        getMeals(dateStr),
        getMealSummary(dateStr)
      ]);
      setMeals(mealsData);
      setSummary(summaryData);
    } catch (err) {
      setError(err.message);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const changeDate = (delta) => {
    setDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  const isToday = formatDate(date) === formatDate(new Date());

  const handleAddItem = async (item) => {
    // Optimistic: close panel and show toast immediately
    setShowAdd(false);
    showToast('הפריט נוסף! ✅');

    // Optimistic: add item to local state immediately
    const tempId = Date.now();
    const tempMeal = {
      id: tempId,
      meal_type: mealType,
      created_at: new Date().toISOString(),
      items: [{
        id: tempId,
        product_name: item.product_name,
        brand: item.brand,
        amount_g: item.amount_g,
        serving_description: item.serving_description,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
      }]
    };
    setMeals(prev => [tempMeal, ...prev]);
    setSummary(prev => prev ? {
      ...prev,
      total_calories: prev.total_calories + (item.calories || 0),
      total_protein: prev.total_protein + (item.protein_g || 0),
      total_carbs: prev.total_carbs + (item.carbs_g || 0),
      total_fat: prev.total_fat + (item.fat_g || 0),
      meal_count: prev.meal_count + 1,
      item_count: prev.item_count + 1,
    } : null);

    try {
      await addMeal({
        date: formatDate(date),
        meal_type: mealType,
        items: [item]
      });
      // Sync real data in background
      loadData();
    } catch (err) {
      setError(err.message);
      loadData(); // revert on error
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      await deleteMealItem(id);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Parse serving_description like "2 פרוסה" → { count: 2, unit: "פרוסה", gramsPerUnit }
  const parseServing = (item) => {
    if (!item.serving_description) return null;
    const match = item.serving_description.match(/^([\d.]+)\s+(.+)$/);
    if (!match) return null;
    const count = parseFloat(match[1]);
    if (!count || count <= 0) return null;
    return { count, unit: match[2], gramsPerUnit: item.amount_g / count };
  };

  const startEdit = (item) => {
    setEditingItem(item.id);
    const serving = parseServing(item);
    if (serving) {
      setEditAmount(String(serving.count));
    } else {
      setEditAmount(String(item.amount_g));
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditAmount('');
  };

  const saveEdit = async (item) => {
    const val = parseFloat(editAmount);
    if (!val || val <= 0) return;

    const serving = parseServing(item);
    let newAmountG, newServingDesc;

    if (serving) {
      newAmountG = Math.round(val * serving.gramsPerUnit);
      newServingDesc = `${val} ${serving.unit}`;
    } else {
      newAmountG = val;
      newServingDesc = item.serving_description || '';
    }

    const origG = item.amount_g || 100;
    const factor = newAmountG / origG;
    const updates = {
      amount_g: newAmountG,
      serving_description: newServingDesc,
      calories: Math.round((item.calories || 0) * factor),
      protein_g: +((item.protein_g || 0) * factor).toFixed(1),
      carbs_g: +((item.carbs_g || 0) * factor).toFixed(1),
      fat_g: +((item.fat_g || 0) * factor).toFixed(1),
    };

    setEditingItem(null);
    try {
      await updateMealItem(item.id, updates);
      showToast('הפריט עודכן ✅');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const getMealsForType = (type) => meals.filter(m => m.meal_type === type);

  return (
    <div className="home-page">
      {/* Date Navigation */}
      <div className="date-nav">
        <button className="icon-btn" onClick={() => changeDate(-1)} title="יום קודם">
          <ChevronRight size={24} />
        </button>
        <div className="date-display">
          <span className="date-text">
            {isToday ? `היום, ${formatDateHebrew(date)}` : formatDateHebrew(date)}
          </span>
          {!isToday && (
            <button className="today-btn" onClick={() => setDate(new Date())}>חזרה להיום</button>
          )}
        </div>
        <button className="icon-btn" onClick={() => changeDate(1)} title="יום הבא">
          <ChevronLeft size={24} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          ⚠️ {error}
        </div>
      )}

      {/* Success Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.msg}
        </div>
      )}

      {/* Two-column layout */}
      <div className="home-columns">
        {/* Left: Summary + Add */}
        <div className="home-sidebar">
          <DailySummary summary={summary} />

          {!showAdd ? (
            <button className="global-add-btn" onClick={() => setShowAdd(true)}>
              <Plus size={20} />
              <span>הוסף מה שאכלת</span>
            </button>
          ) : (
            <div className="add-food-panel">
              <div className="add-mode-toggle">
                <button
                  className={`mode-btn ${addMode === 'search' ? 'active' : ''}`}
                  onClick={() => setAddMode('search')}
                >
                  <Search size={16} /> חיפוש
                </button>
                <button
                  className={`mode-btn ${addMode === 'ai' ? 'active' : ''}`}
                  onClick={() => setAddMode('ai')}
                >
                  <Sparkles size={16} /> AI חכם
                </button>
              </div>
              <div className="meal-type-selector">
                {MEAL_TYPES.map(t => (
                  <button
                    key={t.value}
                    className={`meal-type-btn ${mealType === t.value ? 'active' : ''}`}
                    onClick={() => setMealType(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {addMode === 'search' ? (
                <FoodInput
                  onAdd={handleAddItem}
                  onCancel={() => setShowAdd(false)}
                />
              ) : (
                <AIFoodInput
                  onAdd={handleAddItem}
                  onCancel={() => setShowAdd(false)}
                />
              )}
            </div>
          )}
        </div>

        {/* Right: Meal Sections */}
        <div className="home-main">
          {meals.length === 0 && !showAdd && (
            <div className="empty-state">
              <p>עדיין לא נרשמו ארוחות להיום</p>
              <p>לחץ על ״הוסף מה שאכלת״ כדי להתחיל 🍽️</p>
            </div>
          )}

          <div className="meal-sections">
            {MEAL_TYPES.map(({ value, full }) => {
              const typeMeals = getMealsForType(value);
              const typeItems = typeMeals.flatMap(m => m.items.map(i => ({ ...i, mealId: m.id })));
              if (typeItems.length === 0) return null;

              const totalCal = typeItems.reduce((sum, i) => sum + (i.calories || 0), 0);

              return (
                <div key={value} className="meal-section">
                  <div className="meal-section-header">
                    <h3>{full}</h3>
                    <span className="section-cal">{Math.round(totalCal)} קק״ל</span>
                  </div>
                  <div className="meal-section-items">
                    {typeItems.map((item) => (
                      <div key={item.id} className="meal-item">
                        {item.photo_url ? (
                          <img src={item.photo_url} alt="" className="meal-item-photo" />
                        ) : (
                          <div className="meal-item-photo-placeholder">🍽️</div>
                        )}
                        <div className="meal-item-info">
                          <span className="meal-item-name">{item.product_name}</span>
                          {item.brand && <span className="meal-item-brand">{item.brand}</span>}
                          {editingItem === item.id ? (
                            <div className="edit-amount-row">
                              <input
                                type="number"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                min="0.5"
                                step={parseServing(item) ? '0.5' : '1'}
                                dir="ltr"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(item);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                              <span>{parseServing(item)?.unit || 'g'}</span>
                              <button className="icon-btn tiny" onClick={() => saveEdit(item)} title="שמור">
                                <Check size={14} />
                              </button>
                              <button className="icon-btn tiny" onClick={cancelEdit} title="ביטול">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className="meal-item-amount">
                              {item.serving_description && `${item.serving_description} · `}
                              {item.amount_g}g
                            </span>
                          )}
                        </div>
                        <div className="meal-item-nutrients">
                          <span className="cal">{Math.round(item.calories)}</span>
                          <div className="meal-item-actions">
                            <button
                              className="icon-btn tiny"
                              onClick={() => startEdit(item)}
                              title="ערוך כמות"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              className="icon-btn tiny danger"
                              onClick={() => handleDeleteItem(item.id)}
                              title="מחק פריט"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
