import { sendMagicLink } from '../auth.js';

export function renderLoginPage(root) {
  root.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <h1 class="auth-title">Bloat Log 🌿</h1>
        <p class="auth-sub">Sign in with a magic link</p>
        <div id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-email">Email</label>
            <input class="form-input" type="email" id="login-email" autocomplete="email" placeholder="you@example.com" />
          </div>
          <div class="form-error" id="login-error"></div>
          <button class="btn-primary" id="btn-send">Send Magic Link</button>
        </div>
        <div class="auth-success" id="login-success" style="display:none">
          ✉️ Check your email for a login link
        </div>
      </div>
    </div>
  `;

  const btn = root.querySelector('#btn-send');
  const emailEl = root.querySelector('#login-email');
  const errEl = root.querySelector('#login-error');
  const successEl = root.querySelector('#login-success');
  const formEl = root.querySelector('#login-form');

  emailEl.focus();

  const submit = async () => {
    const email = emailEl.value.trim();
    errEl.classList.remove('show');
    if (!email || !/.+@.+\..+/.test(email)) {
      errEl.textContent = 'Please enter a valid email.';
      errEl.classList.add('show');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await sendMagicLink(email);
      formEl.style.display = 'none';
      successEl.style.display = 'block';
    } catch (e) {
      errEl.textContent = e.message || 'Something went wrong. Try again.';
      errEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Send Magic Link';
    }
  };

  btn.addEventListener('click', submit);
  emailEl.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}
