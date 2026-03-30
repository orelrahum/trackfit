import { useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import FoodInput from '../components/FoodInput';
import AnalysisResult from '../components/AnalysisResult';
import MealList from '../components/MealList';
import DailySummary from '../components/DailySummary';
import { getMeals, getMealSummary, addMeal, deleteMeal, deleteMealItem } from '../api';
import { useEffect } from 'react';

const MEAL_TYPES = [
  { value: 'breakfast', label: '🌅 בוקר' },
  { value: 'lunch', label: '☀️ צהריים' },
  { value: 'dinner', label: '🌙 ערב' },
  { value: 'snack', label: '🍎 חטיף' },
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
  const [analysisResult, setAnalysisResult] = useState(null);
  const [mealType, setMealType] = useState('other');
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

  const handleAnalysisResult = (result) => {
    // Mark all items as selected by default
    const items = result.items.map(i => ({ ...i, selected: true }));
    setAnalysisResult({ ...result, items });
    setError(null);
  };

  const handleToggleItem = (idx) => {
    setAnalysisResult(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], selected: items[idx].selected === false ? true : false };
      return { ...prev, items };
    });
  };

  const handleConfirm = async () => {
    if (!analysisResult) return;
    const selectedItems = analysisResult.items.filter(i => i.selected !== false);
    if (selectedItems.length === 0) {
      setError('בחר לפחות פריט אחד');
      return;
    }

    try {
      await addMeal({
        date: formatDate(date),
        meal_type: mealType,
        items: selectedItems
      });
      setAnalysisResult(null);
      showToast('הארוחה נשמרה! ✅');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMeal = async (id) => {
    try {
      await deleteMeal(id);
      showToast('הארוחה נמחקה');
      loadData();
    } catch (err) {
      setError(err.message);
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

      {/* Daily Summary */}
      <DailySummary summary={summary} />

      {/* Food Input */}
      <div className="input-section">
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
        <FoodInput 
          onResult={handleAnalysisResult}
          onError={(msg) => setError(msg)}
        />
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

      {/* Analysis Result */}
      {analysisResult && (
        <AnalysisResult
          result={analysisResult}
          onConfirm={handleConfirm}
          onCancel={() => setAnalysisResult(null)}
          onToggleItem={handleToggleItem}
        />
      )}

      {/* Meal List */}
      <MealList 
        meals={meals}
        onDeleteMeal={handleDeleteMeal}
        onDeleteItem={handleDeleteItem}
      />
    </div>
  );
}
