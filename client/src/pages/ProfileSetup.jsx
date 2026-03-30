import { useState } from 'react';
import { User, Activity, Target, ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';

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

const STEPS = [
  { key: 'personal', label: 'פרטים אישיים', icon: User },
  { key: 'activity', label: 'פעילות ומטרה', icon: Activity },
  { key: 'targets', label: 'יעדים יומיים', icon: Target },
];

function calcTargets(gender, weight, height, age, activityLevel, goal) {
  if (!weight || !height || !age || !gender) return null;
  // Mifflin-St Jeor
  let bmr = 10 * weight + 6.25 * height - 5 * age;
  bmr += gender === 'male' ? 5 : -161;
  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  let tdee = Math.round(bmr * (multipliers[activityLevel] || 1.55));
  if (goal === 'lose') tdee -= 400;
  else if (goal === 'gain') tdee += 300;
  const protein = Math.round(weight * 1.8);
  const fat = Math.round((tdee * 0.25) / 9);
  const carbs = Math.round((tdee - protein * 4 - fat * 9) / 4);
  return { daily_calories_target: tdee, daily_protein_target: protein, daily_carbs_target: carbs, daily_fat_target: fat };
}

export default function ProfileSetup() {
  const { markProfileCompleted } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    gender: '',
    birth_date: '',
    height_cm: '',
    weight_kg: '',
    activity_level: 'moderate',
    goal: 'maintain',
    daily_calories_target: 2000,
    daily_protein_target: 120,
    daily_carbs_target: 250,
    daily_fat_target: 65,
  });

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const getAge = () => {
    if (!form.birth_date) return null;
    const diff = Date.now() - new Date(form.birth_date).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  const handleAutoCalc = () => {
    const age = getAge();
    const targets = calcTargets(form.gender, Number(form.weight_kg), Number(form.height_cm), age, form.activity_level, form.goal);
    if (targets) setForm(prev => ({ ...prev, ...targets }));
  };

  const canProceed = () => {
    if (step === 0) return form.gender && form.birth_date && form.height_cm && form.weight_kg;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { error: dbError } = await supabase
        .from('user_profiles')
        .upsert({ user_id: authUser.id, ...form, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (dbError) throw dbError;
      markProfileCompleted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (step === 1) handleAutoCalc();
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  return (
    <div className="setup-page" dir="rtl">
      <div className="setup-card">
        <div className="setup-header">
          <img src="/logo-icon.png" alt="" className="login-logo-icon" />
          <h1>ברוכים הבאים ל-TrackFit!</h1>
          <p>בואו נגדיר את הפרופיל שלכם כדי להתחיל</p>
        </div>

        {/* Step indicators */}
        <div className="setup-steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className={`setup-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                <div className="step-dot"><Icon size={14} /></div>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Personal Info */}
        {step === 0 && (
          <div className="setup-step-content">
            <div className="form-field">
              <label>מין</label>
              <select value={form.gender} onChange={e => updateField('gender', e.target.value)}>
                <option value="">בחר...</option>
                <option value="male">זכר</option>
                <option value="female">נקבה</option>
                <option value="other">אחר</option>
              </select>
            </div>
            <div className="form-field">
              <label>תאריך לידה</label>
              <input type="date" value={form.birth_date} onChange={e => updateField('birth_date', e.target.value)} dir="ltr" />
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>גובה (ס״מ)</label>
                <input type="number" value={form.height_cm} onChange={e => updateField('height_cm', e.target.value)} placeholder="170" dir="ltr" />
              </div>
              <div className="form-field">
                <label>משקל (ק״ג)</label>
                <input type="number" value={form.weight_kg} onChange={e => updateField('weight_kg', e.target.value)} placeholder="70" dir="ltr" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Activity & Goal */}
        {step === 1 && (
          <div className="setup-step-content">
            <div className="form-field">
              <label>רמת פעילות</label>
              <select value={form.activity_level} onChange={e => updateField('activity_level', e.target.value)}>
                {Object.entries(ACTIVITY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>מטרה</label>
              <div className="goal-selector">
                {Object.entries(GOAL_LABELS).map(([val, { label, icon: Icon }]) => (
                  <button
                    key={val}
                    type="button"
                    className={`goal-btn ${form.goal === val ? 'active' : ''}`}
                    onClick={() => updateField('goal', val)}
                  >
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Daily Targets */}
        {step === 2 && (
          <div className="setup-step-content">
            <p className="setup-hint">היעדים חושבו אוטומטית לפי הנתונים שלך. ניתן לשנות ידנית.</p>
            <div className="form-grid">
              <div className="form-field">
                <label>קלוריות יומיות</label>
                <input type="number" value={form.daily_calories_target} onChange={e => updateField('daily_calories_target', e.target.value)} dir="ltr" />
              </div>
              <div className="form-field">
                <label>חלבון (g)</label>
                <input type="number" value={form.daily_protein_target} onChange={e => updateField('daily_protein_target', e.target.value)} dir="ltr" />
              </div>
              <div className="form-field">
                <label>פחמימות (g)</label>
                <input type="number" value={form.daily_carbs_target} onChange={e => updateField('daily_carbs_target', e.target.value)} dir="ltr" />
              </div>
              <div className="form-field">
                <label>שומן (g)</label>
                <input type="number" value={form.daily_fat_target} onChange={e => updateField('daily_fat_target', e.target.value)} dir="ltr" />
              </div>
            </div>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        {/* Navigation buttons */}
        <div className="setup-nav">
          {step > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>
              <ChevronRight size={16} /> הקודם
            </button>
          )}
          <div className="setup-nav-spacer" />
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={goNext} disabled={!canProceed()}>
              הבא <ChevronLeft size={16} />
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleFinish} disabled={saving}>
              {saving ? 'שומר...' : 'סיום והתחלה! 🚀'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
