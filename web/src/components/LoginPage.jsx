import { useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';

const TABS = {
  LOGIN: 'login',
  REGISTER: 'register',
};

export default function LoginPage({ onLogin, onRegister }) {
  const [tab, setTab] = useState(TABS.LOGIN);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mb-3 shadow-lg shadow-blue-200">
            <Activity className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">스마트 헬스케어</h1>
          <p className="text-sm text-slate-500 mt-1">다음날 스트레스 취약도 조기 경보</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <TabBtn active={tab === TABS.LOGIN} onClick={() => setTab(TABS.LOGIN)}>로그인</TabBtn>
            <TabBtn active={tab === TABS.REGISTER} onClick={() => setTab(TABS.REGISTER)}>회원가입</TabBtn>
          </div>

          <div className="p-6">
            {tab === TABS.LOGIN
              ? <LoginForm onLogin={onLogin} />
              : <RegisterForm onRegister={onRegister} onAfterRegister={() => setTab(TABS.LOGIN)} />}
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          데모 계정: <code className="font-mono">user_001</code> / <code className="font-mono">user_002</code> (비밀번호는 팀 내부 공유)
        </p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`py-3 text-sm font-medium transition ${
        active ? 'bg-white text-blue-600 border-b-2 border-blue-600 -mb-px' : 'bg-slate-50 text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function LoginForm({ onLogin }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try { await onLogin(userId, password); }
    catch (e) { setErr(e.message || '로그인 실패'); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="아이디" value={userId} onChange={setUserId} placeholder="user_001" autoFocus />
      <Field label="비밀번호" type="password" value={password} onChange={setPassword} />
      {err && <p className="text-xs text-red-600 -mt-1">{err}</p>}
      <SubmitBtn loading={loading}>로그인</SubmitBtn>
    </form>
  );
}

function RegisterForm({ onRegister }) {
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  function clientValidate() {
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(userId))
      return '아이디는 영문/숫자/_ 3~32자';
    if (password.length < 8) return '비밀번호는 최소 8자';
    if (password !== pwConfirm) return '비밀번호 확인이 일치하지 않습니다';
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const v = clientValidate();
    if (v) { setErr(v); return; }
    setLoading(true);
    try {
      await onRegister({
        user_id: userId,
        password,
        display_name: displayName || undefined,
      });
      // 성공 시 App이 자동 로그인 상태로 전환 — 별도 처리 불필요
    } catch (e) {
      setErr(e.message || '회원가입 실패');
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="아이디" value={userId} onChange={setUserId} placeholder="영문/숫자/_ 3~32자" autoFocus />
      <Field label="이름 (선택)" value={displayName} onChange={setDisplayName} placeholder="대시보드 헤더에 표시됨" />
      <Field label="비밀번호" type="password" value={password} onChange={setPassword} placeholder="최소 8자" />
      <Field label="비밀번호 확인" type="password" value={pwConfirm} onChange={setPwConfirm} />
      {err && <p className="text-xs text-red-600 -mt-1">{err}</p>}
      <SubmitBtn loading={loading}>가입하고 시작하기</SubmitBtn>
      <p className="text-xs text-slate-400 leading-relaxed">
        가입 후 자동으로 로그인됩니다. Fitbit 계정 연결은 대시보드에서 진행할 수 있습니다.
      </p>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, autoFocus }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700 mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={!label.includes('선택')}
        className="w-full px-3 py-2.5 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
      />
    </div>
  );
}

function SubmitBtn({ loading, children }) {
  return (
    <button
      type="submit" disabled={loading}
      className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
