import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { login, register } from '../api';
import { useAuth } from '../components/AuthContext';

export default function Login() {
  const { loginSuccess } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let result;
      if (isRegister) {
        if (!name.trim()) {
          setError('נא להזין שם');
          setLoading(false);
          return;
        }
        result = await register(email, password, name);
      } else {
        result = await login(email, password);
      }
      loginSuccess(result.token, result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo-icon.png" alt="" className="login-logo-icon" />
          <h1>TrackFit</h1>
          <p>מעקב תזונה חכם מבוסס בינה מלאכותית</p>
        </div>

        <div className="login-tabs">
          <button
            className={`tab ${!isRegister ? 'active' : ''}`}
            onClick={() => { setIsRegister(false); setError(null); }}
          >
            <LogIn size={16} /> התחברות
          </button>
          <button
            className={`tab ${isRegister ? 'active' : ''}`}
            onClick={() => { setIsRegister(true); setError(null); }}
          >
            <UserPlus size={16} /> הרשמה
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-field">
              <label>שם</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="השם שלך"
                required={isRegister}
              />
            </div>
          )}
          <div className="form-field">
            <label>אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              dir="ltr"
              required
            />
          </div>
          <div className="form-field">
            <label>סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? 'לפחות 6 תווים' : 'הסיסמה שלך'}
              dir="ltr"
              required
              minLength={isRegister ? 6 : undefined}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'רגע...' : isRegister ? 'צור חשבון' : 'התחבר'}
          </button>
        </form>
      </div>
    </div>
  );
}
