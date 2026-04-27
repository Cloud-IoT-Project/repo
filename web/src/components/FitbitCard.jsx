import { useState } from 'react';
import { Watch, Link2, Link2Off, Download, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

export default function FitbitCard({ fitbit, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  if (!fitbit) {
    return (
      <Card>
        <div className="text-sm text-slate-400">상태 확인 중…</div>
      </Card>
    );
  }

  if (!fitbit.configured) {
    return (
      <Card>
        <Header icon={Watch} title="Fitbit 연결" />
        <div className="text-sm text-slate-500 mt-2">
          서버에 Fitbit credentials가 설정되어 있지 않습니다. <code className="font-mono text-xs">.env</code>를 확인하세요.
        </div>
      </Card>
    );
  }

  async function connect() {
    const r = await api('/fitbit/authorize');
    window.open(r.url, 'fitbit-auth', 'width=520,height=720');
  }
  async function sync() {
    setBusy(true); setResult(null);
    try {
      const r = await api('/fitbit/sync', { method: 'POST' });
      setResult(r);
      onRefresh();
    } catch (e) {
      setResult({ error: e.message });
    } finally { setBusy(false); }
  }
  async function disconnect() {
    if (!confirm('Fitbit 연결을 해제하시겠습니까?')) return;
    await api('/fitbit/disconnect', { method: 'POST' });
    onRefresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Header icon={Watch} title="Fitbit 연결" />
        {fitbit.connected ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full ring-1 ring-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> 연결됨
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            미연결
          </span>
        )}
      </div>

      {fitbit.connected ? (
        <>
          <div className="text-xs text-slate-500 mt-2">
            Fitbit user <code className="font-mono">{fitbit.fitbit_user_id}</code>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={sync} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              오늘 데이터 가져오기
            </button>
            <button
              onClick={disconnect}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition"
            >
              <Link2Off className="w-4 h-4" /> 해제
            </button>
          </div>
          {result && (
            <div className="mt-3 text-xs">
              {result.error ? (
                <div className="text-red-600 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{result.error}</div>
              ) : (
                <div className="text-slate-600 space-y-1">
                  <div className="flex flex-wrap gap-2">
                    <Stat label="HRV" value={result.hrv_inserted} />
                    <Stat label="RHR" value={result.rhr_inserted} />
                    <Stat label="Sleep" value={result.sleep_inserted} />
                    <Stat label="EDA" value={result.eda_inserted} />
                  </div>
                  {result.errors?.length > 0 && (
                    <div className="text-amber-700 mt-2 text-xs">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      일부 오류: {result.errors.join(' / ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-sm text-slate-500 mt-2">
            Fitbit 계정을 연결하면 야간 HRV / 수면 / RHR / EDA 스캔 데이터를 자동으로 가져옵니다.
          </div>
          <button
            onClick={connect}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            <Link2 className="w-4 h-4" /> Fitbit 계정 연결
          </button>
        </>
      )}
    </Card>
  );
}

function Card({ children }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5 shadow-sm">{children}</div>
  );
}
function Header({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <Icon className="w-4 h-4 text-slate-500" /> {title}
    </div>
  );
}
function Stat({ label, value }) {
  return (
    <div className="px-2 py-1 rounded-md bg-slate-50 ring-1 ring-slate-200">
      <span className="text-slate-500">{label}</span>{' '}
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
