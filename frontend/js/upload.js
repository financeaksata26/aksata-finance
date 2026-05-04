// ============================================================
// upload.js – File upload dengan SheetJS parsing
// ============================================================

const Upload = {
  // Status per slot
  status: {
    shopeeIncome  : null,
    shopeeOrderN  : null,
    shopeeOrderN1 : null,
    tiktokIncome  : null,
    tiktokOrders  : null,
  },

  // ── CORE PARSER ──────────────────────────────────────────────

  async parseExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb    = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
          resolve(wb);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  },

  sheetToJSON(ws, headerRow = 0) {
    const ref  = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const rows = [];
    const hdrs = [];

    // Read header row
    for (let c = ref.s.c; c <= ref.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
      hdrs.push(cell ? String(cell.v).trim() : `col_${c}`);
    }

    // Read data rows
    for (let r = headerRow + 1; r <= ref.e.r; r++) {
      const row = {};
      let empty = true;
      for (let c = ref.s.c; c <= ref.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        const val  = cell ? cell.v : '';
        row[hdrs[c - ref.s.c]] = val;
        if (val !== '' && val !== null && val !== undefined) empty = false;
      }
      if (!empty) rows.push(row);
    }
    return rows;
  },

  // ── SHOPEE INCOME ────────────────────────────────────────────

  async parseShopeeIncome(file) {
    const wb     = await this.parseExcel(file);
    const ws     = wb.Sheets['Income'];
    if (!ws) throw new Error('Sheet "Income" tidak ditemukan');

    const raw  = this.sheetToJSON(ws, 5); // header at row 5 (0-indexed)

    return raw
      .filter(r => r['No. Pesanan'])
      .map(r => ({
        'No. Pesanan'               : String(r['No. Pesanan'] || '').trim(),
        'Username Pembeli'          : r['Username (Pembeli)']                     || '',
        'Waktu Pesanan Dibuat'      : this.fmtDate(r['Waktu Pesanan Dibuat']),
        'Metode Pembayaran'         : r['Metode pembayaran pembeli']               || '',
        'Tanggal Dana Dilepas'      : this.fmtDate(r['Tanggal Dana Dilepaskan']),
        'Harga Asli Produk'         : this.num(r['Harga Asli Produk']),
        'Total Diskon Produk'       : this.num(r['Total Diskon Produk']),
        'Refund ke Pembeli'         : this.num(r['Jumlah Pengembalian Dana ke Pembeli']),
        'Diskon Shopee'             : this.num(r['Diskon Produk dari Shopee']),
        'Voucher Penjual'           : this.num(r['Voucher disponsor oleh Penjual']),
        'Voucher Co-fund Penjual'   : this.num(r['Voucher co-fund disponsor oleh Penjual']),
        'Cashback Koin Penjual'     : this.num(r['Cashback Koin disponsori Penjual']),
        'Cashback Koin Co-fund'     : this.num(r['Cashback Koin Co-fund disponsori Penjual']),
        'Ongkir Dibayar Pembeli'    : this.num(r['Ongkir Dibayar Pembeli']),
        'Diskon Ongkir Jasa Kirim'  : this.num(r['Diskon Ongkir Ditanggung Jasa Kirim']),
        'Gratis Ongkir Shopee'      : this.num(r['Gratis Ongkir dari Shopee']),
        'Ongkir Diteruskan ke JNE'  : this.num(r['Ongkir yang Diteruskan oleh Shopee ke Jasa Kirim']),
        'Ongkir Return'             : this.num(r['Ongkos Kirim Pengembalian Barang']),
        'Biaya Admin'               : this.num(r['Biaya Administrasi']),
        'Biaya Layanan'             : this.num(r['Biaya Layanan']),
        'Biaya Proses Pesanan'      : this.num(r['Biaya Proses Pesanan']),
        'Biaya Hemat Ongkir'        : this.num(r['Biaya Program Hemat Biaya Kirim']),
        'Biaya Transaksi'           : this.num(r['Biaya Transaksi']),
        'Biaya Kampanye'            : this.num(r['Biaya Kampanye']),
        'Total Penghasilan'         : this.num(r['Total Penghasilan']),
        'Jasa Kirim'                : r['Jasa Kirim']                             || '',
        'Nama Kurir'                : r['Nama Kurir']                             || '',
      }));
  },

  // ── SHOPEE ORDERS ────────────────────────────────────────────

  async parseShopeeOrders(file) {
    const wb  = await this.parseExcel(file);
    const ws  = wb.Sheets['orders'];
    if (!ws) throw new Error('Sheet "orders" tidak ditemukan');

    const raw = this.sheetToJSON(ws, 0);

    return raw
      .filter(r => r['No. Pesanan'])
      .map(r => ({
        'No. Pesanan'           : String(r['No. Pesanan'] || '').trim(),
        'Status Pesanan'        : r['Status Pesanan']       || '',
        'Alasan Pembatalan'     : r['Alasan Pembatalan']    || '',
        'Status Return'         : r['Status Pembatalan/ Pengembalian'] || '',
        'No. Resi'              : r['No. Resi']             || '',
        'Opsi Pengiriman'       : r['Opsi Pengiriman']      || '',
        'Waktu Pesanan Dibuat'  : this.fmtDate(r['Waktu Pesanan Dibuat']),
        'Waktu Pembayaran'      : this.fmtDate(r['Waktu Pembayaran Dilakukan']),
        'Metode Pembayaran'     : r['Metode Pembayaran']    || '',
        'SKU Induk'             : r['SKU Induk']            || '',
        'Nama Produk'           : r['Nama Produk']          || '',
        'Nomor Referensi SKU'   : r['Nomor Referensi SKU']  || '',
        'Nama Variasi'          : r['Nama Variasi']         || '',
        'Harga Awal'            : this.num(r['Harga Awal']),
        'Harga Setelah Diskon'  : this.num(r['Harga Setelah Diskon']),
        'Jumlah'                : this.num(r['Jumlah']),
        'Returned Qty'          : this.num(r['Returned quantity']),
        'Dibayar Pembeli'       : this.num(r['Dibayar Pembeli']),
        'Total Diskon'          : this.num(r['Total Diskon']),
        'Diskon Penjual'        : this.num(r['Diskon Dari Penjual']),
        'Diskon Shopee'         : this.num(r['Diskon Dari Shopee']),
        'Total Pembayaran'      : this.num(r['Total Pembayaran']),
        'Kota'                  : r['Kota/Kabupaten']       || '',
        'Provinsi'              : r['Provinsi']             || '',
        'Waktu Pesanan Selesai' : this.fmtDate(r['Waktu Pesanan Selesai']),
      }));
  },

  // ── TIKTOK INCOME ────────────────────────────────────────────

  async parseTikTokIncome(file) {
    const wb  = await this.parseExcel(file);
    const ws  = wb.Sheets['Order details'];
    if (!ws) throw new Error('Sheet "Order details" tidak ditemukan');

    const raw = this.sheetToJSON(ws, 0);

    return raw
      .filter(r => {
        const id = String(r['Order/adjustment ID  '] || r['Order/adjustment ID'] || '').trim();
        return id && id.length > 5;
      })
      .map(r => ({
        'Order ID'                              : String(r['Order/adjustment ID  '] || r['Order/adjustment ID'] || '').trim(),
        'Type'                                  : String(r['Type '] || r['Type'] || '').trim(),
        'Order Created Time'                    : this.fmtDate(r['Order created time']),
        'Order Settled Time'                    : this.fmtDate(r['Order settled time']),
        'Currency'                              : r['Currency'] || 'IDR',
        'Total Settlement Amount'               : this.num(r['Total settlement amount']),
        'Total Revenue'                         : this.num(r['Total Revenue']),
        'Subtotal After Seller Discounts'       : this.num(r['Subtotal after seller discounts']),
        'Subtotal Before Discounts'             : this.num(r['Subtotal before discounts']),
        'Seller Discounts'                      : this.num(r['Seller discounts']),
        'Refund Subtotal After Seller Disc'     : this.num(r['Refund subtotal after seller discounts']),
        'Refund Subtotal Before Seller Disc'    : this.num(r['Refund subtotal before seller discounts']),
        'Refund Of Seller Discounts'            : this.num(r['Refund of seller discounts']),
        'Total Fees'                            : this.num(r['Total Fees']),
        'Platform Commission Fee'               : this.num(r['Platform commission fee']),
        'Pre-order Service Fee'                 : this.num(r['Pre-order service fee']),
        'Mall Service Fee'                      : this.num(r['Mall service fee']),
        'Payment Fee'                           : this.num(r['Payment Fee']),
        'Shipping Cost'                         : this.num(r['Shipping cost']),
        'Shipping Cost To Logistics'            : this.num(r['Shipping costs passed on to the logistics provider']),
        'Shipping Cost Borne By Platform'       : this.num(r['Shipping cost borne by the platform']),
        'Shipping Cost Paid By Customer'        : this.num(r['Shipping cost paid by the customer']),
        'Refunded Shipping Cost'                : this.num(r['Refunded shipping cost paid by the customer']),
        'Logistics Service Fee'                 : this.num(r['Logistics service fee']),
        'Affiliate Commission'                  : this.num(r['Affiliate Commission']),
        'Affiliate Partner Commission'          : this.num(r['Affiliate partner commission']),
        'Affiliate Shop Ads Commission'         : this.num(r['Affiliate Shop Ads commission']),
        'Dynamic Commission'                    : this.num(r['Dynamic commission']),
        'Bonus Cashback Service Fee'            : this.num(r['Bonus cashback service fee']),
        'LIVE Specials Service Fee'             : this.num(r['LIVE Specials service fee']),
        'Voucher Xtra Service Fee'              : this.num(r['Voucher Xtra service fee']),
        'Order Processing Fee'                  : this.num(r['Order processing fee']),
        'Adjustment Amount'                     : this.num(r['Ajustment amount']),
        'Related Order ID'                      : String(r['Related order ID  '] || r['Related order ID'] || '').trim(),
        'Customer Payment'                      : this.num(r['Customer payment']),
        'Customer Refund'                       : this.num(r['Customer refund']),
        'Seller Co-funded Voucher Discount'     : this.num(r['Seller co-funded voucher discount']),
        'Platform Discounts'                    : this.num(r['Platform discounts']),
        'Platform Co-funded Voucher Discounts'  : this.num(r['Platform co-funded voucher discounts']),
        'Seller Shipping Cost Discount'         : this.num(r['Seller shipping cost discount']),
        'Estimated Weight (g)'                  : this.num(r['Estimated package weight (g)']),
        'Actual Weight (g)'                     : this.num(r['Actual package weight (g)']),
        'Order Source'                          : r['Order Source'] || 'TikTok Shop',
      }));
  },

  // ── TIKTOK ORDERS ────────────────────────────────────────────

  async parseTikTokOrders(file) {
    const wb  = await this.parseExcel(file);
    const ws  = wb.Sheets['OrderSKUList'];
    if (!ws) throw new Error('Sheet "OrderSKUList" tidak ditemukan');

    const raw = this.sheetToJSON(ws, 0);
    return raw
      .filter(r => {
        const id = String(r['Order ID'] || '').trim();
        return id && id !== 'Platform unique order ID.' && /^\d+$/.test(id);
      })
      .map(r => ({ 'Order ID': String(r['Order ID']).trim() }));
  },

  // ── HELPERS ──────────────────────────────────────────────────

  num(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  },

  fmtDate(v) {
    if (!v) return '';
    if (v instanceof Date) {
      return v.toISOString().substring(0, 10);
    }
    const s = String(v).trim();
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    // YYYY/MM/DD
    if (/^\d{4}\/\d{2}\/\d{2}/.test(s)) return s.substring(0, 10).replace(/\//g, '-');
    return s.substring(0, 10);
  },

  monthFromDate(dateStr) {
    if (!dateStr) return '';
    return String(dateStr).substring(0, 7);
  },
};

// ── UI HANDLERS ──────────────────────────────────────────────

async function handleUploadShopeeIncome(file, statusEl) {
  try {
    UI.setStatus(statusEl, 'parsing', 'Membaca file...');
    const data = await Upload.parseShopeeIncome(file);
    const meta = { bulan: data[0] ? Upload.monthFromDate(data[0]['Tanggal Dana Dilepas']) : '' };

    UI.setStatus(statusEl, 'uploading', `Mengirim ${data.length} baris...`);
    const res = await API.uploadShopeeIncome(data, meta);

    if (res.success) {
      UI.setStatus(statusEl, 'success',
        `✅ Berhasil — ${res.inserted} baru, ${res.updated} update (${meta.bulan})`);
    } else {
      UI.setStatus(statusEl, 'error', '❌ ' + (res.error || 'Gagal upload'));
    }
  } catch (e) {
    UI.setStatus(statusEl, 'error', '❌ ' + e.message);
  }
}

async function handleUploadShopeeOrders(file, statusEl) {
  try {
    UI.setStatus(statusEl, 'parsing', 'Membaca file...');
    const data = await Upload.parseShopeeOrders(file);
    const meta = { bulan: data[0] ? Upload.monthFromDate(data[0]['Waktu Pesanan Dibuat']) : '' };

    UI.setStatus(statusEl, 'uploading', `Mengirim ${data.length} baris...`);
    const res = await API.uploadShopeeOrders(data, meta);

    if (res.success) {
      UI.setStatus(statusEl, 'success',
        `✅ Berhasil — ${res.inserted} baru, ${res.updated} update, ${res.skipped} skip (${meta.bulan})`);
    } else {
      UI.setStatus(statusEl, 'error', '❌ ' + (res.error || 'Gagal upload'));
    }
  } catch (e) {
    UI.setStatus(statusEl, 'error', '❌ ' + e.message);
  }
}

async function handleUploadTikTokIncome(file, statusEl) {
  try {
    UI.setStatus(statusEl, 'parsing', 'Membaca file...');
    const data = await Upload.parseTikTokIncome(file);
    // filter only 'Order' type
    const orders = data.filter(r => r['Type'] === 'Order');
    const meta   = { bulan: orders[0] ? Upload.monthFromDate(orders[0]['Order Settled Time']) : '' };

    UI.setStatus(statusEl, 'uploading', `Mengirim ${data.length} baris...`);
    const res = await API.uploadTikTokIncome(data, meta);

    if (res.success) {
      UI.setStatus(statusEl, 'success',
        `✅ Berhasil — ${res.inserted} baru, ${res.updated} update (${meta.bulan})`);
    } else {
      UI.setStatus(statusEl, 'error', '❌ ' + (res.error || 'Gagal upload'));
    }
  } catch (e) {
    UI.setStatus(statusEl, 'error', '❌ ' + e.message);
  }
}

async function handleUploadTikTokOrders(file, statusEl) {
  try {
    UI.setStatus(statusEl, 'parsing', 'Membaca file...');
    const data = await Upload.parseTikTokOrders(file);
    const meta = {};

    UI.setStatus(statusEl, 'uploading', `Mengirim ${data.length} Order ID...`);
    const res = await API.uploadTikTokOrders(data, meta);

    if (res.success) {
      UI.setStatus(statusEl, 'success',
        `✅ Berhasil — ${res.inserted} baru, ${res.skipped} sudah ada`);
    } else {
      UI.setStatus(statusEl, 'error', '❌ ' + (res.error || 'Gagal upload'));
    }
  } catch (e) {
    UI.setStatus(statusEl, 'error', '❌ ' + e.message);
  }
}
