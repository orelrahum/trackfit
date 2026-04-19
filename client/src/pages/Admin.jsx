import { useState, useEffect, useCallback } from 'react';
import { Users, Package, Search, Trash2, Save, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

const API_BASE = '/api';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } : {};
}

async function adminFetch(url, options = {}) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${url}`, { headers, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ─── Users Tab ───
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/admin/users')
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin-loading">טוען משתמשים...</div>;

  return (
    <div className="admin-section">
      <h3><Users size={18} /> משתמשים רשומים ({users.length})</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>שם</th>
              <th>אימייל</th>
              <th>הצטרפות</th>
              <th>כניסה אחרונה</th>
              <th>פרופיל</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="user-name">{u.name || '—'}</td>
                <td className="user-email">{u.email}</td>
                <td>{new Date(u.created_at).toLocaleDateString('he-IL')}</td>
                <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('he-IL') : '—'}</td>
                <td>
                  {u.profile ? (
                    <span className="badge badge-green">הושלם</span>
                  ) : (
                    <span className="badge badge-orange">חסר</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Products Tab ───
function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [toast, setToast] = useState('');
  const PAGE_SIZE = 50;

  const loadProducts = useCallback(async (p, q) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
      if (q) params.set('q', q);
      const data = await adminFetch(`/admin/products?${params}`);
      setProducts(data.products);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts(page, search);
  }, [page, search, loadProducts]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setEditData({
      name: product.name,
      brand: product.brand || '',
      calories_per_100g: product.calories_per_100g,
      protein_per_100g: product.protein_per_100g,
      carbs_per_100g: product.carbs_per_100g,
      fat_per_100g: product.fat_per_100g,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    try {
      await adminFetch(`/admin/products/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(editData),
      });
      showToast('✅ המוצר עודכן');
      cancelEdit();
      loadProducts(page, search);
    } catch (e) {
      showToast('❌ ' + e.message);
    }
  };

  const deleteProduct = async (id, name) => {
    if (!window.confirm(`למחוק את "${name}"?`)) return;
    try {
      await adminFetch(`/admin/products/${id}`, { method: 'DELETE' });
      showToast('🗑️ המוצר נמחק');
      loadProducts(page, search);
    } catch (e) {
      showToast('❌ ' + e.message);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="admin-section">
      <h3><Package size={18} /> ניהול מוצרים ({total})</h3>

      <div className="admin-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="חפש מוצר..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      {toast && <div className="admin-toast">{toast}</div>}

      {loading ? (
        <div className="admin-loading">טוען מוצרים...</div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>שם</th>
                  <th>מותג</th>
                  <th>קלוריות</th>
                  <th>חלבון</th>
                  <th>פחמימות</th>
                  <th>שומן</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td className="cell-id">{p.id}</td>
                    {editingId === p.id ? (
                      <>
                        <td><input className="edit-input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} /></td>
                        <td><input className="edit-input" value={editData.brand} onChange={e => setEditData({ ...editData, brand: e.target.value })} /></td>
                        <td><input className="edit-input edit-num" type="number" value={editData.calories_per_100g} onChange={e => setEditData({ ...editData, calories_per_100g: +e.target.value })} /></td>
                        <td><input className="edit-input edit-num" type="number" value={editData.protein_per_100g} onChange={e => setEditData({ ...editData, protein_per_100g: +e.target.value })} /></td>
                        <td><input className="edit-input edit-num" type="number" value={editData.carbs_per_100g} onChange={e => setEditData({ ...editData, carbs_per_100g: +e.target.value })} /></td>
                        <td><input className="edit-input edit-num" type="number" value={editData.fat_per_100g} onChange={e => setEditData({ ...editData, fat_per_100g: +e.target.value })} /></td>
                        <td className="cell-actions">
                          <button className="btn-icon btn-save" onClick={saveEdit} title="שמור"><Save size={15} /></button>
                          <button className="btn-icon btn-cancel" onClick={cancelEdit} title="ביטול"><X size={15} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{p.name}</td>
                        <td>{p.brand || '—'}</td>
                        <td>{p.calories_per_100g}</td>
                        <td>{p.protein_per_100g}</td>
                        <td>{p.carbs_per_100g}</td>
                        <td>{p.fat_per_100g}</td>
                        <td className="cell-actions">
                          <button className="btn-icon btn-edit" onClick={() => startEdit(p)} title="ערוך">✏️</button>
                          <button className="btn-icon btn-delete" onClick={() => deleteProduct(p.id, p.name)} title="מחק"><Trash2 size={15} /></button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="admin-pagination">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronRight size={16} /></button>
              <span>עמוד {page + 1} מתוך {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronLeft size={16} /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Admin Page ───
export default function Admin() {
  const [tab, setTab] = useState('users');

  return (
    <div className="admin-page">
      <h2>🛡️ לוח ניהול</h2>

      <div className="admin-tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
          <Users size={16} /> משתמשים
        </button>
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
          <Package size={16} /> מוצרים
        </button>
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'products' && <ProductsTab />}
    </div>
  );
}
