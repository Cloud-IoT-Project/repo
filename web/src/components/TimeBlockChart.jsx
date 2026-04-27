import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, ReferenceLine, Tooltip } from 'recharts';

export default function TimeBlockChart({ timeblock }) {
  if (!timeblock) return null;
  const data = timeblock.blocks.map((b) => ({
    label: b.label,
    z: b.eda_mean_z,
    checks: b.manual_checks,
  }));

  const wk = timeblock.weekly_pattern || [];

  function barColor(z) {
    if (z === null || z === undefined) return '#cbd5e1';
    if (z >= 1.0) return '#dc2626';
    if (z >= 0.3) return '#ea580c';
    if (z >= -0.3) return '#10b981';
    return '#16a34a';
  }

  return (
    <section className="bg-white rounded-2xl ring-1 ring-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
        <BarChart3 className="w-4 h-4 text-slate-500" /> 시간대별 패턴
      </div>
      <p className="text-xs text-slate-500 mb-3">EDA z-score 평균 (낮을수록 안정, 높을수록 스트레스)</p>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              height={36}
              tick={({ x, y, payload, index }) => {
                const block = data[index];
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text textAnchor="middle" fill="#64748b" fontSize="12" dy="14">{payload.value}</text>
                    {block?.checks > 0 && (
                      <text textAnchor="middle" fill="#3b82f6" fontSize="10" dy="28">측정 {block.checks}회</text>
                    )}
                  </g>
                );
              }}
            />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[-2, 2]} />
            <ReferenceLine y={0} stroke="#e2e8f0" />
            <ReferenceLine y={1.0} stroke="#fecaca" strokeDasharray="3 3" label={{ value: '높음', fontSize: 10, fill: '#dc2626', position: 'right' }} />
            <Tooltip
              cursor={{ fill: 'rgba(241,245,249,0.6)' }}
              contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
              formatter={(v, n, p) => v === null ? ['데이터 없음', ''] : [`z=${v.toFixed(2)}`, `측정 ${p.payload.checks}회`]}
            />
            <Bar dataKey="z" radius={[6, 6, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={barColor(d.z)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {wk.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">최근 7일 위험 시간대</div>
          <div className="flex flex-wrap gap-1.5">
            {wk.map((p, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-slate-50 ring-1 ring-slate-200 text-slate-600">
                {p.time_block} <span className="text-slate-400">·</span> z=<span className="tabular-nums">{(p.avg_z || 0).toFixed(2)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
