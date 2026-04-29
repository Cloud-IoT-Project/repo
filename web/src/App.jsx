import { useState, useEffect } from 'react';
import { getToken, getStoredUser, clearSession, setSession, login as apiLogin, register as apiRegister } from './lib/api';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [hasToken, setHasToken] = useState(!!getToken());

  async function handleLogin(user_id, password) {
    const r = await apiLogin(user_id, password);
    setSession(r.token, r.user);
    setUser(r.user);
    setHasToken(true);
  }
  async function handleRegister({ user_id, password, display_name }) {
    const r = await apiRegister({ user_id, password, display_name });
    setSession(r.token, r.user);
    setUser(r.user);
    setHasToken(true);
  }
  function handleLogout() {
    clearSession();
    setUser(null);
    setHasToken(false);
  }

  useEffect(() => {
    const onStorage = () => setHasToken(!!getToken());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!hasToken || !user) return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}
