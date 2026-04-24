import { showToast } from '../components/toast.js';
import { signOut } from '../auth.js';
import { listEntries, upsertProfile, deleteAllEntries, deleteProfile } from '../db.js';
import { track, resetAnalytics } from '../analytics.js';

const BMC_URL = 'https://buymeacoffee.com/jessisfamiliar';

function downloadCSV(entries, email) {
  const headers = ['Date', 'Time', 'Foods', 'Severity', 'Time to Bloat', 'Note'];
  const rows = entries.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(e => {
    const d = new Date(e.timestamp);
    const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return [date, time, e.foods, e.severity, e.timeToBloat, e.note].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bloat-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function renderSettingsPage(root, { user, profile }, nav) {
  root.innerHTML = '';
  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <button class="icon-btn" id="back-btn" title="Back">←</button>
    <h1>Settings</h1>
    <div class="header-actions"></div>
  `;
  header.querySelector('#back-btn').addEventListener('click', () => nav.go('app'));
  root.appendChild(header);

  const main = document.createElement('main');
  main.className = 'tab-content';
  main.innerHTML = `
    <div class="page-section">
      <div class="card">
        <h3>Profile</h3>
        <div class="form-group">
          <label class="form-label" for="display-name">Display name</label>
          <input class="form-input" type="text" id="display-name" value="${(profile?.display_name || '').replace(/"/g, '&quot;')}" placeholder="Your name" />
          <div style="color:#888;font-size:0.8rem;margin-top:6px">This is what will display on any generated reports.</div>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <div style="color:#555">${user.email}</div>
        </div>
        <div style="display:flex;justify-content:flex-end">
          <button class="btn-save" id="save-profile">Save</button>
        </div>
      </div>

      <div class="card">
        <h3>Liking the tool?</h3>
        <a class="link-btn" href="${BMC_URL}" target="_blank" rel="noopener noreferrer" style="width:100%">☕ Buy Me a Coffee</a>
      </div>

      <div class="card">
        <h3>Account</h3>
        <div class="row-between">
          <div>
            <div style="font-weight:600">Sign out</div>
            <div style="color:#666;font-size:0.85rem">You'll need a new magic link to come back.</div>
          </div>
          <button class="btn-sm" id="signout-btn">Sign out</button>
        </div>
      </div>

      <div class="card">
        <h3>Delete account</h3>
        <p style="color:#666;font-size:0.85rem;margin-bottom:10px">This permanently deletes all your entries and your profile. Before deleting, your full log will be automatically downloaded as a CSV so you have a copy of your data. Type <strong>DELETE</strong> to confirm.</p>
        <input class="form-input" type="text" id="delete-confirm" placeholder="Type DELETE" autocomplete="off" />
        <div class="form-error" id="delete-error"></div>
        <button class="danger-btn" id="delete-btn" style="margin-top:10px">Delete my account</button>
      </div>
    </div>
  `;
  root.appendChild(main);

  main.querySelector('#save-profile').addEventListener('click', async () => {
    const name = main.querySelector('#display-name').value.trim();
    try {
      await upsertProfile(user.id, { display_name: name || null });
      showToast('✅ Saved');
    } catch (e) {
      alert('Save failed: ' + (e.message || e));
    }
  });

  main.querySelector('#signout-btn').addEventListener('click', async () => {
    resetAnalytics();
    await signOut();
    nav.go('login');
  });

  main.querySelector('#delete-btn').addEventListener('click', async () => {
    const val = main.querySelector('#delete-confirm').value.trim();
    const errEl = main.querySelector('#delete-error');
    errEl.classList.remove('show');
    if (val !== 'DELETE') {
      errEl.textContent = 'Please type DELETE (all caps) to confirm.';
      errEl.classList.add('show');
      return;
    }
    const ok = window.confirm('Your data will be downloaded as a CSV, then your account will be permanently deleted. Continue?');
    if (!ok) return;
    try {
      const entries = await listEntries(user.id);
      downloadCSV(entries, user.email);
      await deleteAllEntries(user.id);
      await deleteProfile(user.id);
      track('account_deleted');
      resetAnalytics();
      await signOut();
      nav.go('login');
    } catch (e) {
      alert('Delete failed: ' + (e.message || e));
    }
  });
}
