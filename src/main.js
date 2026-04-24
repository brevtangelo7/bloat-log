import { getSession, onAuthChange, isAdminUser } from './auth.js';
import { initAnalytics, identify } from './analytics.js';
import { getProfile, upsertProfile, updateLastSeen } from './db.js';
import { renderLoginPage } from './pages/login.js';
import { renderAppPage } from './pages/app.js';
import { renderSettingsPage } from './pages/settings.js';
import { renderAdminPage } from './pages/admin.js';
import { captureInstallEvent, showInstallPrompt, shouldShowInstallPrompt } from './components/installPrompt.js';

const root = document.getElementById('root');

let current = { user: null, profile: null, isAdmin: false };
let currentRoute = null;

const ROUTES = ['login', 'app', 'settings', 'admin'];

function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
  if (ROUTES.includes(h)) return h;
  return null;
}

function setHash(route) {
  if (window.location.hash !== `#/${route}`) {
    window.location.hash = `#/${route}`;
  }
}

const nav = {
  go(route) {
    if (!ROUTES.includes(route)) route = 'app';
    setHash(route);
    render(route);
  },
};

async function render(requested) {
  const session = await getSession();

  if (!session) {
    currentRoute = 'login';
    setHash('login');
    renderLoginPage(root);
    return;
  }

  if (!current.user || current.user.id !== session.user.id) {
    current.user = session.user;
    current.isAdmin = isAdminUser(current.user);
    try {
      await upsertProfile(current.user.id, { last_seen_at: new Date().toISOString() });
      current.profile = await getProfile(current.user.id);
      identify(current.user, current.profile);
    } catch (e) {
      console.warn('Profile load failed', e);
    }
  }

  let route = requested || parseHash() || 'app';
  if (route === 'login') route = 'app';
  if (route === 'admin' && !current.isAdmin) route = 'app';
  currentRoute = route;
  setHash(route);

  if (route === 'app') {
    await renderAppPage(root, current, nav);
  } else if (route === 'settings') {
    renderSettingsPage(root, current, nav);
  } else if (route === 'admin') {
    await renderAdminPage(root, current, nav);
  }
}

// Auth state changes → re-render
onAuthChange(async (event, session) => {
  if (event === 'SIGNED_OUT') {
    current = { user: null, profile: null, isAdmin: false };
    renderLoginPage(root);
    setHash('login');
    return;
  }
  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
    if (session) {
      // Force profile refresh on sign-in
      current.user = null;
      await render(parseHash() || 'app');
      if (event === 'SIGNED_IN' && shouldShowInstallPrompt()) {
        setTimeout(showInstallPrompt, 800);
      }
    }
  }
});

// Hash change (user clicks back/forward)
window.addEventListener('hashchange', () => {
  if (!current.user) return;
  const r = parseHash() || 'app';
  if (r === currentRoute) return;
  render(r);
});

// PWA service worker registration (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(base + 'sw.js').catch(err => {
      console.warn('SW registration failed', err);
    });
  });
}

// Capture PWA install event as early as possible
captureInstallEvent();

// Boot
initAnalytics();
render(parseHash()).catch(err => {
  console.error('Render failed', err);
  root.innerHTML = `<div class="auth-shell"><div class="auth-card"><h1 class="auth-title">Bloat Log</h1><p class="auth-sub">Something went wrong loading the app.</p><pre style="font-size:0.8rem;color:#E11D48;white-space:pre-wrap">${String(err?.message || err)}</pre></div></div>`;
});
