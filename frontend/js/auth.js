// ============================================================
// auth.js – Login / Logout / Session management
// ============================================================

const Auth = {
  TOKEN_KEY: 'aksata_token',

  getToken()        { return localStorage.getItem(this.TOKEN_KEY) || ''; },
  setToken(t)       { localStorage.setItem(this.TOKEN_KEY, t); },
  clearToken()      { localStorage.removeItem(this.TOKEN_KEY); },
  isLoggedIn()      { return !!this.getToken(); },

  async login(password) {
    try {
      const res = await API.login(password);
      if (res.success) {
        this.setToken(res.token);
        return { success: true };
      }
      return { success: false, error: res.error || 'Password salah' };
    } catch (e) {
      return { success: false, error: 'Gagal menghubungi server. Periksa koneksi internet.' };
    }
  },

  async logout() {
    try { await API.logout(); } catch (_) {}
    this.clearToken();
    window.location.href = 'index.html';
  },
};

// ── Login form handler ────────────────────────────────────────
if (document.getElementById('loginForm')) {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    const btn      = document.getElementById('loginBtn');
    const errDiv   = document.getElementById('loginError');

    btn.disabled    = true;
    btn.innerHTML   = '<span class="spinner-border spinner-border-sm me-2"></span>Masuk...';
    errDiv.classList.add('d-none');

    const result = await Auth.login(password);

    if (result.success) {
      window.location.href = 'app.html';
    } else {
      errDiv.textContent = result.error;
      errDiv.classList.remove('d-none');
      btn.disabled  = false;
      btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Masuk';
    }
  });

  // Redirect jika sudah login
  if (Auth.isLoggedIn()) window.location.href = 'app.html';
}

// ── App guard ─────────────────────────────────────────────────
if (document.getElementById('mainApp')) {
  if (!Auth.isLoggedIn()) window.location.href = 'index.html';
  document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
}
