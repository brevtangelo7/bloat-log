const STORAGE_KEY = 'bloatlog_install_shown';
const MAX_SESSIONS = 5;

let deferredPrompt = null;

export function captureInstallEvent() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    localStorage.setItem(STORAGE_KEY, '99');
    deferredPrompt = null;
  });
}

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    ('ontouchstart' in window && window.screen.width < 768);
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function getShownCount() {
  return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
}

export function shouldShowInstallPrompt() {
  if (isStandalone()) return false;
  if (!isMobile()) return false;
  if (getShownCount() >= MAX_SESSIONS) return false;
  return true;
}

// For the settings tray — show whenever not already installed, regardless of session count
export function canShowInstallRow() {
  return !isStandalone();
}

export function showInstallPrompt() {
  if (isStandalone()) return;
  document.getElementById('install-overlay')?.remove();

  // Increment session count
  const count = getShownCount();
  if (count < 99) localStorage.setItem(STORAGE_KEY, count + 1);

  const ios = isIOS();
  const overlay = document.createElement('div');
  overlay.id = 'install-overlay';
  overlay.className = 'install-overlay';
  overlay.innerHTML = `
    <div class="install-card">
      <h3>📲 Quick! Save to your home screen for easy logging.</h3>
      ${ios ? `
        <ol>
          <li>Tap the <strong>Share</strong> button ⬆️ in Safari</li>
          <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
          <li>Tap <strong>"Add"</strong></li>
        </ol>
      ` : `
        <p>Add Bloat Log to your home screen to open it instantly, any time.</p>
        <button class="install-btn" id="install-confirm">Add to Home Screen</button>
      `}
      <button class="install-dismiss" id="install-dismiss">Not now</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#install-dismiss').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  if (!ios) {
    overlay.querySelector('#install-confirm')?.addEventListener('click', async () => {
      overlay.remove();
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') localStorage.setItem(STORAGE_KEY, '99');
        deferredPrompt = null;
      }
    });
  }
}
