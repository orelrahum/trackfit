import { useState, useRef, useEffect } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { searchProducts } from '../api';

export default function FoodInput({ onAdd, onCancel }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amountG, setAmountG] = useState('');
  const [servingIdx, setServingIdx] = useState(-1);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchProducts(query.trim());
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const selectProduct = (product) => {
    setSelected(product);
    setResults([]);
    setQuery('');
    const defaultServing = product.serving_sizes?.[0];
    if (defaultServing) {
      setServingIdx(0);
      setAmountG(String(defaultServing.amount_g));
    } else {
      setServingIdx(-1);
      setAmountG('100');
    }
  };

  const handleServingChange = (idx) => {
    setServingIdx(idx);
    if (idx >= 0 && selected?.serving_sizes?.[idx]) {
      setAmountG(String(selected.serving_sizes[idx].amount_g));
    }
  };

  const calcNutrients = () => {
    if (!selected || !amountG) return null;
    const g = parseFloat(amountG);
    if (!g || g <= 0) return null;
    const n = selected.nutrients_per_100g;
    const factor = g / 100;
    return {
      calories: Math.round((n.calories || 0) * factor),
      protein_g: +((n.protein_g || 0) * factor).toFixed(1),
      carbs_g: +((n.carbs_g || 0) * factor).toFixed(1),
      fat_g: +((n.fat_g || 0) * factor).toFixed(1),
    };
  };

  const handleAdd = () => {
    if (!selected || !amountG) return;
    const nutrients = calcNutrients();
    if (!nutrients) return;
    const servingDesc = servingIdx >= 0 && selected.serving_sizes?.[servingIdx]
      ? selected.serving_sizes[servingIdx].name
      : '';
    onAdd?.({
      food_id: selected.type === 'food' ? selected.id : null,
      recipe_id: selected.type === 'recipe' ? selected.id : null,
      product_name: selected.name,
      brand: selected.brand || '',
      amount_g: parseFloat(amountG),
      serving_description: servingDesc,
      ...nutrients,
    });
  };

  const nutrients = calcNutrients();

  if (selected) {
    return (
      <div className="food-input-manual">
        <div className="selected-product">
          <div className="selected-header">
            {selected.photo_url && (
              <img src={selected.photo_url} alt="" className="selected-photo" />
            )}
            <div className="selected-info">
              <span className="selected-name">{selected.name}</span>
              {selected.brand && <span className="selected-brand">{selected.brand}</span>}
              {selected.category?.length > 0 && (
                <div className="selected-tags">
                  {selected.category.map((c, i) => (
                    <span key={i} className="tag">{c}</span>
                  ))}
                </div>
              )}
            </div>
            <button className="icon-btn small" onClick={() => setSelected(null)} title="שנה מוצר">
              <X size={16} />
            </button>
          </div>

          {selected.serving_sizes?.length > 0 && (
            <div className="serving-options">
              {selected.serving_sizes.map((s, i) => (
                <button
                  key={i}
                  className={`serving-btn ${servingIdx === i ? 'active' : ''}`}
                  onClick={() => handleServingChange(i)}
                >
                  {s.name} ({s.amount_g}g)
                </button>
              ))}
              <button
                className={`serving-btn ${servingIdx === -1 ? 'active' : ''}`}
                onClick={() => { setServingIdx(-1); setAmountG('100'); }}
              >
                מותאם
              </button>
            </div>
          )}

          <div className="amount-row">
            <label>כמות (גרם):</label>
            <input
              type="number"
              value={amountG}
              onChange={(e) => { setAmountG(e.target.value); setServingIdx(-1); }}
              min="1"
              dir="ltr"
            />
          </div>

          {nutrients && (
            <div className="nutrient-preview">
              <span>{nutrients.calories} קק״ל</span>
              <span className="protein">ח: {nutrients.protein_g}g</span>
              <span className="carbs">פ: {nutrients.carbs_g}g</span>
              <span className="fat">ש: {nutrients.fat_g}g</span>
            </div>
          )}

          <div className="add-actions">
            <button className="btn btn-primary" onClick={handleAdd} disabled={!nutrients}>
              <Plus size={16} /> הוסף
            </button>
            <button className="btn btn-secondary" onClick={onCancel}>
              ביטול
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="food-input-manual">
      <div className="search-box">
        <Search size={18} className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חפש מוצר... למשל: לחם, חלב, אורז..."
          dir="rtl"
        />
        <button className="icon-btn small" onClick={onCancel} title="ביטול">
          <X size={16} />
        </button>
      </div>

      {searching && <div className="search-status">מחפש...</div>}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((p) => (
            <div key={`${p.type}-${p.id}`} className="search-result-item" onClick={() => selectProduct(p)}>
              {p.photo_url ? (
                <img src={p.photo_url} alt="" className="result-photo" />
              ) : (
                <div className="result-photo-placeholder">
                  {p.type === 'recipe' ? '🍳' : '🥘'}
                </div>
              )}
              <div className="result-info">
                <span className="result-name">{p.name}</span>
                {p.brand && <span className="result-brand">{p.brand}</span>}
                {p.category?.length > 0 && (
                  <div className="result-tags">
                    {p.category.slice(0, 3).map((c, i) => (
                      <span key={i} className="tag tag-sm">{c}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="result-cal">
                {Math.round(p.nutrients_per_100g?.calories || 0)}
                <small> קק״ל</small>
              </div>
            </div>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <div className="search-status">לא נמצאו תוצאות</div>
      )}
    </div>
  );
}
