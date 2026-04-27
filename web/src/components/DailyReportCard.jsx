import { FileText } from 'lucide-react';
import { fmtTime, LEVEL_LABEL } from '../lib/format';

export default function DailyReportCard({ daily }) {
  if (!daily) return null;
  const eda = daily.daytime_eda || [];
  const stai = daily.evening_stai;
  const matched = daily.matched_with_morning_alert;

  return (
    <section className="bg-white rounded-2xl ring-1 ring-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
        <FileText className="w-4 h-4 text-slate-500" /> 일별 리포트
      </div>

      <p className="text-sm text-slate-700 leading-relaxed">{daily.summary}</p>

      {eda.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">낮 EDA 측정 ({eda.length}회)</div>
          {eda.map((e, i) => (
            <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-slate-50 ring-1 ring-slate-100">
              <span className="text-slate-600 tabular-nums">
                {fmtTime(e.recorded_at)} · EDA <strong className="text-slate-900">{e.eda_value.toFixed(2)}</strong> · z=<span className="tabular-nums">{(e.eda_z ?? 0).toFixed(2)}</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium tag-${e.classification}`}>
                {e.classification}
              </span>
            </div>
          ))}
        </div>
      )}

      {stai && (
        <div className="mt-4 px-3 py-2.5 rounded-lg bg-slate-50 ring-1 ring-slate-100 text-xs">
          <span className="text-slate-500">저녁 STAI-S:</span>{' '}
          <strong className="text-slate-900">{stai.score}/5</strong>
          {stai.note && <span className="text-slate-500 ml-2">— {stai.note}</span>}
        </div>
      )}

      {matched !== null && (
        <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${matched ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {matched ? '✓ 아침 경보와 실제 상태가 대체로 일치' : '⚠ 아침 경보와 실제 상태에 차이가 있었음'}
        </div>
      )}
    </section>
  );
}
