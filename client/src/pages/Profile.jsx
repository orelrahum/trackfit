import { useState, useEffect } from 'react';
import { Save, Target, Scale, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { getProfile, updateProfile, logWeight, getWeightHistory } from '../api';

const ACTIVITY_LABELS = {
  sedentary: 'יושבני (ללא פעילות)',
  light: 'קל (1-2 אימונים בשבוע)',
  moderate: 'בינוני (3-4 אימונים בשבוע)',
  active: 'פעיל (5-6 אימונים בשבוע)',
  very_active: 'מאוד פעיל (אימונים יומיים)'
};

const GOAL_LABELS = {
  lose: { label: 'ירידה במשקל', icon: TrendingDown },
  maintain: { label: 'שמירה על משקל', icon: Minus },
  gain: { label: 'עליה במשקל', icon: TrendingUp }
};

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [weightInput, setWeightInput] = useState('');
  const [weightHistory, setWeightHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileData, weightData] = await Promise.all([
        getProfile(),
        getWeightHistory('limit=10')
      ]);
      setProfile(profileData);
      setForm(profileData);
      setWeightHistory(weightData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile(form);
      setProfile(updated);
      setMessage({ type: 'success', text: 'הפרופיל נשמר ✅' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleLogWeight = async () => {
    if (!weightInput) return;
    try {
      await logWeight({ weight_kg: parseFloat(weightInput) });
      setWeightInput('');
      loadData();
      setMessage({ type: 'success', text: 'המשקל נשמר ✅' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (!profile) return <div className="loading">טוען...</div>;

  return (
    <div className="profile-page">
      <h2>👤 פרופיל</h2>

      {message && (
        <div className={`settings-message ${message.type}`}>{message.text}</div>
      )}

      {/* Personal Info */}
      <div className="settings-card">
        <h3>פרטים אישיים</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>שם</label>
            <input value={form.name || ''} onChange={e => updateField('name', e.target.value)} />
          </div>
          <div className="form-field">
            <label>גובה (ס״מ)</label>
            <input type="number" value={form.height_cm || ''} onChange={e => updateField('height_cm', e.target.value)} dir="ltr" />
          </div>
          <div className="form-field">
            <label>משקל (ק״ג)</label>
            <input type="number" value={form.weight_kg || ''} onChange={e => updateField('weight_kg', e.target.value)} dir="ltr" />
          </div>
          <div className="form-field">
            <label>תאריך לידה</label>
            <input type="date" value={form.birth_date || ''} onChange={e => updateField('birth_date', e.target.value)} dir="ltr" />
          </div>
          <div className="form-field">
            <label>מין</label>
            <select value={form.gender || ''} onChange={e => updateField('gender', e.target.value)}>
              <option value="">בחר...</option>
              <option value="male">זכר</option>
              <option value="female">נקבה</option>
              <option value="other">אחר</option>
            </select>
          </div>
          <div className="form-field">
            <label>רמת פעילות</label>
            <select value={form.activity_level || 'moderate'} onChange={e => updateField('activity_level', e.target.value)}>
              {Object.entries(ACTIVITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Goals */}
      <div className="settings-card">
        <h3><Target size={18} /> יעדים יומיים</h3>
        <div className="goal-selector">
          {Object.entries(GOAL_LABELS).map(([val, { label, icon: Icon }]) => (
            <button
              key={val}
              className={`goal-btn ${form.goal === val ? 'active' : ''}`}
              onClick={() => updateField('goal', val)}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label>קלוריות יומיות</label>
            <input type="number" value={form.daily_calories_target || ''} onChange={e => updateField('daily_calories_target', e.target.value)} dir="ltr" />
          </div>
          <div className="form-field">
            <label>חלבון (g)</label>
            <input type="number" value={form.daily_protein_target || ''} onChange={e => updateField('daily_protein_target', e.target.value)} dir="ltr" />
          </div>
          <div className="form-field">
            <label>פחמימות (g)</label>
            <input type="number" value={form.daily_carbs_target || ''} onChange={e => updateField('daily_carbs_target', e.target.value)} dir="ltr" />
          </div>
          <div className="form-field">
            <label>שומן (g)</label>
            <input type="number" value={form.daily_fat_target || ''} onChange={e => updateField('daily_fat_target', e.target.value)} dir="ltr" />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: '12px' }}>
          <Save size={16} /> {saving ? 'שומר...' : 'שמור פרופיל'}
        </button>
      </div>

      {/* Weight Log */}
      <div className="settings-card">
        <h3><Scale size={18} /> מעקב משקל</h3>
        <div className="weight-input-row">
          <input
            type="number"
            step="0.1"
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            placeholder="משקל נוכחי (ק״ג)"
            dir="ltr"
          />
          <button className="btn btn-primary" onClick={handleLogWeight}>שמור</button>
        </div>
        {weightHistory.length > 0 && (
          <div className="weight-history">
            {weightHistory.map(w => (
              <div key={w.id} className="weight-entry">
                <span className="weight-date">
                  {new Date(w.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                </span>
                <span className="weight-value">{w.weight_kg} ק״ג</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
