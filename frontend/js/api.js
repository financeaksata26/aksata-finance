// ============================================================
// api.js – Wrapper untuk semua panggilan ke GAS backend
// ============================================================

const API = {

  async get(action, params = {}) {
    const token = Auth.getToken();
    const qs    = new URLSearchParams({ action, token, ...params }).toString();
    const res   = await fetch(`${GAS_URL}?${qs}`);
    return res.json();
  },

  async post(action, body = {}) {
    const token = Auth.getToken();
    const res   = await fetch(GAS_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ action, token, ...body }),
    });
    return res.json();
  },

  // ── AUTH ───────────────────────────────────────────────────
  login    : (password) => API.post('login', { password }),
  logout   : ()         => API.post('logout'),
  ping     : ()         => API.get('ping'),
  setup    : ()         => API.get('setup'),

  // ── DASHBOARD ──────────────────────────────────────────────
  dashboard    : (year)   => API.get('dashboard', { year }),
  monthlyChart : (year)   => API.get('monthly_chart', { year }),
  topProducts  : (p = {}) => API.get('top_products', p),

  // ── INCOME SUMMARY ─────────────────────────────────────────
  incomeSummary: (p = {}) => API.get('income_summary', p),

  // ── COGS ───────────────────────────────────────────────────
  getCOGS  : ()     => API.get('cogs'),
  saveCOGS : (data) => API.post('save_cogs', { data }),

  // ── CASH TRANSACTIONS ──────────────────────────────────────
  getCashTx    : (p = {})      => API.get('cash_transactions', p),
  saveCashTx   : (data)        => API.post('save_cash_tx',    { data }),
  updateCashTx : (id, data)    => API.post('update_cash_tx',  { id, data }),
  deleteCashTx : (id)          => API.post('delete_cash_tx',  { id }),

  // ── FINANCIAL REPORT ───────────────────────────────────────
  financialReport: (p = {}) => API.get('financial_report', p),

  // ── UPLOAD ─────────────────────────────────────────────────
  uploadShopeeOrders : (data, meta) => API.post('upload_shopee_orders', { data, meta }),
  uploadShopeeIncome : (data, meta) => API.post('upload_shopee_income', { data, meta }),
  uploadTikTokIncome : (data, meta) => API.post('upload_tiktok_income', { data, meta }),
  uploadTikTokOrders : (data, meta) => API.post('upload_tiktok_orders', { data, meta }),
};
