'use strict';

const API = '/api/v1';
const tokenKey = 'sh_token';
const userKey = 'sh_user';

const $ = (sel) => document.querySelector(sel);

let token = localStorage.getItem(tokenKey);
let currentUser = JSON.parse(localStorage.getItem(userKey) || 'null');

function showLogin() {
  $('#loginSection').hidden = false;
  $('#mainSection').hidden = true;
  $('#userBadge').textContent = '';
}
function showMain() {
  $('#loginSection').hidden = true;
  $('#mainSection').hidden = false;
  $('#userBadge').textContent = currentUser ? `${currentUser.display_name || currentUser.user_id}` : '';
  refreshAll();
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error('인증이 만료되었습니다.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// 로그인
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const r = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(fd)),
    }).then((r) => r.json());
    if (!r.token) throw new Error(r.error || 'login failed');
    token = r.token;
    currentUser = r.user;
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(userKey, JSON.stringify(currentUser));
    showMain();
  } catch (err) {
    alert('로그인 실패: ' + err.message);
  }
});

$('#logoutBtn').addEventListener('click', logout);
function logout() {
  token = null; currentUser = null;
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  showLogin();
}

// 아침 경보
async function loadAlert(recompute = false) {
  const r = await api('/morning-alert' + (recompute ? '?recompute=true' : ''));
  const el = $('#alertContent');
  if (!r.level) { el.textContent = '데이터가 아직 없습니다. 시뮬레이터를 돌려보세요.'; return; }
  el.innerHTML = `
    <div>
      <span class="level ${r.level}">${r.color || ''} ${r.label || r.level}</span>
      <span class="muted">${r.assessed_at ? new Date(r.assessed_at).toLocaleString('ko-KR') : ''}</span>
    </div>
    <div class="reason">${escape(r.reason || '')}</div>
    <div class="action">${escape(r.action || '')}</div>
  `;
}
$('#recomputeBtn').addEventListener('click', () => loadAlert(true).then(loadDaily));

// EDA
$('#edaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const eda_value = parseFloat(fd.get('eda_value'));
  try {
    await api('/eda-check', { method: 'POST', body: JSON.stringify({ eda_value }) });
    e.target.reset();
    await loadDaily();
    await loadTimeblock();
  } catch (err) {
    alert('저장 실패: ' + err.message);
  }
});

// STAI
$('#staiForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const score = parseInt(fd.get('score'), 10);
  const note = fd.get('note') || null;
  try {
    await api('/evening-stai', { method: 'POST', body: JSON.stringify({ score, note }) });
    $('#staiStatus').textContent = '저장 완료 ✓';
    setTimeout(() => $('#staiStatus').textContent = '', 2000);
    await loadDaily();
  } catch (err) {
    alert('저장 실패: ' + err.message);
  }
});

// 일별 리포트
async function loadDaily() {
  try {
    const r = await api('/reports/daily');
    const el = $('#dailyReport');
    el.innerHTML = `
      <p>${escape(r.summary || '-')}</p>
      <ul id="edaList"></ul>
    `;
    const list = el.querySelector('#edaList');
    (r.daytime_eda || []).forEach((e) => {
      const li = document.createElement('li');
      const t = new Date(e.recorded_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      li.innerHTML = `<span>${t} · EDA ${e.eda_value.toFixed(2)} (z=${(e.eda_z ?? 0).toFixed(2)})</span>
        <span class="tag ${e.classification}">${e.classification}</span>`;
      list.appendChild(li);
    });
  } catch (err) {
    $('#dailyReport').textContent = '오류: ' + err.message;
  }
}

// 시간대별
async function loadTimeblock() {
  try {
    const r = await api('/reports/timeblock');
    const el = $('#timeblockReport');
    const max = Math.max(0.5, ...r.blocks.map((b) => Math.abs(b.eda_mean_z || 0)));
    el.innerHTML = `
      <div class="tb-grid">
        ${r.blocks.map((b) => {
          const z = b.eda_mean_z;
          const h = z === null ? 4 : Math.max(4, (Math.abs(z) / max) * 130);
          return `<div class="bar ${z === null ? 'empty' : ''}" style="height:${h}px">
            <div class="val">${z === null ? '-' : z.toFixed(2)}</div>
            <span>${b.label}</span>
          </div>`;
        }).join('')}
      </div>
      <p class="muted" style="margin-top:32px">최근 7일 위험 시간대: ${
        (r.weekly_pattern || []).map((p) => `${p.time_block} (z=${(p.avg_z || 0).toFixed(2)})`).join(', ') || '데이터 부족'
      }</p>
    `;
  } catch (err) {
    $('#timeblockReport').textContent = '오류: ' + err.message;
  }
}

function refreshAll() {
  loadAlert().catch((e) => $('#alertContent').textContent = '오류: ' + e.message);
  loadDaily();
  loadTimeblock();
  loadFitbitStatus();
}

// ── Fitbit 연결 ───────────────────────────────────────────
async function loadFitbitStatus() {
  try {
    const s = await api('/fitbit/status');
    const statusEl = $('#fitbitStatus');
    if (!s.configured) {
      statusEl.innerHTML = '<span class="muted">서버에 Fitbit credentials가 설정되지 않았습니다.</span>';
      return;
    }
    if (s.connected) {
      statusEl.innerHTML = `✓ 연결됨 — Fitbit user <code>${s.fitbit_user_id}</code>`;
      $('#fitbitConnectBtn').hidden = true;
      $('#fitbitSyncBtn').hidden = false;
      $('#fitbitDisconnectBtn').hidden = false;
      $('#startEdaBtn').hidden = false;
    } else {
      statusEl.innerHTML = '미연결 — Fitbit 계정 연결 후 자동 데이터 수집이 가능합니다.';
      $('#fitbitConnectBtn').hidden = false;
      $('#fitbitSyncBtn').hidden = true;
      $('#fitbitDisconnectBtn').hidden = true;
      $('#startEdaBtn').hidden = true;
    }
  } catch (e) {
    $('#fitbitStatus').textContent = '상태 확인 실패: ' + e.message;
  }
}

$('#fitbitConnectBtn').addEventListener('click', async () => {
  const r = await api('/fitbit/authorize');
  window.open(r.url, '_blank', 'width=520,height=720');
  // 콜백 후 사용자가 창 닫고 돌아오면 새로고침으로 상태 반영
  $('#fitbitStatus').textContent = '브라우저 새 창에서 Fitbit 인증을 완료해 주세요. 끝나면 이 창에서 새로고침(F5).';
});

$('#fitbitSyncBtn').addEventListener('click', async () => {
  $('#fitbitSyncResult').textContent = '동기화 중…';
  try {
    const r = await fetch(API + '/fitbit/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    const msg = `${r.date}: HRV ${r.hrv_inserted} · RHR ${r.rhr_inserted} · Sleep ${r.sleep_inserted} · EDA ${r.eda_inserted}`;
    $('#fitbitSyncResult').innerHTML = msg + (r.errors?.length ? `<br><span style="color:#dc2626">오류: ${r.errors.join(' / ')}</span>` : '');
    await refreshAll();
  } catch (e) {
    $('#fitbitSyncResult').textContent = '동기화 실패: ' + e.message;
  }
});

$('#fitbitDisconnectBtn').addEventListener('click', async () => {
  if (!confirm('Fitbit 연결을 해제하시겠습니까?')) return;
  await api('/fitbit/disconnect', { method: 'POST' });
  await loadFitbitStatus();
});

// ── EDA 3분 측정 모달 ──────────────────────────────────────
let edaTimerId = null;
let edaTimerSec = 180;

$('#startEdaBtn').addEventListener('click', () => openEdaModal());
$('#edaCloseBtn').addEventListener('click', () => closeEdaModal());
$('#edaStartBtn').addEventListener('click', () => startEdaTimer());
$('#edaPullBtn').addEventListener('click', () => pullEdaFromFitbit());

function openEdaModal() {
  $('#edaModal').hidden = false;
  $('#edaTimer').textContent = '03:00';
  $('#edaModalStatus').textContent = '';
  $('#edaStartBtn').hidden = false;
  $('#edaPullBtn').hidden = true;
}
function closeEdaModal() {
  if (edaTimerId) { clearInterval(edaTimerId); edaTimerId = null; }
  $('#edaModal').hidden = true;
}
function startEdaTimer() {
  $('#edaStartBtn').hidden = true;
  edaTimerSec = 180;
  $('#edaModalStatus').textContent = '디바이스를 쥐고 가만히 계세요…';
  edaTimerId = setInterval(() => {
    edaTimerSec--;
    const mm = String(Math.floor(edaTimerSec / 60)).padStart(2, '0');
    const ss = String(edaTimerSec % 60).padStart(2, '0');
    $('#edaTimer').textContent = `${mm}:${ss}`;
    if (edaTimerSec <= 0) {
      clearInterval(edaTimerId);
      edaTimerId = null;
      $('#edaModalStatus').textContent = '측정 완료. Fitbit 앱이 동기화되면 결과를 가져올 수 있습니다.';
      $('#edaPullBtn').hidden = false;
    }
  }, 1000);
}
async function pullEdaFromFitbit() {
  $('#edaModalStatus').textContent = 'Fitbit 클라우드에서 결과 가져오는 중…';
  try {
    const r = await fetch(API + '/fitbit/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    if (r.eda_inserted > 0) {
      $('#edaModalStatus').textContent = `✓ EDA 스캔 ${r.eda_inserted}건이 적재되었습니다.`;
      await refreshAll();
      setTimeout(closeEdaModal, 1500);
    } else {
      $('#edaModalStatus').innerHTML = '아직 동기화되지 않았습니다. 폰의 Fitbit 앱을 한 번 열어 보시고 다시 시도해 주세요.<br>'
        + (r.errors?.length ? `<small>${r.errors.join(' / ')}</small>` : '');
    }
  } catch (e) {
    $('#edaModalStatus').textContent = '실패: ' + e.message;
  }
}

function escape(s) { return String(s).replace(/[<>&"']/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }

// 부팅
if (token) showMain(); else showLogin();
