import { showToast } from './toast.js';
import { signOut } from '../auth.js';
import { listEntries, upsertProfile, deleteAllEntries, deleteProfile } from '../db.js';
import { track, resetAnalytics } from '../analytics.js';
import { downloadCSV } from '../util.js';
import { showInstallPrompt, canShowInstallRow } from './installPrompt.js';

const BMC_URL = 'https://buymeacoffee.com/jessisfamiliar';

export function openSettingsTray({ user, profile }, nav) {
  document.getElementById('settings-tray-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'settings-tray-overlay';
  overlay.innerHTML = `
    <div id="settings-tray">
      <div class="tray-header">
        <span class="tray-title">Settings</span>
        <button class="icon-btn tray-close">✕</button>
      </div>

      <div class="tray-section">
        <div class="tray-label">Display name</div>
        <input class="form-input" type="text" id="tray-display-name"
          value="${(profile?.display_name || '').replace(/"/g, '&quot;')}"
          placeholder="Your name" />
        <div class="tray-help">Appears on generated reports.</div>
        <div style="display:flex;justify-content:flex-end;margin-top:8px">
          <button class="btn-save tray-save-name">Save</button>
        </div>
      </div>

      <div class="tray-divider"></div>

      <div class="tray-section">
        <div class="tray-bmc-bubble">
          <span style="font-size:1.3rem">☕</span>
          <div>
            <div style="font-weight:600;font-size:0.9rem">Liking the tool?</div>
            <a href="${BMC_URL}" target="_blank" rel="noopener noreferrer">Buy me a coffee →</a>
          </div>
        </div>
      </div>

      <div class="tray-divider"></div>

      ${canShowInstallRow() ? `
      <button class="tray-row" id="tray-install">
        <span class="tray-row-icon">📲</span>
        <span class="tray-row-label">Add to Home Screen</span>
      </button>
      <div class="tray-divider"></div>
      ` : ''}

      <button class="tray-row" id="tray-signout">
        <span class="tray-row-icon">👋</span>
        <span class="tray-row-label">Sign out</span>
      </button>

      <div class="tray-divider"></div>

      <button class="tray-row danger" id="tray-delete-open">
        <span class="tray-row-icon">🗑️</span>
        <span class="tray-row-label">Delete account</span>
      </button>

      <div id="tray-delete-confirm" style="display:none">
        <div class="tray-divider"></div>
        <div class="tray-section">
          <p style="font-size:0.85rem;color:#666;margin-bottom:10px">
            Your full log will be downloaded as a CSV, then your account will be permanently deleted.
            Type <strong>DELETE</strong> to confirm.
          </p>
          <input class="form-input" type="text" id="tray-delete-input" placeholder="Type DELETE" autocomplete="off" />
          <div class="form-error" id="tray-delete-error"></div>
          <button class="danger-btn" id="tray-delete-submit" style="margin-top:10px">Delete my account</button>
          <button class="btn-cancel" id="tray-delete-cancel" style="margin-top:8px;width:100%;text-align:center">Cancel</button>
        </div>
      </div>

      <div class="tray-feedback">
        Feedback? Requests? Questions?<br>
        <a href="mailto:info@bloatlog.com">info@bloatlog.com</a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  function close() {
    overlay.classList.remove('open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.tray-close').addEventListener('click', close);

  overlay.querySelector('.tray-save-name').addEventListener('click', async () => {
    const name = overlay.querySelector('#tray-display-name').value.trim();
    try {
      await upsertProfile(user.id, { display_name: name || null });
      showToast('✅ Saved');
    } catch (e) {
      alert('Save failed: ' + (e.message || e));
    }
  });

  overlay.querySelector('#tray-install')?.addEventListener('click', () => {
    close();
    showInstallPrompt();
  });

  overlay.querySelector('#tray-signout').addEventListener('click', async () => {
    resetAnalytics();
    await signOut();
    close();
    nav.go('login');
  });

  overlay.querySelector('#tray-delete-open').addEventListener('click', () => {
    overlay.querySelector('#tray-delete-confirm').style.display = 'block';
    overlay.querySelector('#tray-delete-open').style.display = 'none';
    overlay.querySelector('#tray-delete-input').focus();
  });

  overlay.querySelector('#tray-delete-cancel').addEventListener('click', () => {
    overlay.querySelector('#tray-delete-confirm').style.display = 'none';
    overlay.querySelector('#tray-delete-open').style.display = 'flex';
    overlay.querySelector('#tray-delete-input').value = '';
    overlay.querySelector('#tray-delete-error').classList.remove('show');
  });

  overlay.querySelector('#tray-delete-submit').addEventListener('click', async () => {
    const val = overlay.querySelector('#tray-delete-input').value.trim();
    const errEl = overlay.querySelector('#tray-delete-error');
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
      downloadCSV(entries);
      await deleteAllEntries(user.id);
      await deleteProfile(user.id);
      track('account_deleted');
      resetAnalytics();
      await signOut();
      close();
      nav.go('login');
    } catch (e) {
      alert('Delete failed: ' + (e.message || e));
    }
  });
}

