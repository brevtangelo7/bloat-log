import Chart from 'chart.js/auto';
import { renderHeader, renderTabBar } from '../components/nav.js';
import { showToast } from '../components/toast.js';
import { openSettingsTray } from '../components/settingsTray.js';
import { esc, severityBadge, sevToNum, downloadCSV } from '../util.js';
import {
  listEntries, createEntry, updateEntryRow, deleteEntryRow, updateLastSeen,
} from '../db.js';
import { track } from '../analytics.js';

let entries = [];
let activeTab = 'log';
let user = null;
let isAdmin = false;
let currentProfile = null;
let chartOverTime = null;
let selectedSeverity = '';
let selectedTTB = '';

const LOCAL_STORAGE_KEY = 'bloatlog_entries';

export async function renderAppPage(root, { user: u, profile, isAdmin: admin }, nav) {
  user = u;
  isAdmin = admin;
  currentProfile = profile;

  root.innerHTML = '';
  const header = renderHeader({
    showSettings: true,
    isAdmin,
    onSettings: () => openSettingsTray({ user, profile }, nav),
    onAdmin: () => nav.go('admin'),
    onLogoClick: () => switchTab('log'),
  });
  root.appendChild(header);

  const main = document.createElement('main');
  main.className = 'tab-content';
  main.innerHTML = `
    <section id="tab-log" class="tab-panel active">
      <div class="tab-header"><h2>📝 Log Entry</h2></div>
      <div class="form-section" style="padding: 16px 20px;">
        <div class="form-group">
          <label class="form-label" for="input-foods">🍽️ Foods Eaten</label>
          <input class="form-input" type="text" id="input-foods" placeholder="e.g. bread, dairy, onions" autocomplete="off" />
        </div>
        <div class="form-group">
          <label class="form-label">🌡️ Bloating Severity</label>
          <div class="pill-group" id="severity-group">
            <button class="pill-btn sev-low"  data-sev="Low">  🟢 Low</button>
            <button class="pill-btn sev-med"  data-sev="Medium">🟡 Med</button>
            <button class="pill-btn sev-high" data-sev="High"> 🔴 High</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">⏱️ Time to Bloat</label>
          <div class="pill-group" id="ttb-group">
            <button class="pill-btn time-btn" data-ttb="Before finishing eating">Before finishing</button>
            <button class="pill-btn time-btn" data-ttb="15 min">15 min</button>
            <button class="pill-btn time-btn" data-ttb="30 min">30 min</button>
            <button class="pill-btn time-btn" data-ttb="1 hour">1 hour</button>
            <button class="pill-btn time-btn" data-ttb="More than 1 hour">More than 1 hr</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="input-note">📝 Note</label>
          <textarea class="form-textarea" id="input-note" rows="3" placeholder="Anything else you want to add…"></textarea>
        </div>
        <div class="form-error" id="log-error">Please fill in at least one field ✏️</div>
        <button class="btn-primary" id="btn-log">✨ Log Entry</button>
      </div>
    </section>
    <section id="tab-history" class="tab-panel">
      <div class="tab-header" style="display:flex;align-items:center;justify-content:space-between;">
        <h2>📋 History</h2>
        <button class="btn-csv" id="btn-download-csv">⬇️ CSV</button>
      </div>
      <div id="history-list"></div>
    </section>
    <section id="tab-charts" class="tab-panel">
      <div class="tab-header"><h2>📊 Patterns</h2></div>
      <div style="padding: 12px 0 0;"><button class="btn-export" id="btn-export">📤 Export Report</button></div>
      <div class="charts-content" style="margin-top: 16px;">
        <div class="card chart-card">
          <div class="chart-title">🍽️ Foods by Bloating Severity</div>
          <div id="chart1-wrap"></div>
          <div class="chart-empty" id="chart1-empty" style="display:none">Not enough data yet 📊</div>
        </div>
        <div class="card chart-card">
          <div class="chart-title">⚡ Foods by Speed of Bloating</div>
          <div id="chart2-wrap"></div>
          <div class="chart-empty" id="chart2-empty" style="display:none">Not enough data yet ⚡</div>
        </div>
        <div class="card chart-card">
          <div class="chart-title">📅 Bloating Over Time</div>
          <div class="chart-canvas-wrap" id="chart3-wrap"><canvas id="chart-over-time"></canvas></div>
          <div class="chart-empty" id="chart3-empty" style="display:none">Not enough data yet 📅</div>
        </div>
      </div>
    </section>
  `;
  root.appendChild(main);
  root.appendChild(renderTabBar(activeTab, switchTab));

  wireLogForm();
  wireExport();
  wireCSVDownload();

  // Load entries
  entries = await listEntries(user.id);

  // Offer migration of any old localStorage entries
  await maybeOfferMigration();

  if (activeTab === 'history') renderHistory();
  if (activeTab === 'charts') renderCharts();
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
  if (tab === 'history') renderHistory();
  if (tab === 'charts') renderCharts();
}

/* ── LOG ───────────────────────────────────────── */
function wireLogForm() {
  selectedSeverity = '';
  selectedTTB = '';

  document.getElementById('severity-group').addEventListener('click', e => {
    const btn = e.target.closest('.pill-btn[data-sev]');
    if (!btn) return;
    const val = btn.dataset.sev;
    if (selectedSeverity === val) {
      selectedSeverity = '';
      btn.classList.remove('active');
    } else {
      selectedSeverity = val;
      document.querySelectorAll('#severity-group .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });

  document.getElementById('ttb-group').addEventListener('click', e => {
    const btn = e.target.closest('.pill-btn[data-ttb]');
    if (!btn) return;
    const val = btn.dataset.ttb;
    if (selectedTTB === val) {
      selectedTTB = '';
      btn.classList.remove('active');
    } else {
      selectedTTB = val;
      document.querySelectorAll('#ttb-group .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });

  document.getElementById('btn-log').addEventListener('click', async () => {
    const foods = document.getElementById('input-foods').value.trim();
    const note = document.getElementById('input-note').value.trim();
    const errEl = document.getElementById('log-error');

    if (!foods && !selectedSeverity && !selectedTTB && !note) {
      errEl.classList.add('show');
      return;
    }
    errEl.classList.remove('show');

    const btn = document.getElementById('btn-log');
    btn.disabled = true;
    try {
      const saved = await createEntry(user.id, {
        timestamp: new Date().toISOString(),
        foods, severity: selectedSeverity, timeToBloat: selectedTTB, note,
      });
      entries.push(saved);
      track('entry_logged', { severity: selectedSeverity || null, time_to_bloat: selectedTTB || null });
      updateLastSeen(user.id);
      showToast('✅ Logged!');
      resetLogForm();
    } catch (e) {
      errEl.textContent = e.message || 'Could not save. Try again.';
      errEl.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  });
}

function resetLogForm() {
  document.getElementById('input-foods').value = '';
  document.getElementById('input-note').value = '';
  selectedSeverity = '';
  selectedTTB = '';
  document.querySelectorAll('#severity-group .pill-btn, #ttb-group .pill-btn')
    .forEach(b => b.classList.remove('active'));
  document.getElementById('log-error').classList.remove('show');
}

/* ── HISTORY ───────────────────────────────────── */
function renderHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;
  const list = entries.slice().reverse();
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">No entries yet — start logging! 📝</div>';
    return;
  }
  container.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>Date / Time</th><th>Foods</th><th>Bloat</th><th>Time to Bloat</th><th>Note</th><th></th>
        </tr>
      </thead>
      <tbody>${list.map(buildHistoryRow).join('')}</tbody>
    </table>
  `;
  attachHistoryEvents();
}

function buildHistoryRow(e) {
  const d = new Date(e.timestamp);
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `
    <tr data-id="${e.id}">
      <td class="hist-ts"><div class="ts-date">${datePart}</div><div class="ts-time">${timePart}</div></td>
      <td>${e.foods ? esc(e.foods) : '<span class="dash">—</span>'}</td>
      <td>${e.severity ? severityBadge(e.severity) : '<span class="dash">—</span>'}</td>
      <td>${e.timeToBloat ? esc(e.timeToBloat) : '<span class="dash">—</span>'}</td>
      <td class="hist-note">${e.note ? esc(e.note) : '<span class="dash">—</span>'}</td>
      <td class="hist-actions">
        <div class="history-actions">
          <button class="btn-sm accent btn-edit" title="Edit">✏️</button>
          <button class="btn-sm danger btn-delete" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`;
}

function buildEditForm(e) {
  const sevOptions = ['Low', 'Medium', 'High'].map(s =>
    `<button class="pill-btn sev-${s.toLowerCase()} ${e.severity === s ? 'active' : ''}" data-sev="${s}">${s === 'Low' ? '🟢' : s === 'Medium' ? '🟡' : '🔴'} ${s === 'Medium' ? 'Med' : s}</button>`
  ).join('');
  const ttbOptions = [
    ['Before finishing eating', 'Before finishing'],
    ['15 min', '15 min'],
    ['30 min', '30 min'],
    ['1 hour', '1 hour'],
    ['More than 1 hour', 'More than 1 hr'],
  ].map(([val, label]) =>
    `<button class="pill-btn time-btn ${e.timeToBloat === val ? 'active' : ''}" data-ttb="${val}">${label}</button>`
  ).join('');
  const d = new Date(e.timestamp);
  const pad = n => String(n).padStart(2, '0');
  const dtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `
    <div class="edit-form">
      <div class="form-group">
        <label class="form-label">🗓️ Date / Time</label>
        <input class="form-input edit-timestamp" type="datetime-local" value="${dtLocal}" />
      </div>
      <div class="form-group">
        <label class="form-label">🍽️ Foods</label>
        <input class="form-input edit-foods" type="text" value="${esc(e.foods)}" placeholder="e.g. bread, dairy" />
      </div>
      <div class="form-group">
        <label class="form-label">🌡️ Severity</label>
        <div class="pill-group edit-sev-group">${sevOptions}</div>
      </div>
      <div class="form-group">
        <label class="form-label">⏱️ Time to Bloat</label>
        <div class="pill-group edit-ttb-group">${ttbOptions}</div>
      </div>
      <div class="form-group">
        <label class="form-label">📝 Note</label>
        <textarea class="form-textarea edit-note" rows="2">${esc(e.note)}</textarea>
      </div>
      <div class="edit-actions">
        <button class="btn-save btn-save-edit">Save</button>
        <button class="btn-cancel btn-cancel-edit">Cancel</button>
      </div>
    </div>`;
}

let historyEventsAttached = false;
function attachHistoryEvents() {
  if (historyEventsAttached) return;
  historyEventsAttached = true;
  const list = document.getElementById('history-list');

  list.addEventListener('click', async e => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.btn-edit')) {
      const entry = entries.find(x => x.id === id);
      if (!entry) return;
      row.innerHTML = `<td colspan="6" style="padding:14px 16px;">${buildEditForm(entry)}</td>`;
      attachEditFormEvents(row, id);
      return;
    }

    if (e.target.closest('.btn-delete') && !e.target.closest('.btn-confirm-delete')) {
      const actionsEl = row.querySelector('.hist-actions');
      actionsEl.innerHTML = `
        <div class="confirm-row">
          <span>Delete?</span>
          <button class="btn-sm danger btn-confirm-delete">Yes</button>
          <button class="btn-sm btn-cancel-delete">No</button>
        </div>`;
      return;
    }

    if (e.target.closest('.btn-confirm-delete')) {
      try {
        await deleteEntryRow(id);
        entries = entries.filter(x => x.id !== id);
        track('entry_deleted');
        renderHistory();
      } catch (err) {
        alert('Delete failed: ' + (err.message || err));
      }
      return;
    }

    if (e.target.closest('.btn-cancel-delete')) {
      renderHistory();
      return;
    }
  });
}

function attachEditFormEvents(card, id) {
  card.querySelector('.edit-sev-group').addEventListener('click', ev => {
    const btn = ev.target.closest('.pill-btn[data-sev]');
    if (!btn) return;
    const isActive = btn.classList.contains('active');
    card.querySelectorAll('.edit-sev-group .pill-btn').forEach(b => b.classList.remove('active'));
    if (!isActive) btn.classList.add('active');
  });
  card.querySelector('.edit-ttb-group').addEventListener('click', ev => {
    const btn = ev.target.closest('.pill-btn[data-ttb]');
    if (!btn) return;
    const isActive = btn.classList.contains('active');
    card.querySelectorAll('.edit-ttb-group .pill-btn').forEach(b => b.classList.remove('active'));
    if (!isActive) btn.classList.add('active');
  });
  card.querySelector('.btn-save-edit').addEventListener('click', async () => {
    const foods = card.querySelector('.edit-foods').value.trim();
    const note = card.querySelector('.edit-note').value.trim();
    const sevBtn = card.querySelector('.edit-sev-group .pill-btn.active');
    const ttbBtn = card.querySelector('.edit-ttb-group .pill-btn.active');
    const severity = sevBtn ? sevBtn.dataset.sev : '';
    const timeToBloat = ttbBtn ? ttbBtn.dataset.ttb : '';
    const tsVal = card.querySelector('.edit-timestamp').value;
    const timestamp = tsVal ? new Date(tsVal).toISOString() : undefined;
    try {
      const updated = await updateEntryRow(id, { foods, severity, timeToBloat, note, ...(timestamp && { timestamp }) });
      entries = entries.map(x => x.id === id ? updated : x);
      track('entry_edited');
      renderHistory();
    } catch (err) {
      alert('Save failed: ' + (err.message || err));
    }
  });
  card.querySelector('.btn-cancel-edit').addEventListener('click', () => renderHistory());
}

/* ── CHARTS ────────────────────────────────────── */
function renderCharts() {
  // Chart 1
  const sevEntries = entries.filter(e => e.severity && e.foods);
  const sevGroups = { High: new Set(), Medium: new Set(), Low: new Set() };
  sevEntries.forEach(e => {
    e.foods.split(',').map(f => f.trim().toLowerCase()).filter(Boolean)
      .forEach(f => sevGroups[e.severity].add(f));
  });
  const chart1wrap = document.getElementById('chart1-wrap');
  const chart1empty = document.getElementById('chart1-empty');
  const hasAnySev = sevGroups.High.size || sevGroups.Medium.size || sevGroups.Low.size;
  if (!hasAnySev) {
    chart1wrap.innerHTML = '';
    chart1empty.style.display = 'block';
  } else {
    chart1empty.style.display = 'none';
    const rows = [
      { label: '🔴 High', foods: sevGroups.High },
      { label: '🟡 Medium', foods: sevGroups.Medium },
      { label: '🟢 Low', foods: sevGroups.Low },
    ].filter(r => r.foods.size).map(r => `
      <tr>
        <td style="white-space:nowrap;font-weight:600">${r.label}</td>
        <td>${esc([...r.foods].join(', '))}</td>
      </tr>`).join('');
    chart1wrap.innerHTML = `
      <table class="speed-table">
        <thead><tr><th>Severity</th><th>Foods</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // Chart 2
  const ttbOrder = ['Before finishing eating', '15 min', '30 min', '1 hour', 'More than 1 hour'];
  const ttbFoods = {};
  entries.filter(e => e.timeToBloat && e.foods).forEach(e => {
    if (!ttbFoods[e.timeToBloat]) ttbFoods[e.timeToBloat] = new Set();
    e.foods.split(',').map(f => f.trim().toLowerCase()).filter(Boolean)
      .forEach(f => ttbFoods[e.timeToBloat].add(f));
  });
  const chart2wrap = document.getElementById('chart2-wrap');
  const chart2empty = document.getElementById('chart2-empty');
  if (!Object.keys(ttbFoods).length) {
    chart2wrap.innerHTML = '';
    chart2empty.style.display = 'block';
  } else {
    chart2empty.style.display = 'none';
    const rows = ttbOrder.filter(t => ttbFoods[t]).map(t => `
      <tr>
        <td style="white-space:nowrap;font-weight:600">${t}</td>
        <td>${esc([...ttbFoods[t]].join(', '))}</td>
      </tr>`).join('');
    chart2wrap.innerHTML = `
      <table class="speed-table">
        <thead><tr><th>Time to Bloat</th><th>Foods</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // Chart 3
  const byDay = {};
  entries.filter(e => e.severity).forEach(e => {
    const day = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(sevToNum(e.severity));
  });
  const chart3wrap = document.getElementById('chart3-wrap');
  const chart3empty = document.getElementById('chart3-empty');
  if (!Object.keys(byDay).length) {
    chart3wrap.style.display = 'none';
    chart3empty.style.display = 'block';
  } else {
    chart3wrap.style.display = 'block';
    chart3empty.style.display = 'none';
    if (chartOverTime) chartOverTime.destroy();
    const labels3 = Object.keys(byDay);
    const data3 = labels3.map(d => {
      const v = byDay[d];
      return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
    });
    const canvas3 = document.getElementById('chart-over-time');
    canvas3.height = 220;
    chartOverTime = new Chart(canvas3, {
      type: 'line',
      data: {
        labels: labels3,
        datasets: [{
          label: 'Avg Severity', data: data3,
          borderColor: '#7C5CBF', backgroundColor: 'rgba(124,92,191,0.10)',
          pointBackgroundColor: '#7C5CBF', pointRadius: 5,
          fill: true, tension: 0.3, borderWidth: 2.5,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => {
            const v = ctx.raw;
            const label = v >= 2.5 ? 'High' : v >= 1.5 ? 'Medium' : 'Low';
            return `${v} (${label})`;
          } } },
        },
        scales: {
          y: { min: 0, max: 3, ticks: { stepSize: 1, font: { family: 'Clash Display' }, callback: v => ['', 'Low', 'Medium', 'High'][v] || '' }, grid: { color: '#EDE7F6' } },
          x: { ticks: { font: { family: 'Clash Display', size: 11 } } },
        },
      },
    });
  }
}

/* ── CSV DOWNLOAD ──────────────────────────────── */
function wireCSVDownload() {
  document.getElementById('btn-download-csv').addEventListener('click', () => {
    if (!entries.length) { alert('No entries to download yet!'); return; }
    downloadCSV(entries);
  });
}

/* ── EXPORT ────────────────────────────────────── */
function wireExport() {
  document.getElementById('btn-export').addEventListener('click', () => {
    exportReport(entries, currentProfile?.display_name || '');
    track('export_report');
  });
}

export function exportReport(entriesList, displayName = '') {
  if (!entriesList.length) {
    alert('No entries to export yet! Log some entries first.');
    return;
  }

  const sorted = entriesList.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const dateRange = `${new Date(sorted[0].timestamp).toLocaleDateString()} – ${new Date(sorted[sorted.length - 1].timestamp).toLocaleDateString()}`;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const reportTitle = displayName ? `Bloat Log Report for ${displayName}` : 'Bloat Log Report';

  // Chart 1 — severity table (matches in-app view)
  const sevGroups = { High: new Set(), Medium: new Set(), Low: new Set() };
  sorted.filter(e => e.severity && e.foods).forEach(e => {
    e.foods.split(',').map(f => f.trim().toLowerCase()).filter(Boolean)
      .forEach(f => sevGroups[e.severity].add(f));
  });
  const sev1Rows = [
    { label: '🔴 High', foods: sevGroups.High },
    { label: '🟡 Medium', foods: sevGroups.Medium },
    { label: '🟢 Low', foods: sevGroups.Low },
  ].filter(r => r.foods.size).map(r =>
    `<tr><td style="white-space:nowrap;font-weight:600">${r.label}</td><td>${esc([...r.foods].join(', '))}</td></tr>`
  ).join('');
  const chart1HTML = sev1Rows
    ? `<table><thead><tr><th>Severity</th><th>Foods</th></tr></thead><tbody>${sev1Rows}</tbody></table>`
    : `<p style="color:#888;font-style:italic">No data</p>`;

  // Chart 2 — time to bloat table
  const ttbOrder = ['Before finishing eating', '15 min', '30 min', '1 hour', 'More than 1 hour'];
  const ttbFoods = {};
  sorted.filter(e => e.timeToBloat && e.foods).forEach(e => {
    if (!ttbFoods[e.timeToBloat]) ttbFoods[e.timeToBloat] = new Set();
    e.foods.split(',').map(f => f.trim().toLowerCase()).filter(Boolean).forEach(f => ttbFoods[e.timeToBloat].add(f));
  });
  const speedRowsHTML = ttbOrder.filter(t => ttbFoods[t]).map(t =>
    `<tr><td style="font-weight:600">${t}</td><td>${esc([...ttbFoods[t]].join(', '))}</td></tr>`
  ).join('') || '<tr><td colspan="2" style="color:#888;font-style:italic">No data</td></tr>';

  // Chart 3 — line chart data
  const byDay = {};
  sorted.filter(e => e.severity).forEach(e => {
    const day = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(sevToNum(e.severity));
  });
  const labels3 = Object.keys(byDay);
  const data3 = labels3.map(d => {
    const v = byDay[d];
    return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  });
  const chart3Data = {
    labels: labels3,
    datasets: [{ label: 'Avg Severity', data: data3, borderColor: '#7C5CBF', backgroundColor: 'rgba(124,92,191,0.10)', pointBackgroundColor: '#7C5CBF', fill: true, tension: 0.3, pointRadius: 5, borderWidth: 2.5 }],
  };

  function exportBadge(sev) {
    if (!sev) return '—';
    const bg = sev === 'High' ? '#FFB3C6' : sev === 'Medium' ? '#FFE566' : '#B8F0A0';
    return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${bg};color:#1A1A1A;font-weight:700;font-size:0.8em">${sev === 'Medium' ? 'Med' : sev}</span>`;
  }
  const entryRows = sorted.slice().reverse().map((e, i) => `
    <tr style="${i % 2 === 1 ? 'background:#F9FFF6' : ''}">
      <td style="white-space:nowrap;font-size:0.8em;color:#666">${new Date(e.timestamp).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
      <td>${esc(e.foods) || '—'}</td>
      <td>${exportBadge(e.severity)}</td>
      <td>${esc(e.timeToBloat) || '—'}</td>
      <td style="font-style:italic;color:#555">${esc(e.note) || '—'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${reportTitle} — ${today}</title>
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap" rel="stylesheet"/>
<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Clash Display', -apple-system, sans-serif; background: #fff; color: #1A1A1A; }
.report-header { background: #fff; color: #1A1A1A; padding: 28px 24px; border-bottom: 2px solid #1A1A1A; }
.report-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.01em; }
.report-header p { font-size: 0.875rem; color: #555; }
.content { max-width: 860px; margin: 0 auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 16px; }
.chart-card { background: #f5f5f5; border-radius: 16px; padding: 16px; }
.entry-card { background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #e0e0e0; }
.chart-title { font-family: 'Clash Display', sans-serif; font-size: 1.1rem; font-weight: 600; margin-bottom: 14px; }
canvas { max-height: 320px; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th { font-family: 'Clash Display', sans-serif; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; text-align: left; padding: 10px 14px; background: #e8e8e8; border-bottom: 1px solid rgba(0,0,0,0.1); white-space: nowrap; color: #1A1A1A; }
td { padding: 9px 14px; border-bottom: 1px solid #ddd; vertical-align: top; color: #1A1A1A; }
tr:last-child td { border-bottom: none; }
@media print { .chart-card { background: #f5f5f5; } .print-bar { display:none; } }
.print-bar { position:sticky; top:0; z-index:10; background:#fff; border-bottom:1px solid #ddd; padding:10px 16px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.print-bar p { font-size:0.85rem; color:#555; }
.print-bar button { background:#7C4DFF; color:#fff; border:none; border-radius:10px; padding:8px 18px; font-family:'Clash Display',sans-serif; font-size:0.9rem; font-weight:600; cursor:pointer; }
.print-bar button:hover { opacity:0.88; }
</style>
</head>
<body>
<div class="print-bar">
  <p>Save as PDF to email or share with your doctor.</p>
  <button onclick="window.print()">Save as PDF</button>
</div>
<div class="report-header">
  <h1>${reportTitle}</h1>
  <p>Generated: ${today} &nbsp;|&nbsp; ${dateRange} &nbsp;|&nbsp; ${sorted.length} entries</p>
</div>
<div class="content">
  <div class="chart-card"><div class="chart-title">🍽️ Foods by Bloating Severity</div>${chart1HTML}</div>
  <div class="chart-card">
    <div class="chart-title">⚡ Foods by Speed of Bloating</div>
    <table>
      <thead><tr><th>Time to Bloat</th><th>Foods</th></tr></thead>
      <tbody>${speedRowsHTML}</tbody>
    </table>
  </div>
  <div class="chart-card"><div class="chart-title">📅 Bloating Over Time</div><canvas id="c3" style="height:220px"></canvas></div>
  <div class="entry-card">
    <table>
      <thead><tr><th>Date / Time</th><th>Foods</th><th>Bloat</th><th>Time to Bloat</th><th>Note</th></tr></thead>
      <tbody>${entryRows}</tbody>
    </table>
  </div>
</div>
<script>
(function(){
  var c3d = ${JSON.stringify(chart3Data)};
  if (c3d.labels.length) {
    new Chart(document.getElementById('c3'), {
      type:'line', data: c3d,
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false },
          tooltip:{ callbacks:{ label:function(ctx){ var v=ctx.raw; return v+' ('+(v>=2.5?'High':v>=1.5?'Medium':'Low')+')'; } } } },
        scales:{ y:{ min:0, max:3, ticks:{ stepSize:1, font:{ family:'Clash Display' }, callback:function(v){ return ['','Low','Medium','High'][v]||''; } }, grid:{ color:'#EDE7F6' } },
                 x:{ ticks:{ font:{ family:'Clash Display', size:11 } } } } }
    });
  }
})();
<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ── Migration from localStorage ───────────────── */
async function maybeOfferMigration() {
  let raw;
  try { raw = localStorage.getItem(LOCAL_STORAGE_KEY); } catch { return; }
  if (!raw) return;
  let legacy = [];
  try { legacy = JSON.parse(raw); } catch { return; }
  if (!Array.isArray(legacy) || !legacy.length) {
    try { localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
    return;
  }
  const ok = window.confirm(`Found ${legacy.length} entries in local storage from the old version. Import them into your account?`);
  if (!ok) {
    try { localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
    return;
  }
  let imported = 0;
  for (const e of legacy) {
    try {
      const saved = await createEntry(user.id, {
        timestamp: e.timestamp || new Date().toISOString(),
        foods: e.foods || '',
        severity: e.severity || '',
        timeToBloat: e.timeToBloat || '',
        note: e.note || '',
      });
      entries.push(saved);
      imported++;
    } catch (err) {
      console.warn('Import failed for entry', e, err);
    }
  }
  try { localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
  showToast(`✨ Imported ${imported} entries!`);
}
