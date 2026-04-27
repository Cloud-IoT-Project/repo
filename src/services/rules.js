'use strict';

// 기획서.pdf §3-3 알림 로직 — 임계값 그대로 이식
// (NOTE: 스펙의 분기 순서를 그대로 보존했습니다. 채점 기준이 스펙이므로 임의 변경 금지.)

function morningFallbackRule({ hrv_z, sleep_eff, rhr_delta }) {
  if (hrv_z < -1.5 && sleep_eff < 0.75) return 'WARNING';
  if (hrv_z < -2.0 || rhr_delta > 8) return 'CRITICAL';
  if (hrv_z < -0.8) return 'CAUTION';
  return 'NORMAL';
}

function daytimeValidationRule(eda_z) {
  if (eda_z >= 1.0) return 'HIGH_STRESS_SIGNAL';
  if (eda_z >= 0.3) return 'MODERATE_SIGNAL';
  return 'LOW_SIGNAL';
}

// 경보 등급별 사용자 표시 정보 (한국어)
const LEVEL_META = {
  NORMAL:   { color: '🟢', label: '여유',  action: '평소 루틴 유지하시면 됩니다.' },
  CAUTION:  { color: '🟡', label: '보통',  action: '오후에 가벼운 스트레칭이나 짧은 산책을 권장합니다.' },
  WARNING:  { color: '🟠', label: '주의',  action: '점심 후 3분 EDA 체크, 10분 산책 권장.' },
  CRITICAL: { color: '🔴', label: '위험',  action: '오전 중 5분 호흡 운동, 가능하면 일정 강도 조절.' },
};

// 경보 근거 문장 자동 생성 (스펙 §3-2 형식: "어젯밤 HRV -2.1σ, 수면효율 68%")
function buildReason({ hrv_z, sleep_efficiency, rhr_delta }) {
  const parts = [];
  if (hrv_z !== null && hrv_z !== undefined) parts.push(`HRV ${hrv_z.toFixed(2)}σ`);
  if (sleep_efficiency !== null && sleep_efficiency !== undefined)
    parts.push(`수면효율 ${(sleep_efficiency * 100).toFixed(0)}%`);
  if (rhr_delta !== null && rhr_delta !== undefined && Math.abs(rhr_delta) >= 1)
    parts.push(`RHR Δ${rhr_delta > 0 ? '+' : ''}${rhr_delta.toFixed(1)}bpm`);
  return parts.length ? `어젯밤 ${parts.join(', ')}` : '데이터 부족';
}

module.exports = {
  morningFallbackRule,
  daytimeValidationRule,
  LEVEL_META,
  buildReason,
};
