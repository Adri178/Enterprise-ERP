import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { withFigcraft } from './figcraft-mcp.mjs';

// Native FigCraft interactions only. This script never calls an ERP write endpoint.
const document = 5;
const dashboard = 362;
const commands = [];
const ref = value => typeof value === 'number' ? value : { $ref: value };
const C = { ink: '#20232B', muted: '#626D7E', blue: '#0065DB', line: '#E7EBF2', bg: '#F5F6FA', green: '#287B50' };
let sequence = 0, dialogIndex = 0;
const registry = {}, interactionLog = [];
const snapshot = JSON.parse(readFileSync('.local/figcraft-data.json', 'utf8'));
const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
function command(command, params, as) { commands.push({ command, params, ...(as ? { as } : {}) }); return as; }
function node(type, name, x, y, width, height, parent, props = {}, text) {
  const as = `p${++sequence}`;
  command('node.create', { type, name, x, y, ...(width == null ? {} : { width }), ...(height == null ? {} : { height }), ...(parent == null ? {} : { parent: ref(parent) }), props, ...(text == null ? {} : { text }), select: false }, as);
  return as;
}
const box = (p, name, x, y, w, h, fill = '#FFFFFF', radius = 14) => node('rectangle', name, x, y, w, h, p, { fill, cornerRadius: radius });
const text = (p, value, x, y, size = 15, color = C.ink, weight = 'Regular') => node('text', value.slice(0, 90), x, y, null, null, p, { fontFamily: 'Inter', fontStyle: weight, fontSize: size, fill: color }, value);
function bind(id, variable, field = 'characters') { command('variable.bind', { ids: [ref(id)], field, variable: ref(variable) }); }
function event(id, actions, trigger = { type: 'onClick' }) {
  const list = Array.isArray(actions) ? actions : [actions];
  command('proto.interaction.add', { id: ref(id), trigger, actions: list, transition: { type: 'dissolve' }, durationMs: 180, easing: 'easeOut' });
  interactionLog.push({ source: id, trigger, actions: list });
}
const close = { type: 'closeOverlay' };
const nav = dest => ({ type: 'navigate', dest: ref(dest) });
const overlay = (dest, offset) => ({ type: 'openOverlay', dest: ref(dest), position: offset ? 'manual' : 'center', ...(offset ? { anchor: 'triggerInside', offset } : {}), close_on_outside: true, background: '#17223833' });
function hit(p, name, x, y, w, h, actions) {
  const id = box(p, `Hotspot / ${name}`, x, y, w, h, '#00000000', 12);
  event(id, actions); return id;
}
function button(p, label, x, y, w, actions, primary = false) {
  box(p, label, x, y, w, 44, primary ? C.blue : '#EDF2FA', 22);
  text(p, label, x + 18, y + 13, 14, primary ? '#FFFFFF' : C.ink, 'Medium');
  return hit(p, label, x, y, w, 44, actions);
}
function dialog(key, title, subtitle, w, h) {
  const i = dialogIndex++;
  const id = node('frame', `Prototype / ${key}`, 2200 + (i % 4) * 1050, 3300 + Math.floor(i / 4) * 1000, w, h, null,
    { fill: '#FFFFFFF5', cornerRadius: 28, cornerSmoothing: .65, clip: true, stroke: '#FFFFFF', strokeWeight: 1,
      effects: [{ type: 'backgroundBlur', radius: 24 }, { type: 'dropShadow', color: '#20325324', offset: [0, 12], radius: 40 }] });
  registry[key] = id;
  text(id, title, 28, 28, 24, C.ink, 'SemiBold');
  if (subtitle) text(id, subtitle, 28, 64, 13, C.muted);
  box(id, 'Tutup control', w - 62, 24, 36, 36, '#EDF1F7', 18);
  text(id, '×', w - 51, 29, 22, C.muted);
  hit(id, 'Tutup', w - 62, 24, 36, 36, close);
  event(id, close, { type: 'keyPress', key: 'Escape' });
  return id;
}
function menuRow(p, title, subtitle, y, w, actions) {
  box(p, title, 16, y, w - 32, 64, '#F4F7FC', 16);
  text(p, title, 32, y + 12, 15, C.ink, 'Medium');
  if (subtitle) text(p, subtitle, 32, y + 35, 12, C.muted);
  text(p, '›', w - 43, y + 17, 22, C.muted);
  return hit(p, title, 16, y, w - 32, 64, actions);
}

await withFigcraft(async ({ tool, data }) => {
  const source = data(await tool('get_node', { document, id: dashboard, depth: 20 }));
  if (source.name !== '02 / Apple-inspired — Liquid Glass') throw new Error('Expected Apple Dashboard is not open');
  const current = data(await tool('inspect_document', { document, depth: 1 }));
  if (current.pages.some(p => p.children?.some(n => n.name.startsWith('Prototype /')))) throw new Error('Prototype already exists: refine the existing design instead');
  const sourceHash = createHash('sha256').update(JSON.stringify(source)).digest('hex');
  // Save As keeps the existing comparison artifact untouched on disk.
  await tool('save_file', { document, path: resolve('designs/enterprise-erp-dashboard-prototype.figcraft') });

  command('variable.createCollection', { name: 'Prototype Company', modes: ['Alpha', 'Beta', 'Gamma'] }, 'companyModes');
  const variable = (name, type, values, as) => command('variable.create', { collection: ref('companyModes'), name, type, values }, as);
  variable('Company name', 'string', { Alpha: 'PT Alpha Distribusi', Beta: 'PT Beta Industri', Gamma: 'PT Gamma Digital' }, 'companyName');
  variable('Company context', 'string', { Alpha: 'Snapshot Alpha · 4 Nov 2026', Beta: 'Skenario prototype · tanpa transaksi', Gamma: 'Skenario prototype · tanpa transaksi' }, 'companyContext');
  variable('Show scenario empty', 'boolean', { Alpha: false, Beta: true, Gamma: true }, 'emptyScenario');
  variable('Show Alpha snapshot', 'boolean', { Alpha: true, Beta: false, Gamma: false }, 'alphaScenario');
  for (const [as, value] of [['salesValue', snapshot.sales.sales], ['purchaseValue', snapshot.purchase.purchases], ['inventoryValue', snapshot.purchase.inventoryValue]])
    variable(as, 'string', { Alpha: money(value), Beta: money(0), Gamma: money(0) }, as);
  for (const id of [392, 528, 556]) bind(id, 'companyName');
  bind(557, 'companyContext');
  command('node.set', { ids: [557], props: { x: 495 } });
  for (const [id, variable] of [[580, 'salesValue'], [587, 'purchaseValue'], [618, 'inventoryValue']]) bind(id, variable);
  command('node.set', { ids: [509], props: { characters: 'ADMIN · Prototype' } });
  command('node.set', { ids: [525], props: { characters: 'Ctrl K', x: 1149 } });
  command('node.set', { ids: [731], props: { characters: 'Snapshot prototype', x: 1720 } });
  command('node.set', { ids: [730], props: { x: 1703, fill: '#8291A8' } });
  command('node.set', { ids: [729], props: { characters: 'Prototype interaktif · data Alpha berupa snapshot · tindakan tidak mengubah database ERP.' } });
  const emptyChart = node('frame', 'Scenario / empty chart', 352, 647, 1124, 260, dashboard, { fill: '#FFFFFF', cornerRadius: 16 });
  text(emptyChart, 'Belum ada data untuk ditampilkan', 360, 86, 18, C.ink, 'Medium');
  text(emptyChart, 'Company ini menggunakan skenario kosong pada prototype.', 310, 123, 14, C.muted);
  bind(emptyChart, 'emptyScenario', 'visible');
  for (let id = 623; id <= 647; id++) bind(id, 'alphaScenario', 'visible');
  for (const id of [657, 658]) bind(id, 'alphaScenario', 'visible');
  const approvalTitle = text(dashboard, 'Belum ada Purchase Request', 1564, 744, 14, C.ink, 'Medium'); bind(approvalTitle, 'emptyScenario', 'visible');
  const approvalNote = text(dashboard, 'Skenario Company ini belum memiliki transaksi.', 1548, 769, 11, C.muted); bind(approvalNote, 'emptyScenario', 'visible');
  const emptyTable = node('frame', 'Scenario / empty transactions', 352, 1082, 1504, 276, dashboard, { fill: '#FFFFFF', cornerRadius: 16 });
  text(emptyTable, 'Tidak ada data ditemukan', 610, 88, 18, C.ink, 'Medium');
  text(emptyTable, 'Kembali ke Alpha untuk melihat contoh dokumen.', 585, 126, 14, C.muted);
  bind(emptyTable, 'emptyScenario', 'visible');

  // Company selection changes native variable modes, including totals and empty states.
  const companies = dialog('Company switcher', 'Pilih Perusahaan', 'Satu instalasi ERP · 3 Company demo', 380, 370);
  ['PT Alpha Distribusi', 'PT Beta Industri', 'PT Gamma Digital'].forEach((name, i) => {
    menuRow(companies, name, i === 0 ? 'Snapshot transaksi Alpha' : 'Skenario kosong untuk perbandingan', 102 + i * 78, 380,
      [{ type: 'setVariableMode', collection: ref('companyModes'), mode: ['Alpha', 'Beta', 'Gamma'][i] }, close]);
  });

  // One full-size supporting page; the Dashboard remains the flow's starting point.
  const documents = node('frame', 'Prototype / Daftar Dokumen', 2200, 1660, 1920, 1440, null, { fill: C.bg, clip: true });
  registry.Documents = documents;
  for (const id of [365, 514]) {
    command('edit.duplicate', { ids: [id], dx: 0, dy: 0, map: true }, `copy${id}`);
    command('node.reparent', { ids: [{ $ref: `copy${id}`, field: 'ids/0' }], parent: ref(documents) });
    command('node.set', { ids: [{ $ref: `copy${id}`, field: 'ids/0' }], props: { x: id === 365 ? 20 : 328, y: id === 365 ? 20 : 28 } });
  }
  command('node.set', { ids: [{ $ref: 'copy514', field: 'map/519' }], props: { characters: 'Daftar Dokumen' } });
  text(documents, 'Daftar Dokumen', 328, 142, 42, C.ink, 'SemiBold');
  text(documents, 'Telusuri dokumen dari snapshot Sales dan Procurement.', 330, 199, 15, C.muted);
  const companyOnList = text(documents, snapshot.company, 330, 244, 14, C.ink, 'Medium'); bind(companyOnList, 'companyName');
  button(documents, 'Kembali ke Dashboard', 1458, 157, 210, nav(dashboard));
  box(documents, 'Documents surface', 328, 294, 1552, 922, '#FFFFFF', 26);
  text(documents, 'Dokumen operasional', 360, 324, 22, C.ink, 'SemiBold');
  text(documents, 'Klik dokumen untuk melihat detail dan dokumen terkait.', 360, 363, 14, C.muted);

  command('variable.createCollection', { name: 'Prototype form' }, 'formCollection');
  for (const [as, value] of [['supplierChoice', 'Supplier Contoh A'], ['quantityChoice', '1'], ['formTotal', money(97000)]])
    command('variable.create', { collection: ref('formCollection'), name: as, type: 'string', value }, as);
  command('variable.createCollection', { name: 'Prototype document filter', modes: ['All', 'Procurement', 'Sales'] }, 'filterCollection');
  command('variable.create', { collection: ref('filterCollection'), name: 'Document filter label', type: 'string', values: { All: 'Semua dokumen', Procurement: 'Procurement', Sales: 'Sales' } }, 'listFilter');
  for (const mode of ['All', 'Procurement', 'Sales']) command('variable.create', { collection: ref('filterCollection'), name: `Show ${mode}`, type: 'boolean', values: Object.fromEntries(['All', 'Procurement', 'Sales'].map(m => [m, mode === m])) }, `show${mode}`);
  box(documents, 'Filter control surface', 360, 410, 300, 44, '#EDF2FA', 22);
  text(documents, '⌄', 628, 421, 18, C.muted);
  const filterLabel = text(documents, 'Semua dokumen', 380, 426, 14, C.ink, 'Medium'); bind(filterLabel, 'listFilter');
  const rowsFrame = node('frame', 'Company-scoped document rows', 352, 512, 1504, 612, documents, { fill: '#FFFFFF' }); bind(rowsFrame, 'alphaScenario', 'visible');
  const allDocs = [...snapshot.purchases.data, ...snapshot.salesDocs.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  const typeName = k => ({ PURCHASE_REQUEST: 'Purchase Request', PURCHASE_ORDER: 'Purchase Order', PURCHASE_RECEIPT: 'Purchase Receipt', PURCHASE_INVOICE: 'Purchase Invoice', PAYMENT: 'Payment', QUOTATION: 'Quotation', SALES_ORDER: 'Sales Order', SALES_INVOICE: 'Sales Invoice', DELIVERY_NOTE: 'Delivery Note' })[k] || k;
  const details = {};
  for (const doc of allDocs) {
    const p = dialog(`Detail ${doc.number}`, typeName(doc.kind), 'Snapshot Alpha · tampilan baca saja', 880, 708);
    details[doc.number] = p;
    text(p, doc.number, 28, 108, 26, C.ink, 'SemiBold');
    box(p, 'Status', 704, 108, 144, 32, '#EAF6EE', 16);
    text(p, doc.status === 'APPROVED' ? 'Disetujui' : 'Dibukukan', 725, 116, 13, C.green, 'Medium');
    [['Company', snapshot.company], [doc.supplierName ? 'Supplier' : 'Customers', doc.supplierName || doc.customerName || '—'], ['Tanggal', new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(doc.date))], ['Warehouse', doc.warehouseName || '—']].forEach(([label, value], i) => {
      const x = i % 2 ? 454 : 28, y = 172 + Math.floor(i / 2) * 76;
      text(p, label, x, y, 12, C.muted); text(p, value, x, y + 24, 15, C.ink, 'Medium');
    });
    box(p, 'Line items', 28, 334, 824, 148, '#F4F7FC', 18);
    text(p, doc.lines.length ? 'Items' : 'Referensi pembayaran', 48, 352, 13, C.muted, 'Medium');
    if (doc.lines.length) doc.lines.slice(0, 2).forEach((line, i) => {
      text(p, line.itemName, 48, 388 + i * 39, 14);
      text(p, `${line.quantity} ${line.unit} × ${money(line.unitPrice)}`, 476, 388 + i * 39, 13, C.muted);
      text(p, money(line.amount), 716, 388 + i * 39, 14, C.ink, 'Medium');
    }); else text(p, doc.sourceNumber || 'Pembayaran telah dibukukan.', 48, 396, 16);
    text(p, 'Total dokumen', 28, 514, 15, C.muted);
    text(p, money(doc.amount), 624, 502, 30, C.ink, 'SemiBold');
    text(p, 'Dokumen terkait', 28, 572, 12, C.muted);
    text(p, doc.sourceNumber || 'Tidak ada dokumen sebelumnya', 28, 596, 14, C.blue, 'Medium');
    if (doc.sourceNumber) registry[`source:${doc.number}`] = { panel: p, number: doc.sourceNumber };
    button(p, 'Tutup', 716, 636, 136, close);
  }
  for (const entry of Object.values(registry).filter(v => typeof v === 'object')) if (details[entry.number]) hit(entry.panel, 'Dokumen terkait', 28, 584, 400, 40, { type: 'swapOverlay', dest: ref(details[entry.number]) });
  for (const [mode, docs] of [['All', allDocs], ['Procurement', allDocs.filter(d => d.supplierName)], ['Sales', allDocs.filter(d => d.customerName)]]) {
    const group = node('frame', `Filtered rows / ${mode}`, 0, 0, 1504, 612, rowsFrame, { fill: '#FFFFFF' }); bind(group, `show${mode}`, 'visible');
    docs.forEach((doc, i) => {
      const y = i * 65;
      box(group, 'Row divider', 0, y + 64, 1504, 1, C.line, 0);
      text(group, doc.number, 24, y + 19, 14, C.blue, 'Medium');
      text(group, typeName(doc.kind), 340, y + 19, 14);
      text(group, doc.supplierName || doc.customerName || '—', 630, y + 19, 14, C.muted);
      text(group, money(doc.amount), 1050, y + 19, 14, C.ink, 'Medium');
      text(group, doc.status === 'APPROVED' ? 'Disetujui' : 'Dibukukan', 1320, y + 19, 13, C.green);
      hit(group, doc.number, 0, y, 1504, 64, overlay(details[doc.number]));
    });
    text(group, `Menampilkan ${docs.length} dokumen snapshot`, 24, 566, 13, C.muted);
  }
  ['Dokumen', 'Jenis', 'Relasi', 'Nilai', 'Status'].forEach((label, i) => text(documents, label, [376, 692, 982, 1402, 1672][i], 478, 12, C.muted, 'Medium'));
  const noDocs = node('frame', 'Scenario / no documents', 352, 512, 1504, 612, documents, { fill: '#FFFFFF' }); bind(noDocs, 'emptyScenario', 'visible');
  text(noDocs, 'Tidak ada data ditemukan', 570, 160, 22, C.ink, 'Medium');
  text(noDocs, 'Skenario Company ini belum memiliki transaksi pada prototype.', 490, 206, 15, C.muted);
  text(documents, 'Menampilkan maksimal 8 dokumen snapshot · bukan data real-time.', 360, 1160, 13, C.muted);
  text(documents, 'Prototype desktop · perubahan tidak dikirim ke ERP.', 330, 1394, 12, C.muted);

  // A bounded, explicitly simulated transaction form with selectable presets.
  const success = dialog('Success', 'Simulasi berhasil', 'Dokumen contoh siap untuk ditinjau.', 580, 352);
  text(success, '✓', 267, 104, 48, C.green, 'SemiBold');
  text(success, 'Tidak ada data yang dikirim ke database ERP.', 98, 180, 14, C.muted);
  button(success, 'Kembali ke Dashboard', 164, 250, 252, [close, nav(dashboard)], true);
  const forms = {};
  for (const name of ['Purchase Request', 'Quotation']) {
    const noun = name === 'Quotation' ? 'Customers' : 'Supplier';
    const supplierMenu = dialog(`${noun} presets`, `Pilih ${noun}`, 'Pilihan simulasi untuk prototype.', 420, 292);
    [`${noun} Contoh A`, `${noun} Contoh B`].forEach((value, i) => menuRow(supplierMenu, value, 'Data simulasi', 106 + i * 76, 420,
      [{ type: 'setVariable', variable: ref('supplierChoice'), value }, close]));
    const p = dialog(`Buat ${name}`, `Buat ${name}`, 'Simulasi form · gunakan pilihan yang tersedia', 840, 760); forms[name] = p;
    const company = text(p, snapshot.company, 28, 110, 15, C.blue, 'Medium'); bind(company, 'companyName');
    text(p, 'Informasi dokumen', 28, 160, 18, C.ink, 'SemiBold');
    text(p, `${noun} *`, 28, 204, 13, C.muted);
    box(p, 'Supplier select', 28, 230, 784, 54, '#F3F6FB', 14);
    const supplier = text(p, 'Supplier Contoh A', 46, 247, 15); bind(supplier, 'supplierChoice');
    text(p, '⌄', 775, 245, 18, C.muted); hit(p, 'Pilih relasi', 28, 230, 784, 54, overlay(supplierMenu));
    text(p, 'Tanggal dokumen', 28, 307, 13, C.muted); text(p, '4 November 2026 · tanggal contoh', 28, 334, 15);
    text(p, 'Items', 28, 391, 18, C.ink, 'SemiBold');
    box(p, 'Item selection', 28, 430, 784, 100, '#F3F6FB', 18);
    text(p, 'Kertas A4 Premium 80 gsm', 48, 451, 16, C.ink, 'Medium'); text(p, `${money(97000)} / pcs`, 48, 485, 13, C.muted);
    const qty = text(p, '1', 661, 465, 18, C.ink, 'SemiBold'); bind(qty, 'quantityChoice');
    button(p, '−', 584, 452, 50, [{ type: 'setVariable', variable: ref('quantityChoice'), value: '1' }, { type: 'setVariable', variable: ref('formTotal'), value: money(97000) }]);
    button(p, '+', 724, 452, 50, [{ type: 'setVariable', variable: ref('quantityChoice'), value: '2' }, { type: 'setVariable', variable: ref('formTotal'), value: money(194000) }]);
    text(p, 'Total simulasi', 28, 570, 15, C.muted); const total = text(p, money(97000), 585, 557, 30, C.ink, 'SemiBold'); bind(total, 'formTotal');
    text(p, 'Field memakai pilihan preset. Validasi dan penyimpanan nyata tersedia di aplikasi ERP.', 28, 620, 12, C.muted);
    button(p, 'Batal', 524, 680, 110, close);
    button(p, 'Simpan Simulasi', 650, 680, 162, { type: 'swapOverlay', dest: ref(success) }, true);
  }
  const create = dialog('Buat Transaksi menu', 'Buat Transaksi', 'Pilih alur yang ingin dicoba.', 380, 298);
  for (const [name, noun, y, description] of [['Purchase Request', 'Supplier', 108, 'Simulasi kebutuhan pembelian'], ['Quotation', 'Customers', 184, 'Simulasi penawaran Sales']])
    menuRow(create, name, description, y, 380, [{ type: 'setVariable', variable: ref('supplierChoice'), value: `${noun} Contoh A` }, { type: 'setVariable', variable: ref('quantityChoice'), value: '1' }, { type: 'setVariable', variable: ref('formTotal'), value: money(97000) }, { type: 'swapOverlay', dest: ref(forms[name]) }]);

  const search = dialog('Global search', 'Cari modul atau dokumen', 'Pilih contoh hasil pencarian · bukan input teks bebas', 800, 486);
  box(search, 'Search sample', 28, 104, 744, 52, '#F2F5FB', 18); text(search, 'Purchase Order', 48, 121, 16, C.ink, 'Medium');
  menuRow(search, 'Procurement', 'Buka daftar dokumen operasional', 182, 800, [close, nav(documents)]);
  const purchaseOrder = allDocs.find(d => d.kind === 'PURCHASE_ORDER');
  if (purchaseOrder) {
    const start = commands.length;
    menuRow(search, purchaseOrder.number, `${purchaseOrder.supplierName} · ${money(purchaseOrder.amount)}`, 260, 800, { type: 'swapOverlay', dest: ref(details[purchaseOrder.number]) });
    for (const c of commands.slice(start).filter(c => c.command === 'node.create')) bind(c.as, 'alphaScenario', 'visible');
  }
  const noSearch = text(search, 'Tidak ada dokumen pada skenario Company ini.', 32, 280, 14, C.muted); bind(noSearch, 'emptyScenario', 'visible');
  menuRow(search, 'Dashboard', 'Kembali ke ringkasan Company aktif', 338, 800, [close, nav(dashboard)]);

  const period = dialog('Period scope', 'Periode laporan', 'Snapshot pembukuan Alpha: Oktober–November 2026.', 520, 314);
  text(period, 'Periode pada prototype mengikuti snapshot tetap.', 28, 112, 15);
  text(period, 'Filter rentang tanggal tersedia pada aplikasi ERP.', 28, 145, 14, C.muted);
  button(period, 'Seluruh periode', 28, 226, 200, close, true);
  const notices = dialog('Notifications', 'Notifications', 'Aktivitas pada snapshot Alpha', 460, 368);
  const noticeTitle = text(notices, 'Semua Purchase Request telah ditinjau.', 28, 116, 15, C.ink, 'Medium'); bind(noticeTitle, 'alphaScenario', 'visible');
  const noticeDescription = text(notices, 'Tidak ada Approval tertunda pada snapshot ini.', 28, 150, 13, C.muted); bind(noticeDescription, 'alphaScenario', 'visible');
  const emptyNotice = text(notices, 'Belum ada Notifications pada Company ini.', 28, 116, 14, C.muted); bind(emptyNotice, 'emptyScenario', 'visible');
  button(notices, 'Lihat Dokumen', 28, 260, 190, [close, nav(documents)]);
  const help = dialog('Help', 'Panduan prototype', 'Dashboard desktop · interaksi native FigCraft', 680, 486);
  ['1. Pilih Company untuk membandingkan konteks data.', '2. Klik dokumen untuk membuka detail baca saja.', '3. Buka Buat Transaksi dan coba pilihan preset.', '4. Klik area luar atau tekan Escape untuk menutup modal.', '5. Gunakan sidebar untuk melihat submenu setiap modul.'].forEach((v, i) => text(help, v, 28, 114 + i * 49, 15));
  button(help, 'Mulai mencoba', 28, 394, 190, close, true);
  const profile = dialog('Profile', 'Aditya Pratama', 'Admin · akun contoh pada design', 420, 330);
  menuRow(profile, 'Panduan prototype', 'Lihat interaksi yang tersedia', 112, 420, { type: 'swapOverlay', dest: ref(help) });
  menuRow(profile, 'Dashboard', 'Kembali ke halaman utama', 192, 420, [close, nav(dashboard)]);

  // Exact primary hierarchy; all groups expose a real dismissible submenu.
  const modules = {
    Organization: ['Company', 'Branch', 'Department'],
    'Master Data': ['Items', 'Customers', 'Suppliers'],
    Procurement: ['Purchase Request', 'Request for Quotation', 'Purchase Order', 'Purchase Receipt', 'Purchase Invoice'],
    Inventory: ['Warehouses', 'Stock Overview', 'Stock Movement', 'Stock Transfer', 'Stock Adjustment'],
    'Sales & CRM': ['Leads', 'Quotations', 'Sales Orders', 'Delivery Notes', 'Sales Invoices'],
    Accounting: ['Chart of Accounts', 'Journal Entries', 'Payments', 'Accounts Receivable', 'Accounts Payable'],
    'Human Resources': ['Employees', 'Leave Requests', 'Attendance'],
    Manufacturing: ['Bill of Materials', 'Work Orders', 'Production'],
    'Reports & Analytics': ['Ringkasan Company', 'Laporan Sales', 'Laporan Procurement', 'Laporan Stock'],
    'Settings & Permissions': ['Users', 'Roles', 'Permissions', 'Audit Logs'],
  };
  const modulePanels = {};
  for (const [name, subs] of Object.entries(modules)) {
    const p = dialog(`Menu ${name}`, name, 'Pilih submenu · cakupan prototype Dashboard', 640, 158 + subs.length * 76);
    modulePanels[name] = p;
    subs.forEach((sub, i) => {
      const isDocument = ['Procurement', 'Sales & CRM'].includes(name) && sub !== 'Leads';
      const target = isDocument ? documents : dialog(`Informasi ${sub}`, sub, `${name} / ${sub}`, 640, 344);
      if (!isDocument) {
        text(target, 'Halaman ini berada di luar cakupan prototype Dashboard.', 28, 120, 15);
        text(target, 'Gunakan aplikasi ERP untuk menjalankan fitur modul ini.', 28, 154, 14, C.muted);
        button(target, 'Kembali ke menu', 28, 242, 190, { type: 'swapOverlay', dest: ref(p) });
      }
      menuRow(p, sub, isDocument ? 'Lihat contoh dokumen snapshot' : 'Lihat cakupan modul', 108 + i * 76, 640,
        isDocument ? [{ type: 'setVariableMode', collection: ref('filterCollection'), mode: name === 'Procurement' ? 'Procurement' : 'Sales' }, close, nav(target)] : { type: 'swapOverlay', dest: ref(target) });
    });
  }
  const filter = dialog('Document filter', 'Filter dokumen', 'Pilih sumber dokumen pada snapshot.', 480, 364);
  ['All', 'Procurement', 'Sales'].forEach((mode, i) => menuRow(filter, mode === 'All' ? 'Semua dokumen' : mode, 'Terapkan filter', 106 + i * 76, 480,
    [{ type: 'setVariableMode', collection: ref('filterCollection'), mode }, close]));
  hit(documents, 'Filter', 360, 410, 300, 44, overlay(filter));
  button(documents, 'Buat Transaksi', 1686, 157, 194, overlay(create, [-186, 54]), true);

  // Hotspots are added last, above the original visual controls and labels.
  const wireShell = (parent, side, bar) => {
    hit(parent, 'Company', 1538, 42, 218, 44, overlay(companies, [0, 52]));
    hit(parent, 'Company workspace', 36, 120, 240, 82, overlay(companies, [0, 92]));
    hit(parent, 'Search', 1228, 42, 294, 44, overlay(search));
    hit(parent, 'Notifications', 1770, 42, 44, 44, overlay(notices, [-414, 54]));
    hit(parent, 'Settings', 1824, 42, 44, 44, overlay(modulePanels['Settings & Permissions']));
    hit(parent, 'Profile', 36, 1326, 240, 74, overlay(profile, [0, -346]));
    hit(parent, 'Help', 36, 1190, 240, 76, overlay(help));
    hit(parent, 'Dashboard', 36, 258, 240, 48, nav(dashboard));
    Object.keys(modules).forEach((name, i) => hit(parent, name, 36, 360 + i * 52, 240, 48, overlay(modulePanels[name])));
    event(parent, overlay(search), { type: 'keyPress', key: 'Ctrl+K' });
    // Keep explicit refs for source inspection and developer handoff.
    command('node.set', { ids: [ref(parent)], props: { pluginData: { prototype: 'enterprise-erp-desktop', sidebar: String(side), toolbar: String(bar) } } });
  };
  wireShell(dashboard, 365, 514); wireShell(documents, 'copy365', 'copy514');
  hit(dashboard, 'Procurement', 1510, 157, 160, 44, nav(documents));
  hit(dashboard, 'Buat Transaksi', 1686, 157, 194, 44, overlay(create, [-186, 54]));
  hit(dashboard, 'Pilih periode', 1708, 229, 172, 44, overlay(period, [-348, 54]));
  hit(dashboard, 'Lihat Purchase Request', 1548, 858, 308, 44, nav(documents));
  hit(dashboard, 'Lihat Semua', 1727, 976, 125, 44, nav(documents));
  const dashboardNumbers = [676, 685, 694, 703, 712, 721].map(id => source.children.find(n => n.id === id)?.characters);
  dashboardNumbers.forEach((number, i) => {
    if (details[number]) { const h = hit(dashboard, number, 352, 1084 + i * 45, 1504, 44, overlay(details[number])); bind(h, 'alphaScenario', 'visible'); }
  });
  command('proto.flow.add', { start: dashboard, name: 'Enterprise ERP · Desktop interaktif' });
  command('proto.settings', { device: 'None', background: '#E9EDF5', responsive: false });
  writeFileSync('designs/dashboard-prototype.commands.json', JSON.stringify(commands, null, 2));
  const results = data(await tool('batch', { document, label: 'Add desktop Dashboard interactive prototype', commands }));
  const ids = Object.fromEntries(commands.flatMap((c, i) => c.as ? [[c.as, results[i]?.id]] : []));
  const resolveValue = value => Array.isArray(value) ? value.map(resolveValue) : value && typeof value === 'object' ? value.$ref ? ids[value.$ref] : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v)])) : value;
  const manifest = { document, dashboard, documents: ids[documents], sourceHash, companyCollection: ids.companyModes,
    frames: Object.fromEntries(Object.entries(registry).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, ids[v]])),
    interactions: interactionLog.map(resolveValue), commandCount: commands.length, createdAt: new Date().toISOString() };
  writeFileSync('designs/dashboard-prototype-manifest.json', JSON.stringify(manifest, null, 2));
  await tool('save_file', { document });
  console.log(JSON.stringify({ commands: commands.length, interactions: interactionLog.length, overlays: dialogIndex, file: 'designs/enterprise-erp-dashboard-prototype.figcraft', listFrame: ids[documents] }));
});
