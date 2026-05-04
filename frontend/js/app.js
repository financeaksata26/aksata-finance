// ============================================================
// app.js – Main App Logic (Dashboard, COGS, Cash, Financial)
// ============================================================

// ── UI HELPERS ────────────────────────────────────────────────

const UI = {
  fmt(n) {
    return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
  },

  fmtShort(n) {
    n = Math.round(n || 0);
    if (n >= 1_000_000_000) return 'Rp ' + (n / 1_000_000_000).toFixed(1) + ' M';
    if (n >= 1_000_000)     return 'Rp ' + (n / 1_000_000).toFixed(1) + ' jt';
    return 'Rp ' + n.toLocaleString('id-ID');
  },

  setStatus(el, type, msg) {
    if (!el) return;
    const cls = { parsing: 'text-warning', uploading: 'text-info', success: 'text-success', error: 'text-danger' };
    el.className = 'mt-2 small ' + (cls[type] || '');
    el.textContent = msg;
  },

  showLoading(id, show = true) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('d-none', !show);
  },

  showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const id  = 'toast_' + Date.now();
    const cls = type === 'error' ? 'bg-danger' : 'bg-success';
    container.insertAdjacentHTML('beforeend', `
      <div id="${id}" class="toast align-items-center text-white ${cls} border-0" role="alert">
        <div class="d-flex">
          <div class="toast-body">${msg}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>`);
    const t = new bootstrap.Toast(document.getElementById(id), { delay: 3000 });
    t.show();
  },

  navigate(section) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById('section-' + section);
    if (target) target.classList.remove('d-none');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navLink = document.querySelector(`.nav-link[data-section="${section}"]`);
    if (navLink) navLink.classList.add('active');

    // Load content for the section
    Pages.load(section);

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth < 992) {
      sidebar.classList.remove('show');
    }

    window.location.hash = section;
  },
};

// ── CHART INSTANCES ───────────────────────────────────────────

const Charts = {
  monthlyLine : null,
  platformPie : null,
  productBar  : null,

  destroy(chart) {
    if (chart) { try { chart.destroy(); } catch (_) {} }
  },

  COLORS: {
    shopee : '#EE4D2D',
    tiktok : '#010101',
    profit : '#4CAF50',
    blue   : '#1565C0',
  },

  drawMonthlyLine(data, year) {
    this.destroy(this.monthlyLine);
    const ctx    = document.getElementById('monthlyChart');
    if (!ctx) return;
    const labels = data.map(d => d.month.substring(5)); // "MM"
    this.monthlyLine = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label          : 'Shopee',
            data           : data.map(d => d.shopee),
            borderColor    : this.COLORS.shopee,
            backgroundColor: this.COLORS.shopee + '22',
            fill           : true,
            tension        : 0.4,
          },
          {
            label          : 'TikTok',
            data           : data.map(d => d.tiktok),
            borderColor    : '#555',
            backgroundColor: '#55555522',
            fill           : true,
            tension        : 0.4,
          },
          {
            label          : 'Total',
            data           : data.map(d => d.total),
            borderColor    : this.COLORS.blue,
            backgroundColor: this.COLORS.blue + '22',
            fill           : false,
            tension        : 0.4,
            borderDash     : [5, 5],
          },
        ],
      },
      options: {
        responsive      : true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => UI.fmt(ctx.parsed.y),
            },
          },
        },
        scales: {
          y: {
            ticks: {
              callback: v => UI.fmtShort(v),
            },
          },
        },
      },
    });
  },

  drawPlatformPie(shopee, tiktok) {
    this.destroy(this.platformPie);
    const ctx = document.getElementById('platformPieChart');
    if (!ctx) return;
    this.platformPie = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels  : ['Shopee', 'TikTok'],
        datasets: [{
          data           : [shopee, tiktok],
          backgroundColor: [this.COLORS.shopee, '#555'],
          borderWidth    : 3,
        }],
      },
      options: {
        responsive : true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => ctx.label + ': ' + UI.fmt(ctx.parsed),
            },
          },
        },
      },
    });
  },

  drawProductBar(products) {
    this.destroy(this.productBar);
    const ctx = document.getElementById('productBarChart');
    if (!ctx) return;
    this.productBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels  : products.map(p => p.name.length > 25 ? p.name.substring(0, 22) + '...' : p.name),
        datasets: [{
          label          : 'Qty Terjual',
          data           : products.map(p => p.qty),
          backgroundColor: this.COLORS.blue,
        }],
      },
      options: {
        indexAxis : 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  },
};

// ── PAGE CONTROLLERS ──────────────────────────────────────────

const Pages = {
  loaded: {},

  async load(section) {
    if (this[section]) this[section]();
  },

  // ── DASHBOARD ──────────────────────────────────────────────

  async dashboard() {
    const year = document.getElementById('dashYear')?.value
      || new Date().getFullYear().toString();

    UI.showLoading('dashLoading', true);
    try {
      const [dash, products] = await Promise.all([
        API.dashboard(year),
        API.topProducts({ year, limit: 10 }),
      ]);

      if (dash.success) {
        const c = dash.cards;
        setText('cardShopeeRev',    UI.fmtShort(c.shopeeRevenue));
        setText('cardTikTokRev',    UI.fmtShort(c.tiktokRevenue));
        setText('cardTotalRev',     UI.fmtShort(c.totalRevenue));
        setText('cardShopeeOrders', c.shopeeOrders.toLocaleString('id-ID'));
        setText('cardTikTokOrders', c.tiktokOrders.toLocaleString('id-ID'));
        setText('cardTotalOrders',  c.totalOrders.toLocaleString('id-ID'));

        Charts.drawMonthlyLine(dash.monthlyChart, year);
        Charts.drawPlatformPie(c.shopeeRevenue, c.tiktokRevenue);
      }

      if (products.success) {
        Charts.drawProductBar(products.products);
        renderProductTable('productTable', products.products);
      }
    } catch (e) {
      UI.showToast('Gagal memuat dashboard: ' + e.message, 'error');
    }
    UI.showLoading('dashLoading', false);
  },

  // ── INCOME SUMMARY ─────────────────────────────────────────

  async income() {
    const bulan    = document.getElementById('incomeBulan')?.value || '';
    const platform = document.getElementById('incomePlatform')?.value || 'all';

    UI.showLoading('incomeLoading', true);
    try {
      const res = await API.incomeSummary({ bulan, platform });
      if (res.success) {
        renderIncomeSummary(res);
      }
    } catch (e) {
      UI.showToast('Gagal memuat income summary: ' + e.message, 'error');
    }
    UI.showLoading('incomeLoading', false);
  },

  // ── COGS ───────────────────────────────────────────────────

  async cogs() {
    UI.showLoading('cogsLoading', true);
    try {
      const res = await API.getCOGS();
      if (res.success) renderCOGSTable(res.rows);
    } catch (e) {
      UI.showToast('Gagal memuat COGS: ' + e.message, 'error');
    }
    UI.showLoading('cogsLoading', false);
  },

  // ── CASH TRANSACTIONS ──────────────────────────────────────

  async cash() {
    const bulan = document.getElementById('cashBulan')?.value || '';
    UI.showLoading('cashLoading', true);
    try {
      const res = await API.getCashTx({ bulan });
      if (res.success) renderCashTransactions(res);
    } catch (e) {
      UI.showToast('Gagal memuat transaksi: ' + e.message, 'error');
    }
    UI.showLoading('cashLoading', false);
  },

  // ── FINANCIAL REPORT ───────────────────────────────────────

  async financial() {
    const bulan    = document.getElementById('financialBulan')?.value || '';
    const platform = document.getElementById('financialPlatform')?.value || 'all';

    UI.showLoading('financialLoading', true);
    try {
      const res = await API.financialReport({ bulan, platform });
      if (res.success) renderFinancialReport(res);
    } catch (e) {
      UI.showToast('Gagal memuat laporan: ' + e.message, 'error');
    }
    UI.showLoading('financialLoading', false);
  },
};

// ── RENDER FUNCTIONS ──────────────────────────────────────────

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderProductTable(tableId, products) {
  const el = document.getElementById(tableId);
  if (!el) return;
  el.innerHTML = products.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.name}</td>
      <td class="text-end">${p.qty.toLocaleString('id-ID')}</td>
      <td class="text-end">${UI.fmt(p.revenue)}</td>
    </tr>`).join('');
}

function renderIncomeSummary(res) {
  setText('incomeGross',    UI.fmt(res.total.grossRevenue));
  setText('incomeNet',      UI.fmt(res.total.netIncome));
  setText('incomeFees',     UI.fmt(res.total.totalFees));
  setText('incomeHPP',      UI.fmt(res.total.hpp));
  setText('incomeLaba',     UI.fmt(res.total.labaKotor));

  const tbody = document.getElementById('incomeTable');
  if (!tbody) return;
  tbody.innerHTML = res.rows.slice(0, 500).map(r => `
    <tr>
      <td><span class="badge ${r.platform === 'Shopee' ? 'bg-danger' : 'bg-dark'}">${r.platform}</span></td>
      <td class="small">${r.orderId || '-'}</td>
      <td class="small">${r.tanggalDana || '-'}</td>
      <td>${r.namaProduk || '-'}</td>
      <td class="text-center">${r.qty || '-'}</td>
      <td class="text-end">${UI.fmt(r.grossRevenue)}</td>
      <td class="text-end text-danger">${UI.fmt(r.totalFees)}</td>
      <td class="text-end fw-bold">${UI.fmt(r.netIncome)}</td>
      <td class="text-end">${UI.fmt(r.hpp)}</td>
      <td class="text-end ${r.labaKotor < 0 ? 'text-danger' : 'text-success'}">${UI.fmt(r.labaKotor)}</td>
    </tr>`).join('');
}

// ── COGS TABLE ────────────────────────────────────────────────

let cogsEdited = {};

function renderCOGSTable(rows) {
  cogsEdited = {};
  const tbody = document.getElementById('cogsTable');
  if (!tbody) return;
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r['Nama Produk'] || ''}</td>
      <td>${r['SKU'] || ''}</td>
      <td>
        <input type="number" class="form-control form-control-sm hpp-input text-end"
          data-sku="${r['SKU']}" data-nama="${r['Nama Produk']}"
          value="${r['HPP (Rp)'] || 0}" min="0" step="500">
      </td>
      <td class="small text-muted">${r['Last Updated'] || '-'}</td>
    </tr>`).join('');

  document.querySelectorAll('.hpp-input').forEach(inp => {
    inp.addEventListener('change', () => {
      cogsEdited[inp.dataset.sku] = {
        sku       : inp.dataset.sku,
        namaProduk: inp.dataset.nama,
        hpp       : parseFloat(inp.value) || 0,
      };
    });
  });
}

async function saveCOGS() {
  const data = Object.values(cogsEdited);
  if (!data.length) { UI.showToast('Tidak ada perubahan HPP', 'error'); return; }

  const btn = document.getElementById('saveCogsBtn');
  btn.disabled = true;
  try {
    const res = await API.saveCOGS(data);
    if (res.success) {
      UI.showToast(`✅ ${res.updated} HPP berhasil disimpan`);
      cogsEdited = {};
      Pages.cogs();
    } else {
      UI.showToast('❌ ' + res.error, 'error');
    }
  } catch (e) {
    UI.showToast('❌ ' + e.message, 'error');
  }
  btn.disabled = false;
}

// ── CASH TRANSACTIONS ─────────────────────────────────────────

const EXPENSE_CATEGORIES = {
  'Gaji & SDM'    : ['Gaji Karyawan'],
  'Marketing'     : ['Shopee Ads','TikTok Ads','Meta Ads','Content Creator','Photoshoot','Endorsement','R&D'],
  'Utilitas'      : ['Listrik','Air','IPL','Internet'],
  'Pengiriman'    : ['Biaya Kirim','Packaging'],
  'Lainnya'       : ['Lainnya'],
};

function renderCashTransactions(res) {
  setText('cashTotalIncome',  UI.fmt(res.totalIncome));
  setText('cashTotalExpense', UI.fmt(res.totalExpense));
  setText('cashNetCash',      UI.fmt(res.netCash));

  const tbody = document.getElementById('cashTable');
  if (!tbody) return;
  tbody.innerHTML = res.rows.map(r => `
    <tr>
      <td class="small">${r['Tanggal'] || ''}</td>
      <td>
        <span class="badge ${r['Jenis'] === 'Income' ? 'bg-success' : 'bg-danger'}">
          ${r['Jenis'] || ''}
        </span>
      </td>
      <td>${r['Kategori'] || ''}</td>
      <td class="small">${r['Sub-Kategori'] || ''}</td>
      <td>${r['Keterangan'] || ''}</td>
      <td class="text-end fw-bold">${UI.fmt(r['Jumlah (Rp)'])}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editCashTx('${r['ID']}')">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteCashTxUI('${r['ID']}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`).join('');
}

async function deleteCashTxUI(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  try {
    const res = await API.deleteCashTx(id);
    if (res.success) { UI.showToast('Transaksi dihapus'); Pages.cash(); }
    else UI.showToast('❌ ' + res.error, 'error');
  } catch (e) {
    UI.showToast('❌ ' + e.message, 'error');
  }
}

function editCashTx(id) {
  // Find row in current table
  UI.showToast('Edit via form di bawah (ID: ' + id + ')');
}

async function saveCashTxForm() {
  const data = {
    tanggal    : document.getElementById('ctTanggal')?.value    || '',
    jenis      : document.getElementById('ctJenis')?.value      || '',
    kategori   : document.getElementById('ctKategori')?.value   || '',
    subKategori: document.getElementById('ctSubKategori')?.value || '',
    keterangan : document.getElementById('ctKeterangan')?.value || '',
    jumlah     : document.getElementById('ctJumlah')?.value     || 0,
  };

  const btn = document.getElementById('saveCashTxBtn');
  btn.disabled = true;
  try {
    const res = await API.saveCashTx(data);
    if (res.success) {
      UI.showToast('✅ Transaksi disimpan (ID: ' + res.id + ')');
      Pages.cash();
      // Reset form
      ['ctTanggal','ctJenis','ctKategori','ctSubKategori','ctKeterangan','ctJumlah']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    } else {
      UI.showToast('❌ ' + res.error, 'error');
    }
  } catch (e) {
    UI.showToast('❌ ' + e.message, 'error');
  }
  btn.disabled = false;
}

// ── FINANCIAL REPORT ──────────────────────────────────────────

function renderFinancialReport(res) {
  const platform = document.getElementById('financialPlatform')?.value || 'all';
  const data = platform === 'shopee' ? res.shopee
             : platform === 'tiktok' ? res.tiktok
             : res.combined;

  setText('finTotalRevenue',  UI.fmt(data.totalRevenue));
  setText('finPlatformFees',  UI.fmt(data.platformFees));
  setText('finNetReceived',   UI.fmt(data.netReceived));
  setText('finHPP',           UI.fmt(data.hpp));
  setText('finGrossProfit',   UI.fmt(data.grossProfit));
  setText('finTotalOpex',     UI.fmt(res.totalOpex));
  setText('finNetProfit',     UI.fmt(data.grossProfit - res.totalOpex));

  const tbody = document.getElementById('expenseTable');
  if (!tbody) return;
  tbody.innerHTML = Object.entries(res.expenseBreakdown || {}).map(([k, v]) => `
    <tr>
      <td>${k}</td>
      <td class="text-end">${UI.fmt(v)}</td>
    </tr>`).join('');
}

// ── UPLOAD PAGE HANDLERS ──────────────────────────────────────

function initUploadListeners() {
  const bindings = [
    ['fileShopeeIncome',  'statusShopeeIncome',  handleUploadShopeeIncome],
    ['fileShopeeOrderN',  'statusShopeeOrderN',  handleUploadShopeeOrders],
    ['fileShopeeOrderN1', 'statusShopeeOrderN1', handleUploadShopeeOrders],
    ['fileTikTokIncome',  'statusTikTokIncome',  handleUploadTikTokIncome],
    ['fileTikTokOrders',  'statusTikTokOrders',  handleUploadTikTokOrders],
  ];
  bindings.forEach(([fileId, statusId, handler]) => {
    const inp = document.getElementById(fileId);
    const sts = document.getElementById(statusId);
    if (inp && sts) {
      inp.addEventListener('change', async () => {
        if (inp.files[0]) await handler(inp.files[0], sts);
      });
    }
  });
}

// ── INIT ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('mainApp')) return;

  // Nav links
  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      UI.navigate(link.dataset.section);
    });
  });

  // Sidebar toggle (mobile)
  const toggler = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggler && sidebar) {
    toggler.addEventListener('click', () => sidebar.classList.toggle('show'));
  }

  // Year filter on dashboard
  const dashYear = document.getElementById('dashYear');
  if (dashYear) dashYear.addEventListener('change', () => Pages.dashboard());

  // Load initial section from hash
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  UI.navigate(hash);

  // Init upload listeners
  initUploadListeners();
});
