import { useState, useEffect } from 'react';
import { signIn, signUp, signOut, getCurrentUserInfo } from './lib/cognito';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

export default function App() {
  // undefined = 세션 확인 중, null = 로그아웃 상태, object = 로그인됨
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    getCurrentUserInfo().then(setUser).catch(() => setUser(null));
  }, []);

  async function handleLogin(email, password) {
    const u = await signIn({ email, password });
    setUser(u);
  }

  async function handleRegister({ email, password, display_name }) {
    await signUp({ email, password, displayName: display_name });
    // Pre-SignUp 트리거가 자동 확인 → 곧바로 로그인
    const u = await signIn({ email, password });
    setUser(u);
  }

  function handleLogout() {
    signOut();
    setUser(null);
  }

  if (user === undefined) return null;  // 세션 복원 중 (깜빡임 방지)
  if (!user) return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}
