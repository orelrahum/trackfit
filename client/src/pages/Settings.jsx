import { useState, useEffect } from 'react';
import { Save, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { getSetting, saveSetting, getAIStatus } from '../api';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [currentKey, setCurrentKey] = useState(null);
  const [aiStatus, setAiStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [keyData, statusData] = await Promise.all([
        getSetting('gemini_api_key'),
        getAIStatus()
      ]);
      setCurrentKey(keyData);
      setAiStatus(statusData.ready);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const result = await saveSetting('gemini_api_key', apiKey.trim());
      setMessage({ type: 'success', text: result.message });
      setApiKey('');
      loadSettings();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <h2>⚙️ הגדרות</h2>

      <div className="settings-card">
        <h3><Key size={18} /> מפתח API של Gemini</h3>
        <p className="settings-desc">
          כדי להשתמש בזיהוי מזון חכם, צריך מפתח API של Google Gemini.
          <br />
          ניתן להשיג מפתח בחינם ב-
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            Google AI Studio
          </a>
        </p>

        <div className="ai-status">
          {aiStatus ? (
            <span className="status-ok"><CheckCircle size={16} /> AI מחובר ופעיל</span>
          ) : (
            <span className="status-err"><AlertCircle size={16} /> AI לא מוגדר</span>
          )}
        </div>

        {currentKey?.configured && (
          <div className="current-key">
            מפתח נוכחי: <code>{currentKey.value}</code>
          </div>
        )}

        <div className="key-input-row">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="הכנס מפתח API חדש..."
            dir="ltr"
          />
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
          >
            <Save size={16} /> {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>

        {message && (
          <div className={`settings-message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="settings-card">
        <h3>ℹ️ אודות</h3>
        <p>
          <strong>Trackfit</strong> — מעקב תזונה חכם מבוסס בינה מלאכותית.
          <br />
          האפליקציה משתמשת במאגר של 5,300+ מוצרים ישראליים מ-Fuder
          כדי לזהות ולתעד במדויק מה אכלת.
        </p>
        <p>
          ניתן להזין מזון בטקסט, תמונה, או הקלטה קולית.
          הבינה המלאכותית תזהה את המוצרים ותחשב את הערכים התזונתיים.
        </p>
      </div>
    </div>
  );
}
