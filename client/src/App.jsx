import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Home as HomeIcon, Settings as SettingsIcon, Package, LogOut, Shield } from 'lucide-react';
import { AuthProvider, useAuth } from './components/AuthContext';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Products from './pages/Products';
import Admin from './pages/Admin';
import ProfileSetup from './pages/ProfileSetup';
import Login from './pages/Login';
import './App.css';

const ADMIN_EMAIL = 'orelr180@gmail.com';

function AppContent() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="app" dir="rtl">
        <div className="loading-screen">
          <h1 className="app-logo">
            <img src="/logo-icon.png" alt="" className="logo-icon logo-icon-lg" />
            <span>TrackFit</span>
          </h1>
          <p>טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!user.profile_completed) {
    return <ProfileSetup />;
  }

  return (
    <div className="app" dir="rtl">
      <header className="app-header">
        <h1 className="app-logo">
          <img src="/logo-icon.png" alt="" className="logo-icon" />
          <span>TrackFit</span>
        </h1>
        <nav className="app-nav">
          <NavLink to="/" end>
            <HomeIcon size={18} />
            <span>ראשי</span>
          </NavLink>
          <NavLink to="/products">
            <Package size={18} />
            <span>מוצרים</span>
          </NavLink>
          <NavLink to="/settings">
            <SettingsIcon size={18} />
            <span>הגדרות</span>
          </NavLink>
          {user.email === ADMIN_EMAIL && (
            <NavLink to="/admin">
              <Shield size={18} />
              <span>ניהול</span>
            </NavLink>
          )}
          <button className="nav-logout" onClick={logout} title="התנתק">
            <LogOut size={18} />
          </button>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/settings" element={<Settings />} />
          {user.email === ADMIN_EMAIL && (
            <Route path="/admin" element={<Admin />} />
          )}
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
