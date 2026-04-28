import { useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';

export default function LoginPage({ onLogin }) {
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mb-3 shadow-lg shadow-blue-200">
            <Activity className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">스마트 헬스케어</h1>
          <p className="text-sm text-slate-500 mt-1">다음날 스트레스 취약도 조기 경보</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">사용자 ID</label>
            <input
              value={userId} onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">비밀번호</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>
          {err && <p className="text-xs text-red-600 -mt-1">{err}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            로그인
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-4">
          데모 계정 ID: <code className="font-mono">user_001</code> / <code className="font-mono">user_002</code>
          <br />비밀번호는 팀 내부 채널을 통해 공유됩니다
        </p>
      </div>
    </div>
  );
}
