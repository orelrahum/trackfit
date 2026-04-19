import { useState } from 'react';
import { Send, Loader2, X, Check, Trash2 } from 'lucide-react';
import { analyzeWithAI } from '../api';

export default function AIFoodInput({ onAdd, onCancel }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const items = await analyzeWithAI(text.trim());
      setResults(items.map(i => ({ ...i, selected: true })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (idx) => {
    setResults(prev => prev.map((item, i) =>
      i === idx ? { ...item, selected: !item.selected } : item
    ));
  };

  const removeItem = (idx) => {
    setResults(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    const selected = results.filter(i => i.selected);
    if (selected.length === 0) return;
    selected.forEach(item => {
      const { selected: _, ...clean } = item;
      onAdd?.(clean);
    });
  };

  // Show results for confirmation
  if (results && results.length > 0) {
    const totals = results.filter(i => i.selected).reduce((acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      protein_g: acc.protein_g + (i.protein_g || 0),
      carbs_g: acc.carbs_g + (i.carbs_g || 0),
      fat_g: acc.fat_g + (i.fat_g || 0),
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

    return (
      <div className="ai-food-input">
        <h4 className="ai-results-title">🤖 זיהוי AI</h4>
        <div className="ai-results-list">
          {results.map((item, idx) => (
            <div
              key={idx}
              className={`ai-result-item ${item.selected ? '' : 'deselected'}`}
              onClick={() => toggleItem(idx)}
            >
              {item.photo_url ? (
                <img src={item.photo_url} alt="" className="meal-item-photo" />
              ) : (
                <div className="meal-item-photo-placeholder">🍽️</div>
              )}
              <div className="ai-result-info">
                <span className="result-name">{item.product_name}</span>
                {item.brand && <span className="result-brand">{item.brand}</span>}
                <span className="meal-item-amount">
                  {item.serving_description && `${item.serving_description} · `}
                  {item.amount_g}g
                </span>
              </div>
              <div className="ai-result-right">
                <span className="cal">{Math.round(item.calories)} קק״ל</span>
                <button className="icon-btn tiny danger" onClick={(e) => { e.stopPropagation(); removeItem(idx); }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="nutrient-preview">
          <span>{Math.round(totals.calories)} קק״ל</span>
          <span className="protein">ח: {totals.protein_g.toFixed(1)}g</span>
          <span className="carbs">פ: {totals.carbs_g.toFixed(1)}g</span>
          <span className="fat">ש: {totals.fat_g.toFixed(1)}g</span>
        </div>

        <div className="add-actions">
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!results.some(i => i.selected)}>
            <Check size={16} /> הוסף הכל
          </button>
          <button className="btn btn-secondary" onClick={() => setResults(null)}>
            חזור
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            ביטול
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-food-input">
      <div className="ai-text-input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="תאר מה אכלת... למשל: 2 פרוסות לחם עם חמאת בוטנים וכוס חלב"
          rows={3}
          disabled={loading}
          dir="rtl"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAnalyze();
            }
          }}
        />
        <div className="ai-input-actions">
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={loading || !text.trim()}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            {loading ? 'מנתח...' : 'שלח ל-AI'}
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            ביטול
          </button>
        </div>
      </div>

      {error && (
        <div className="ai-error">⚠️ {error}</div>
      )}
    </div>
  );
}
