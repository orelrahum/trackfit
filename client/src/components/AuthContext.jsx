import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('trackfit_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('trackfit_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const { user: userData } = await getMe();
      setUser(userData);
      localStorage.setItem('trackfit_user', JSON.stringify(userData));
    } catch {
      localStorage.removeItem('trackfit_token');
      localStorage.removeItem('trackfit_user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth-expired', handleExpired);
    return () => window.removeEventListener('auth-expired', handleExpired);
  }, [checkAuth]);

  const loginSuccess = (token, userData) => {
    localStorage.setItem('trackfit_token', token);
    localStorage.setItem('trackfit_user', JSON.stringify(userData));
    setUser(userData);
  };

  const markProfileCompleted = () => {
    setUser(prev => {
      const updated = { ...prev, profile_completed: true };
      localStorage.setItem('trackfit_user', JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    localStorage.removeItem('trackfit_token');
    localStorage.removeItem('trackfit_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginSuccess, logout, markProfileCompleted }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
