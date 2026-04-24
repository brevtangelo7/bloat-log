export function renderTabBar(active, onChange) {
  const nav = document.createElement('nav');
  nav.className = 'tab-bar';
  nav.innerHTML = `
    <button class="tab-btn ${active === 'log' ? 'active' : ''}" data-tab="log">Log</button>
    <button class="tab-btn ${active === 'history' ? 'active' : ''}" data-tab="history">History</button>
    <button class="tab-btn ${active === 'charts' ? 'active' : ''}" data-tab="charts">Patterns</button>
    <button class="tab-coffee" id="bmc-btn" title="Buy Me a Coffee">☕</button>
  `;
  nav.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) { onChange(btn.dataset.tab); return; }

    if (e.target.closest('#bmc-btn')) {
      let pop = document.getElementById('bmc-popover');
      if (pop) { pop.remove(); return; }
      pop = document.createElement('div');
      pop.id = 'bmc-popover';
      pop.innerHTML = `Like the tool? <a href="https://buymeacoffee.com/jessisfamiliar" target="_blank" rel="noopener noreferrer">Buy me a coffee ☕</a>`;
      document.body.appendChild(pop);
      setTimeout(() => document.addEventListener('click', function dismiss(ev) {
        if (!ev.target.closest('#bmc-popover') && !ev.target.closest('#bmc-btn')) {
          pop.remove();
          document.removeEventListener('click', dismiss);
        }
      }), 0);
    }
  });
  return nav;
}

export function renderHeader({ title = 'Bloat Log', showSettings = true, isAdmin = false, onSettings, onAdmin, onLogoClick } = {}) {
  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <h1 class="header-logo" style="cursor:pointer">${title}</h1>
    <div class="header-actions">
      ${isAdmin ? '<button class="icon-btn" data-action="admin" title="Admin">🛠️</button>' : ''}
      ${showSettings ? '<button class="icon-btn" data-action="settings" title="Settings">☰</button>' : ''}
    </div>
  `;
  header.addEventListener('click', e => {
    if (e.target.closest('.header-logo')) { onLogoClick?.(); return; }
    const btn = e.target.closest('.icon-btn');
    if (!btn) return;
    if (btn.dataset.action === 'settings') onSettings?.();
    if (btn.dataset.action === 'admin') onAdmin?.();
  });
  return header;
}
