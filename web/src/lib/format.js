export const LEVEL_LABEL = {
  NORMAL:   { label: '여유', dot: 'bg-emerald-500',  ring: 'ring-emerald-200' },
  CAUTION:  { label: '보통', dot: 'bg-amber-500',    ring: 'ring-amber-200' },
  WARNING:  { label: '주의', dot: 'bg-orange-500',   ring: 'ring-orange-200' },
  CRITICAL: { label: '위험', dot: 'bg-red-600',      ring: 'ring-red-200' },
};

export function todayKST() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 'YYYY-MM-DD'에 일수 더하기. UTC 산술로 처리해 runtime TZ에 무관.
export function addDays(yyyymmdd, delta) {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function isToday(yyyymmdd) {
  return yyyymmdd === todayKST();
}

// 'YYYY-MM-DD' → '4월 29일 (수)' 같은 한국어 짧은 형식
export function fmtKoreanShortDate(yyyymmdd) {
  const d = new Date(yyyymmdd + 'T00:00:00+09:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${m}월 ${day}일 (${dow})`;
}

export function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR');
}
