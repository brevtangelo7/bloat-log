import {
  adminListProfiles, adminCountEntries, adminCountEntriesPerUser, adminSetDisabled,
} from '../db.js';
import { supabase } from '../supabaseClient.js';

export async function renderAdminPage(root, { user, isAdmin }, nav) {
  root.innerHTML = '';
  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <button class="icon-btn" id="back-btn" title="Back">←</button>
    <h1>Admin</h1>
    <div class="header-actions"></div>
  `;
  header.querySelector('#back-btn').addEventListener('click', () => nav.go('app'));
  root.appendChild(header);

  if (!isAdmin) {
    const main = document.createElement('main');
    main.className = 'tab-content';
    main.innerHTML = `<div class="page-section"><div class="card">⛔ You don't have access to this page.</div></div>`;
    root.appendChild(main);
    return;
  }

  const main = document.createElement('main');
  main.className = 'tab-content';
  main.innerHTML = `
    <div class="page-section">
      <div class="card">
        <h3>Overview</h3>
        <div class="stat-grid" id="stat-grid">
          <div class="stat"><div class="stat-label">Total users</div><div class="stat-value" id="stat-users">…</div></div>
          <div class="stat"><div class="stat-label">Total entries</div><div class="stat-value" id="stat-entries">…</div></div>
          <div class="stat"><div class="stat-label">New users · 7d</div><div class="stat-value" id="stat-new-7">…</div></div>
          <div class="stat"><div class="stat-label">New users · 30d</div><div class="stat-value" id="stat-new-30">…</div></div>
          <div class="stat"><div class="stat-label">DAU</div><div class="stat-value" id="stat-dau">…</div></div>
          <div class="stat"><div class="stat-label">WAU</div><div class="stat-value" id="stat-wau">…</div></div>
          <div class="stat"><div class="stat-label">MAU</div><div class="stat-value" id="stat-mau">…</div></div>
        </div>
      </div>

      <div class="card">
        <h3>Users</h3>
        <div style="overflow-x:auto">
          <table class="admin-user-table" id="user-table">
            <thead>
              <tr>
                <th>Name</th><th>Joined</th><th>Last seen</th><th>Entries</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody><tr><td colspan="6" style="padding:14px">Loading…</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  root.appendChild(main);

  try {
    const [profiles, totalEntries, entriesByUser] = await Promise.all([
      adminListProfiles(),
      adminCountEntries(),
      adminCountEntriesPerUser(),
    ]);

    const now = Date.now();
    const days = d => d * 24 * 60 * 60 * 1000;
    const new7 = profiles.filter(p => now - new Date(p.created_at).getTime() <= days(7)).length;
    const new30 = profiles.filter(p => now - new Date(p.created_at).getTime() <= days(30)).length;
    const dau = profiles.filter(p => p.last_seen_at && now - new Date(p.last_seen_at).getTime() <= days(1)).length;
    const wau = profiles.filter(p => p.last_seen_at && now - new Date(p.last_seen_at).getTime() <= days(7)).length;
    const mau = profiles.filter(p => p.last_seen_at && now - new Date(p.last_seen_at).getTime() <= days(30)).length;

    main.querySelector('#stat-users').textContent = profiles.length;
    main.querySelector('#stat-entries').textContent = totalEntries;
    main.querySelector('#stat-new-7').textContent = new7;
    main.querySelector('#stat-new-30').textContent = new30;
    main.querySelector('#stat-dau').textContent = dau;
    main.querySelector('#stat-wau').textContent = wau;
    main.querySelector('#stat-mau').textContent = mau;

    const tbody = main.querySelector('#user-table tbody');
    const fmt = ts => ts ? new Date(ts).toLocaleDateString() : '—';
    tbody.innerHTML = profiles.map(p => {
      return `
      <tr data-id="${p.id}" class="${p.is_disabled ? 'disabled' : ''}">
        <td>${escAttr(p.display_name) || '<span class="dash">—</span>'}</td>
        <td>${fmt(p.created_at)}</td>
        <td>${fmt(p.last_seen_at)}</td>
        <td>${entriesByUser[p.id] || 0}</td>
        <td>${p.is_disabled ? '🚫 Disabled' : '✅ Active'}</td>
        <td class="actions-cell">
          ${p.is_disabled
            ? '<button class="btn-sm btn-enable">Re-enable</button>'
            : '<button class="btn-sm danger btn-disable">Disable</button>'}
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" style="padding:14px">No users yet.</td></tr>`;

    tbody.addEventListener('click', async e => {
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      const id = row.dataset.id;
      if (e.target.closest('.btn-disable')) {
        if (!confirm('Disable this user?')) return;
        await adminSetDisabled(id, true);
        row.classList.add('disabled');
        row.querySelector('.actions-cell').innerHTML = '<button class="btn-sm btn-enable">Re-enable</button>';
        row.cells[5].textContent = '🚫 Disabled';
      }
      if (e.target.closest('.btn-enable')) {
        await adminSetDisabled(id, false);
        row.classList.remove('disabled');
        row.querySelector('.actions-cell').innerHTML = '<button class="btn-sm danger btn-disable">Disable</button>';
        row.cells[5].textContent = '✅ Active';
      }
    });
  } catch (e) {
    main.querySelector('#user-table tbody').innerHTML = `<tr><td colspan="7" style="padding:14px;color:#E11D48">Failed to load: ${e.message || e}</td></tr>`;
  }
}

function escAttr(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
