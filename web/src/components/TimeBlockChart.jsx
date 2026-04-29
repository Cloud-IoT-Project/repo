import { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, ReferenceLine, Tooltip } from 'recharts';
import { api } from '../lib/api';
import { todayKST, addDays, isToday, fmtKoreanShortDate } from '../lib/format';

const BLOCK_DEF = [
  { name: '06:00-12:00', label: '오전',     start: 6,  end: 12 },
  { name: '12:00-18:00', label: '점심 이후', start: 12, end: 18 },
  { name: '18:00-24:00', label: '저녁',     start: 18, end: 24 },
];

function kstHour(iso) {
  const utcMs = new Date(iso).getTime();
  return new Date(utcMs + 9 * 3600 * 1000).getUTCHours();
}

function blockOfHour(h) {
  return BLOCK_DEF.find((b) => h >= b.start && h < b.end);
}

function barColor(z) {
  if (z === null || z === undefined) return '#cbd5e1';
  if (z >= 1.0) return '#dc2626';
  if (z >= 0.3) return '#ea580c';
  if (z >= -0.3) return '#10b981';
  return '#16a34a';
}

export default function TimeBlockChart({ refreshVersion = 0 }) {
  const [date, setDate] = useState(todayKST());
  const [tb, setTb] = useState(null);
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async (d) => {
    setLoading(true); setErr('');
    try {
      const [t, dr] = await Promise.all([
        api(`/reports/timeblock?date=${d}`),
        api(`/reports/daily?date=${d}`),
      ]);
      setTb(t); setDaily(dr);
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  }, []);

  // 날짜 변경 또는 부모 refresh trigger 시 재로딩
  useEffect(() => { load(date); }, [date, load, refreshVersion]);

  const goPrev = useCallback(() => setDate((d) => addDays(d, -1)), []);
  const goNext = useCallback(() => {
    setDate((d) => {
      const next = addDays(d, 1);
      // 미래는 막음 (오늘까지만)
      return next > todayKST() ? d : next;
    });
  }, []);

  // 키보드 화살표
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext]);

  // 터치 스와이프
  const swipeRef = useRef({ x: null });
  function onTouchStart(e) { swipeRef.current.x = e.touches[0].clientX; }
  function onTouchEnd(e) {
    const start = swipeRef.current.x;
    if (start === null) return;
    const dx = e.changedTouches[0].clientX - start;
    swipeRef.current.x = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) goNext(); else goPrev();
  }

  // 시간대별 daytime_eda를 그룹핑해서 μS 평균 계산
  const edas = daily?.daytime_eda || [];
  const blocks = BLOCK_DEF.map((b) => {
    const inBlock = edas.filter((e) => {
      const h = kstHour(e.recorded_at);
      return h >= b.start && h < b.end;
    });
    const eda_mean_z = inBlock.length
      ? inBlock.reduce((a, e) => a + (e.eda_z ?? 0), 0) / inBlock.length
      : null;
    const eda_mean_uS = inBlock.length
      ? inBlock.reduce((a, e) => a + e.eda_value, 0) / inBlock.length
      : null;
    return { ...b, count: inBlock.length, eda_mean_z, eda_mean_uS };
  });

  // 일평균
  const dayCount = edas.length;
  const dayMeanZ = dayCount ? edas.reduce((a, e) => a + (e.eda_z ?? 0), 0) / dayCount : null;
  const dayMeanUs = dayCount ? edas.reduce((a, e) => a + e.eda_value, 0) / dayCount : null;

  const wk = tb?.weekly_pattern || [];
  const todayBadge = isToday(date);
  const isFuture = addDays(date, 1) > todayKST() && date >= todayKST(); // 미래로 못 가게 next 비활성

  return (
    <section
      className="bg-white rounded-2xl ring-1 ring-slate-200 p-5 shadow-sm select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <BarChart3 className="w-4 h-4 text-slate-500" /> 시간대별 패턴
        </div>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
      </div>

      {/* 날짜 네비게이션 */}
      <div className="flex items-center justify-between gap-2 mb-3 bg-slate-50 rounded-lg p-1.5">
        <button
          onClick={goPrev}
          className="p-1.5 rounded-md hover:bg-white transition text-slate-600"
          title="이전 날짜 (←)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center flex-1">
          <div className="text-sm font-semibold text-slate-900 tabular-nums">{fmtKoreanShortDate(date)}</div>
          <div className="text-[10px] text-slate-500 tabular-nums">
            {date}
            {todayBadge && <span className="ml-1.5 px-1.5 py-px rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">오늘</span>}
          </div>
        </div>
        <button
          onClick={goNext}
          disabled={isFuture}
          className="p-1.5 rounded-md hover:bg-white transition text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="다음 날짜 (→)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 일 평균 요약 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="측정 횟수" value={`${dayCount}회`} />
        <Stat label="평균 EDA" value={dayMeanUs !== null ? `${dayMeanUs.toFixed(2)} μS` : '-'} />
        <Stat label="평균 z-score" value={dayMeanZ !== null ? dayMeanZ.toFixed(2) : '-'} highlight={dayMeanZ} />
      </div>

      {/* 막대 차트 */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={blocks.map((b) => ({ label: b.label, z: b.eda_mean_z, count: b.count }))}
                    margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              height={36}
              tick={({ x, y, payload, index }) => {
                const b = blocks[index];
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text textAnchor="middle" fill="#64748b" fontSize="12" dy="14">{payload.value}</text>
                    {b?.count > 0 && (
                      <text textAnchor="middle" fill="#3b82f6" fontSize="10" dy="28">측정 {b.count}회</text>
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
              formatter={(v, n, p) => v === null ? ['데이터 없음', ''] : [`z=${v.toFixed(2)}`, `측정 ${p.payload.count}회`]}
            />
            <Bar dataKey="z" radius={[6, 6, 0, 0]}>
              {blocks.map((b, i) => <Cell key={i} fill={barColor(b.eda_mean_z)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 시간대별 μS 평균 (텍스트) */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        {blocks.map((b) => (
          <div key={b.name} className="px-3 py-2 rounded-lg bg-slate-50 ring-1 ring-slate-100">
            <div className="text-[10px] font-medium text-slate-500">{b.label}</div>
            <div className="font-semibold text-slate-900 tabular-nums">
              {b.eda_mean_uS !== null ? `${b.eda_mean_uS.toFixed(2)} μS` : '-'}
            </div>
            <div className="text-[10px] text-slate-400 tabular-nums">
              {b.eda_mean_z !== null ? `z ${b.eda_mean_z.toFixed(2)}` : ''}
            </div>
          </div>
        ))}
      </div>

      {/* 주간 패턴 */}
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

      {err && <p className="text-xs text-red-600 mt-3">오류: {err}</p>}
    </section>
  );
}

function Stat({ label, value, highlight }) {
  let cls = 'text-slate-900';
  if (typeof highlight === 'number') {
    if (highlight >= 1.0) cls = 'text-red-600';
    else if (highlight >= 0.3) cls = 'text-orange-600';
  }
  return (
    <div className="px-3 py-2 rounded-lg bg-slate-50 ring-1 ring-slate-100 text-center">
      <div className="text-[10px] font-medium text-slate-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
