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

export function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR');
}
