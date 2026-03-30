import { Check, X, AlertTriangle } from 'lucide-react';

export default function AnalysisResult({ result, onConfirm, onCancel, onToggleItem }) {
  if (!result || !result.items?.length) return null;

  const totals = result.items
    .filter(i => i.selected !== false)
    .reduce((acc, item) => ({
      calories: acc.calories + (item.calories || 0),
      protein: acc.protein + (item.protein_g || 0),
      carbs: acc.carbs + (item.carbs_g || 0),
      fat: acc.fat + (item.fat_g || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return (
    <div className="analysis-result">
      <h3>🔍 תוצאות זיהוי</h3>
      {result.notes && <p className="ai-notes">{result.notes}</p>}
      
      <div className="result-items">
        {result.items.map((item, idx) => (
          <div 
            key={idx} 
            className={`result-item ${item.selected === false ? 'deselected' : ''} ${!item.product_id ? 'unmatched' : ''}`}
            onClick={() => onToggleItem?.(idx)}
          >
            <div className="item-checkbox">
              {item.selected !== false ? <Check size={16} /> : <div className="unchecked" />}
            </div>
            <div className="item-details">
              <div className="item-name">
                {item.product_name}
                {item.brand && <span className="item-brand"> ({item.brand})</span>}
              </div>
              <div className="item-amount">
                {item.serving_description && `${item.serving_description} · `}
                {item.amount_g}g
              </div>
              {!item.product_id && (
                <div className="item-warning">
                  <AlertTriangle size={12} />
                  <span>לא נמצא מוצר תואם במאגר</span>
                </div>
              )}
            </div>
            <div className="item-nutrients">
              <span className="cal">{Math.round(item.calories)} קק״ל</span>
              <div className="macros">
                <span className="protein">ח: {item.protein_g?.toFixed(1)}g</span>
                <span className="carbs">פ: {item.carbs_g?.toFixed(1)}g</span>
                <span className="fat">ש: {item.fat_g?.toFixed(1)}g</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="result-totals">
        <span>{Math.round(totals.calories)} קק״ל</span>
        <span>ח: {totals.protein.toFixed(1)}g</span>
        <span>פ: {totals.carbs.toFixed(1)}g</span>
        <span>ש: {totals.fat.toFixed(1)}g</span>
      </div>

      <div className="result-actions">
        <button className="btn btn-primary" onClick={onConfirm}>
          <Check size={16} /> שמור ארוחה
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          <X size={16} /> בטל
        </button>
      </div>
    </div>
  );
}
