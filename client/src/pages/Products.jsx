import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Package, ChefHat, ShoppingBasket, X, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

const FUDER_PLACEHOLDER = 'https://www.fuder.co.il/wp-content/uploads/2023/10/Frame-1000000952.png';

function hasRealImage(product) {
  return product.photo_url && product.photo_url !== FUDER_PLACEHOLDER && product.photo_url.trim() !== '';
}

const SOURCE_LABELS = {
  fuder: { label: 'FUDER', className: 'source-fuder' },
  foodDictionary: { label: 'FOOD DICTIONARY', className: 'source-fooddict' },
};

const TYPE_LABELS = {
  food: { label: 'מוצר', className: 'type-food' },
  recipe: { label: 'מתכון', className: 'type-recipe' },
};

const FILTER_OPTIONS = [
  { key: 'food', label: '🛒 מוצרים', group: 'type' },
  { key: 'recipe', label: '👨‍🍳 מתכונים', group: 'type' },
  { key: 'fuder', label: '💜 Fuder', group: 'source' },
  { key: 'foodDictionary', label: '🟠 Food Dictionary', group: 'source' },
];

function ProductModal({ product, onClose }) {
  if (!product) return null;
  const sourceInfo = SOURCE_LABELS[product.source] || SOURCE_LABELS.fuder;
  const typeInfo = TYPE_LABELS[product.type] || TYPE_LABELS.food;
  const n = product.nutrients_per_100g;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={20} /></button>

        {/* Image */}
        <div className="modal-image">
          {hasRealImage(product) ? (
            <img src={product.photo_url} alt={product.name} onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="modal-image-placeholder">
              {product.type === 'recipe' ? <ChefHat size={48} /> : <ShoppingBasket size={48} />}
            </div>
          )}
        </div>

        {/* Header */}
        <div className="modal-header">
          <h2>{product.name}</h2>
          <div className="modal-tags">
            <span className={`source-tag ${sourceInfo.className}`}>{sourceInfo.label}</span>
            <span className={`source-tag ${typeInfo.className}`}>{typeInfo.label}</span>
          </div>
          {product.brand && <p className="modal-brand">{product.brand}</p>}
          {product.category?.length > 0 && (
            <div className="modal-categories">
              {product.category.filter(c => c !== 'foodDictionary' && c !== 'מתכונים').map((c, i) => (
                <span key={i} className="cat-tag">{c}</span>
              ))}
            </div>
          )}
        </div>

        {/* Nutrition table */}
        <div className="modal-section">
          <h3>ערכים תזונתיים ל-100 גרם</h3>
          <div className="nutrition-table">
            <div className="nt-row nt-cal">
              <span>קלוריות</span>
              <span>{n.calories} קק״ל</span>
            </div>
            <div className="nt-row">
              <span style={{ color: '#4CAF50' }}>חלבון</span>
              <span>{n.protein_g}g</span>
            </div>
            <div className="nt-row">
              <span style={{ color: '#FF9800' }}>פחמימות</span>
              <span>{n.carbs_g}g</span>
            </div>
            <div className="nt-row">
              <span style={{ color: '#F44336' }}>שומן</span>
              <span>{n.fat_g}g</span>
            </div>
          </div>
        </div>

        {/* Serving sizes */}
        {product.serving_sizes?.length > 0 && (
          <div className="modal-section">
            <h3>גדלי מנות</h3>
            <div className="serving-list">
              {product.serving_sizes.map((s, i) => {
                const factor = s.amount_g / 100;
                return (
                  <div key={i} className="serving-row">
                    <div className="serving-name">
                      <strong>{s.name}</strong>
                      <span className="serving-grams">{s.amount_g}g</span>
                    </div>
                    <div className="serving-macros">
                      <span className="scal">{Math.round(n.calories * factor)}</span>
                      <span className="sp">ח:{(n.protein_g * factor).toFixed(1)}</span>
                      <span className="sc">פ:{(n.carbs_g * factor).toFixed(1)}</span>
                      <span className="sf">ש:{(n.fat_g * factor).toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Link */}
        {product.url && (
          <a href={product.url} target="_blank" rel="noopener noreferrer" className="modal-link">
            <ExternalLink size={14} /> צפה במקור
          </a>
        )}
      </div>
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const loaderRef = useRef(null);
  const PAGE_SIZE = 50;

  const toggleFilter = (key) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getFilterParams = useCallback(() => {
    const sources = [];
    const types = [];
    for (const key of activeFilters) {
      const opt = FILTER_OPTIONS.find(f => f.key === key);
      if (opt?.group === 'source') sources.push(key);
      if (opt?.group === 'type') types.push(key);
    }
    return {
      ...(sources.length > 0 && { source: sources.join(',') }),
      ...(types.length > 0 && { type: types.join(',') }),
    };
  }, [activeFilters]);

  const loadProducts = useCallback(async (pageNum, query, filterParams) => {
    try {
      const types = filterParams.type ? filterParams.type.split(',') : ['food', 'recipe'];
      const sources = filterParams.source ? filterParams.source.split(',') : null;
      let allItems = [];

      if (types.includes('food')) {
        let q = supabase.from('foods').select('*, food_servings(name, amount_g)', { count: 'exact' });
        if (sources) q = q.in('source', sources);
        if (query) q = q.or(`name.ilike.%${query}%,brand.ilike.%${query}%`);
        q = q.order('name').range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
        const { data, count } = await q;
        allItems = allItems.concat((data || []).map(f => ({
          ...f, type: 'food',
          serving_sizes: f.food_servings || [],
          nutrients_per_100g: { calories: f.calories_per_100g, protein_g: f.protein_per_100g, carbs_g: f.carbs_per_100g, fat_g: f.fat_per_100g }
        })));
        if (!types.includes('recipe')) setTotalCount(count || 0);
      }

      if (types.includes('recipe')) {
        let q = supabase.from('recipes').select('*', { count: 'exact' });
        if (sources) q = q.in('source', sources);
        if (query) q = q.or(`name.ilike.%${query}%,author.ilike.%${query}%`);
        q = q.order('name').range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
        const { data, count } = await q;
        allItems = allItems.concat((data || []).map(r => ({
          ...r, type: 'recipe', brand: r.author,
          serving_sizes: [{ name: 'מנה', amount_g: r.serving_weight_g || 300 }],
          nutrients_per_100g: { calories: r.calories_per_100g, protein_g: r.protein_per_100g, carbs_g: r.carbs_per_100g, fat_g: r.fat_per_100g }
        })));
        if (!types.includes('food')) setTotalCount(count || 0);
        if (types.includes('food')) setTotalCount(prev => pageNum === 0 ? (prev + (count || 0)) : prev);
      }

      allItems.sort((a, b) => a.name.localeCompare(b.name, 'he'));

      if (pageNum === 0) {
        setProducts(allItems);
      } else {
        setProducts(prev => [...prev, ...allItems]);
      }
      setHasMore(allItems.length >= PAGE_SIZE);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, []);

  const filterParams = getFilterParams();
  const filterKey = JSON.stringify(filterParams);

  useEffect(() => {
    setPage(0);
    setProducts([]);
    setLoading(true);
    loadProducts(0, search, filterParams);
  }, [search, filterKey, loadProducts]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadProducts(nextPage, search, filterParams);
        }
      },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, search, filterKey, loadProducts]);

  return (
    <div className="products-page">
      <h2><Package size={20} /> מאגר מוצרים</h2>
      <p className="products-count">{totalCount.toLocaleString()} מוצרים</p>
      
      {/* Multi-select Filter Chips */}
      <div className="filter-tabs">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f.key}
            className={`filter-chip ${activeFilters.has(f.key) ? 'active' : ''}`}
            onClick={() => toggleFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        {activeFilters.size > 0 && (
          <button className="filter-chip filter-clear" onClick={() => setActiveFilters(new Set())}>
            ✕ נקה
          </button>
        )}
      </div>

      <div className="products-search">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חפש מוצר..."
        />
      </div>

      <div className="products-grid">
        {products.map((product) => {
          const sourceInfo = SOURCE_LABELS[product.source] || SOURCE_LABELS.fuder;
          const typeInfo = TYPE_LABELS[product.type] || TYPE_LABELS.food;
          return (
            <div key={product.id} className="product-card" onClick={() => setSelectedProduct(product)}>
              <div className="product-image">
                {hasRealImage(product) ? (
                  <img 
                    src={product.photo_url} 
                    alt={product.name}
                    loading="lazy"
                    onError={(e) => { 
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="product-image-placeholder" style={hasRealImage(product) ? { display: 'none' } : {}}>
                  {product.type === 'recipe' ? <ChefHat size={24} /> : <ShoppingBasket size={24} />}
                </div>
              </div>
              <div className="product-info">
                <div className="product-name-row">
                  <span className="product-name">{product.name}</span>
                  <span className={`source-tag ${sourceInfo.className}`}>{sourceInfo.label}</span>
                  <span className={`source-tag ${typeInfo.className}`}>{typeInfo.label}</span>
                </div>
                {product.brand && <div className="product-brand">{product.brand}</div>}
                <div className="product-nutrients">
                  <span className="product-cal">{product.nutrients_per_100g.calories} קק״ל</span>
                  <span className="product-macro protein">ח: {product.nutrients_per_100g.protein_g}g</span>
                  <span className="product-macro carbs">פ: {product.nutrients_per_100g.carbs_g}g</span>
                  <span className="product-macro fat">ש: {product.nutrients_per_100g.fat_g}g</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {loading && <div className="products-loading">טוען מוצרים...</div>}
      <div ref={loaderRef} style={{ height: 20 }} />
      {!hasMore && products.length > 0 && (
        <div className="products-end">הגעת לסוף הרשימה 🎉</div>
      )}

      {/* Product Detail Modal */}
      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </div>
  );
}
