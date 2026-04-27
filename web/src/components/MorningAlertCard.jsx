import { Sun, RefreshCw, Hand, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { LEVEL_LABEL, fmtDateTime } from '../lib/format';

export default function MorningAlertCard({ alert, onRecompute, onStartEda }) {
  const [recomputing, setRecomputing] = useState(false);
  if (!alert) return <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5"><div className="text-sm text-slate-400">불러오는 중…</div></div>;

  const lvl = alert.level || 'NORMAL';
  const meta = LEVEL_LABEL[lvl] || LEVEL_LABEL.NORMAL;
  const noData = !alert.assessed_at;

  return (
    <section className={`bg-white rounded-2xl ring-1 ring-slate-200 p-6 shadow-sm relative overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${meta.dot}`}></div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Sun className="w-4 h-4 text-slate-500" /> 아침 조기 경보
        </div>
        <span className="text-xs text-slate-400">{alert.assessed_at ? fmtDateTime(alert.assessed_at) : '평가 없음'}</span>
      </div>

      {noData ? (
        <div className="text-sm text-slate-500 py-2">
          {alert.message || '아직 야간 데이터가 충분하지 않습니다.'}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mt-1 mb-3">
            <span className={`w-3 h-3 rounded-full ${meta.dot}`}></span>
            <span className="text-3xl font-bold text-slate-900">{meta.label}</span>
            <span className="text-xs uppercase tracking-wider text-slate-400 mt-2">{lvl}</span>
          </div>

          <div className="text-sm text-slate-700 leading-relaxed">{alert.reason}</div>

          {alert.action && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-slate-50 ring-1 ring-slate-100">
              <div className="text-xs font-medium text-slate-500 mb-1">행동 제안</div>
              <div className="text-sm text-slate-800">{alert.action}</div>
            </div>
          )}

          {alert.features && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Feat label="HRV z-score" value={alert.features.hrv_zscore?.toFixed(2)} />
              <Feat label="수면 효율" value={alert.features.sleep_efficiency != null ? `${(alert.features.sleep_efficiency * 100).toFixed(0)}%` : '-'} />
              <Feat label="RHR Δ" value={alert.features.rhr_delta != null ? `${alert.features.rhr_delta > 0 ? '+' : ''}${alert.features.rhr_delta.toFixed(1)}` : '-'} />
              <Feat label="수면 시간" value={alert.features.sleep_duration_min != null ? `${Math.floor(alert.features.sleep_duration_min/60)}h ${alert.features.sleep_duration_min%60}m` : '-'} />
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2 mt-5">
        <button
          onClick={async () => { setRecomputing(true); try { await onRecompute(); } finally { setRecomputing(false); } }}
          disabled={recomputing}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
        >
          {recomputing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          재계산
        </button>
        <button
          onClick={onStartEda}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          <Hand className="w-4 h-4" /> 지금 EDA 측정 시작
        </button>
      </div>
    </section>
  );
}

function Feat({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-slate-50 ring-1 ring-slate-100">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 tabular-nums">{value || '-'}</div>
    </div>
  );
}
