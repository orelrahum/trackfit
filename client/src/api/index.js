const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('trackfit_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
    ...options,
  });
  if (res.status === 401) {
    localStorage.removeItem('trackfit_token');
    localStorage.removeItem('trackfit_user');
    window.dispatchEvent(new Event('auth-expired'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Auth
export const register = (email, password, name) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) });

export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const getMe = () => request('/auth/me');

// Profile
export const getProfile = () => request('/profile');
export const updateProfile = (data) => request('/profile', { method: 'PUT', body: JSON.stringify(data) });
export const logWeight = (data) => request('/profile/weight', { method: 'POST', body: JSON.stringify(data) });
export const getWeightHistory = (params = '') => request(`/profile/weight?${params}`);

// Meals
export const getMeals = (date) => request(`/meals?date=${date}`);
export const getMealSummary = (date) => request(`/meals/summary?date=${date}`);
export const addMeal = (data) => request('/meals', { method: 'POST', body: JSON.stringify(data) });
export const deleteMeal = (id) => request(`/meals/${id}`, { method: 'DELETE' });
export const deleteMealItem = (id) => request(`/meals/item/${id}`, { method: 'DELETE' });

// Analyze
export async function analyzeFood(text, file) {
  const formData = new FormData();
  if (text) formData.append('text', text);
  if (file) formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Analysis failed');
  }
  return res.json();
}

export const getAIStatus = () => request('/analyze/status');

// Products
export const searchProducts = (q) => request(`/products/search?q=${encodeURIComponent(q)}`);

// Settings
export const getSetting = (key) => request(`/settings/${key}`);
export const saveSetting = (key, value) => request('/settings', { method: 'POST', body: JSON.stringify({ key, value }) });
