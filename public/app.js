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
}

function escape(s) { return String(s).replace(/[<>&"']/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }

// 부팅
if (token) showMain(); else showLogin();
