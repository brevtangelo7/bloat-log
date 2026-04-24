let toastEl = null;
let hideTimer = null;

function ensureEl() {
  if (toastEl) return toastEl;
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  document.body.appendChild(toastEl);
  return toastEl;
}

export function showToast(msg) {
  const el = ensureEl();
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
