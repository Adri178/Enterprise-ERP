import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(resolve('apps/web/package.json'));
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), icons = require('lucide-react');
const { getPath } = require('recharts/lib/shape/Curve.js');
const child = spawn('C:/Program Files/ArtCraft/FigCraft/figcraft-cli.exe', ['mcp', '--automation-write-root', process.cwd()]);
let sequence = 0; const pending = new Map();
createInterface({ input: child.stdout }).on('line', line => { try { const message = JSON.parse(line); if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } } catch {} });
child.stderr.resume();
function rpc(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); setTimeout(() => reject(Error(`MCP timeout: ${method}`)), 45000).unref(); }); }
async function tool(name, args = {}) { const response = await rpc('tools/call', { name, arguments: args }); if (response.error || response.result?.isError) throw Error(JSON.stringify(response)); return response.result; }
const C = { bg: '#f8f9fb', ink: '#252c32', muted: '#7a828c', border: '#e8ebee', green: '#287b62', white: '#ffffff' };
const commands = []; const ref = key => ({ $ref: key }); let counter = 0;
function node(type, name, x, y, width, height, props = {}, parent = 'canvas', text) { const key = `layer${++counter}`; commands.push({ command: 'node.create', as: key, params: { type, name, x, y, ...(width != null ? { width } : {}), ...(height != null ? { height } : {}), props, ...(parent ? { parent: ref(parent) } : {}), ...(text != null ? { text: String(text) } : {}), select: false } }); return key; }
function rect(name, x, y, w, h, fill = C.white, radius = 0, border = null, parent = 'canvas') { return node('rectangle', name, x, y, w, h, { fill, cornerRadius: radius, ...(border ? { stroke: border, strokeWeight: 1, strokeAlign: 'inside' } : {}) }, parent); }
function frame(name, x, y, w, h, fill = C.white, parent = 'canvas') { return node('frame', name, x, y, w, h, { fill, clip: true }, parent); }
function text(value, x, y, size = 12, color = C.ink, weight = 'Regular', w, parent = 'canvas') { return node('text', String(value).slice(0, 70), x, y, w, null, { fontFamily: 'Inter', fontStyle: weight, fontSize: size, fill: color }, parent, value); }
function vector(name, path, x, y, parent = 'canvas', color = C.muted, stroke = 1.7, fill = '#00000000') { const key = node('vector', name, x, y, null, null, { fill, stroke: color, strokeWeight: stroke }, parent); commands.at(-1).params.path = path; return key; }
function icon(name, x, y, size = 18, color = C.muted, parent = 'canvas') {
  if (!icons[name]) return;
  const svg = renderToStaticMarkup(React.createElement(icons[name], { size: 24 })), s = size / 24;
  const group = frame(name, x, y, size, size, '#00000000', parent);
  for (const match of svg.matchAll(/<(path|rect|circle|line|polyline|polygon|ellipse)\b([^>]*)/g)) {
    const a = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(v => [v[1], v[2]])); let d = a.d;
    if (match[1] === 'rect') { const x = +a.x, y = +a.y, w = +a.width, h = +a.height; d = `M${x} ${y}h${w}v${h}h${-w}Z`; }
    if (match[1] === 'circle') { const x = +a.cx, y = +a.cy, r = +a.r; d = `M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0`; }
    if (match[1] === 'ellipse') { const x = +a.cx, y = +a.cy, rx = +a.rx, ry = +a.ry; d = `M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0`; }
    if (match[1] === 'line') d = `M${a.x1} ${a.y1}L${a.x2} ${a.y2}`;
    if (match[1] === 'polyline' || match[1] === 'polygon') d = 'M' + a.points.replaceAll(' ', ' L') + (match[1] === 'polygon' ? 'Z' : '');
    if (!d) continue;
    let command = '', argument = 0;
    d = [...d.matchAll(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)].map(token => {
      const value = token[0]; if (/^[a-z]$/i.test(value)) { command = value.toLowerCase(); argument = 0; return value; }
      const arcFlag = command === 'a' && [3,4].includes(argument % 7); argument++;
      return arcFlag ? value : String(Math.round(Number(value) * s * 10000) / 10000);
    }).join(' ');
    vector(name + ' path', d, 0, 0, group, color, size * 1.7 / 24);
  }
}
function button(label, x, y, width, primary = false, iconName = null, parent = 'canvas') { rect(label, x, y, width, 36, primary ? C.green : C.white, 7, primary ? null : C.border, parent); if (iconName) icon(iconName, x + 12, y + 10, 15, primary ? C.white : C.muted, parent); text(label, x + (iconName ? 35 : 13), y + 10, 11, primary ? C.white : C.ink, 'Medium', undefined, parent); }
// Source-matched desktop geometry: globals.css @media(min-width:1600px).
commands.push({ command: 'node.create', as: 'canvas', params: { type: 'frame', name: 'Enterprise ERP / Dashboard / Desktop 1920', x: 0, y: 0, width: 1920, height: 1440, props: { fill: C.bg, clip: true } } });
const side = frame('Application shell / Sidebar', 0, 0, 242, 1440);
rect('Sidebar divider', 241, 0, 1, 1440, C.border, 0, null, side);
icon('Boxes', 22, 25, 31, C.green, side); text('Enterprise', 62, 26, 19, C.ink, 'SemiBold', undefined, side); text('ERP', 158, 26, 19, '#92999f', 'Regular', undefined, side);
rect('Workspace selector', 16, 74, 210, 56, C.white, 9, C.border, side); rect('Workspace emblem', 27, 85, 31, 33, '#f0f5f2', 6, null, side); icon('Building2', 34, 92, 17, '#4b6d5e', side);
text('Enterprise Workspace', 68, 85, 11.5, C.ink, 'SemiBold', undefined, side); text('Fondasi workspace', 68, 104, 10, '#8b9299', 'Regular', undefined, side); icon('ChevronsUpDown', 201, 95, 14, C.muted, side);
text('WORKSPACE', 25, 151, 9, '#9a9fa6', 'SemiBold', undefined, side); rect('Active / Dashboard', 13, 174, 216, 39, '#eaf4ee', 7, null, side); icon('LayoutDashboard', 24, 184, 18, C.green, side); text('Dashboard', 53, 186, 12, C.green, 'Medium', undefined, side);
text('MODUL', 25, 234, 9, '#9a9fa6', 'SemiBold', undefined, side);
const modules = [['Organization','Building2'],['Master Data','Database'],['Procurement','ShoppingCart'],['Inventory','Package'],['Sales & CRM','ChartNoAxesCombined'],['Accounting','Calculator'],['Human Resources','Users'],['Manufacturing','Factory'],['Reports & Analytics','BarChart3'],['Settings & Permissions','Settings2']];
modules.forEach(([label, name], i) => { const y = 257 + i * 42; icon(name, 24, y + 10, 18, '#626a73', side); text(label, 53, y + 12, 12, '#626a73', 'Medium', undefined, side); icon('ChevronDown', 206, y + 14, 13, '#626a73', side); });
rect('Sidebar footer divider', 0, 1305, 242, 1, C.border, 0, null, side); icon('CircleHelp', 22, 1325, 18, C.muted, side); text('Butuh bantuan?', 50, 1325, 11, '#5c646c', 'Medium', undefined, side); text('Pusat Bantuan', 50, 1345, 10, C.muted, 'Regular', undefined, side); icon('ArrowUpRight', 128, 1345, 12, C.muted, side); icon('PanelLeftClose', 24, 1391, 17, '#90979f', side); text('Ciutkan sidebar', 52, 1393, 11, '#90979f', 'Regular', undefined, side);
const header = frame('Application shell / Header', 242, 0, 1678, 64); rect('Header divider', 0, 63, 1678, 1, C.border, 0, null, header);
text('Enterprise ERP', 32, 26, 11, C.muted, 'Regular', undefined, header); icon('ChevronRight', 126, 25, 13, '#b1b7bc', header); text('Dashboard', 149, 26, 11, '#4e585f', 'Medium', undefined, header);
icon('Building2', 1217, 24, 16, '#798881', header); text('PT Alpha Distribusi', 1242, 25, 11, '#59666b', 'Medium', undefined, header); icon('ChevronsUpDown', 1353, 25, 13, C.muted, header);
rect('Header tools divider',1382,22,1,20,C.border,0,null,header); icon('Search', 1399, 24, 16, '#9299a0', header); text('Cari', 1424, 25, 11, '#9299a0', 'Regular', undefined, header); rect('Search shortcut',1475,21,32,22,C.white,4,'#e5e8eb',header);text('⌘ K',1480,27,9,'#9299a0','Regular',undefined,header);
icon('Bell', 1529, 23, 18, C.muted, header); icon('CircleHelp', 1575, 23, 18, C.muted, header); node('ellipse', 'User avatar', 1615, 16, 31, 31, { fill: '#e5ede8' }, header); text('AP', 1623, 26, 10, '#4e6f5c', 'SemiBold', undefined, header);
text('Dashboard', 284, 100, 24, C.ink, 'SemiBold'); text('Ringkasan Sales, Procurement, dan Inventory dari transaksi yang dibukukan pada company aktif.', 284, 138, 13, C.muted);
button('Procurement', 1582, 105, 127); icon('ArrowRight', 1684, 115, 14); button('Buat Transaksi', 1718, 105, 160, true, 'Plus');
node('ellipse', 'Active Company dot', 284, 191, 6, 6, { fill: C.green }); text('PT Alpha Distribusi', 299, 187, 11, '#475569', 'Medium'); text('Seluruh periode', 1789, 187, 11, C.muted);
let snapshot = null; try { snapshot = JSON.parse(readFileSync('.local/figcraft-data.json','utf8')); } catch {}
const currency = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const metrics = [['Total Sales', snapshot?.sales?.sales, 'CircleDollarSign'],['Total Purchases', snapshot?.purchase?.purchases, 'ShoppingBag'],['Utang Belum Lunas', snapshot?.purchase?.outstanding, 'FileClock'],['Piutang Belum Lunas', snapshot?.sales?.outstanding, 'FileClock'],['Menunggu Approval', snapshot?.purchase?.requestsPending, 'ClipboardCheck'],['Nilai Inventory', snapshot?.purchase?.inventoryValue, 'Package']];
metrics.forEach(([label,value,name],i)=>{ const x = 284 + i%3 * (1562/3+16), y = 220 + Math.floor(i/3)*148, w = 1562/3; rect('KPI / '+label, x,y,w,132,C.white,11,C.border); text(label,x+23,y+24,11,'#727d83','Medium'); rect('Metric icon',x+w-49,y+19,28,28,'#f6f8f8',7);icon(name,x+w-42,y+26,15,'#7a8e83');text(value == null ? '—' : i===4?String(value):currency(value),x+23,y+55,30,'#30393d','SemiBold');text('Data dari PostgreSQL',x+23,y+99,10,C.muted);});
const cy=522,ch=334,cw=1234,ax=1538;
rect('Chart / Revenue & Expenses',284,cy,cw,ch,C.white,11,C.border);text('Revenue & Expenses',306,cy+23,13,C.ink,'SemiBold');text('Nilai Sales Invoice dan Purchase Invoice selama enam bulan terakhir; belum berupa laporan laba rugi.',306,cy+48,10.5,'#9399a1');node('ellipse','Sales legend',1276,cy+28,6,6,{fill:'#438e70'});text('Sales Invoice',1288,cy+25,9,'#9299a0');node('ellipse','Purchase legend',1375,cy+28,6,6,{fill:'#9aaab2'});text('Purchase Invoice',1387,cy+25,9,'#9299a0');
const chartRows = snapshot?.purchaseChart.map(p=>({...p,sales:snapshot.salesChart.find(s=>s.month===p.month)?.sales||0})) || [];
const peak = Math.max(1,...chartRows.flatMap(v=>[v.sales,v.purchases])), axisMax = Math.ceil(peak/4/10**Math.floor(Math.log10(peak/4)))*10**Math.floor(Math.log10(peak/4))*4;
for(let i=0;i<5;i++){ const y=cy+102+i*44;rect('Chart gridline',365,y,1118,1,'#edf0f2');text(snapshot ? new Intl.NumberFormat('id-ID',{notation:'compact',maximumFractionDigits:1}).format(axisMax*(4-i)/4) : '—',317,y-5,9,'#89949a'); }
const months=snapshot?.purchaseChart?.map(v=>v.month) || ['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11'];
months.forEach((m,i)=>text(new Intl.DateTimeFormat('id-ID',{month:'short'}).format(new Date(m+'-01T12:00:00Z')),365+i*218,cy+294,10,'#89949a'));
if(snapshot){for(const [field,col]of[['purchases','#9aaab2'],['sales','#438e70']]){const points=chartRows.map((v,i)=>({x:i*218,y:176-v[field]/axisMax*176}));if(field==='sales')vector('Sales Invoice area',getPath({type:'monotone',layout:'horizontal',points,baseLine:176}),365,cy+102,'canvas','#00000000',0,'#438e7015');vector('Chart series / '+field,getPath({type:'monotone',layout:'horizontal',points}),365,cy+102,'canvas',col,field==='sales'?2.2:1.8);}}
else{text('Belum ada data',780,cy+184,11,'#9399a1');}
rect('Pending approvals',ax,cy,340,ch,C.white,11,C.border);text('Menunggu Persetujuan',ax+18,cy+23,13,C.ink,'SemiBold');rect('Approval count',ax+296,cy+18,25,24,'#fffbeb',6);text(snapshot?String(snapshot.approvals.meta.total):'—',ax+304,cy+24,12,'#b45309');text('Dokumen yang memerlukan perhatian Anda',ax+18,cy+48,10.5,'#9399a1');
const approvals=snapshot?.approvals?.data?.slice(0,3)||[];approvals.forEach((v,i)=>{const y=cy+85+i*65;rect('Approval icon',ax+18,y,33,35,'#f1f5f2',7);icon('ClipboardCheck',ax+26,y+9,16,'#70907e');text(v.number,ax+62,y+2,11,'#5b666d','SemiBold');text(v.supplierName,ax+62,y+22,10,C.muted);icon('ArrowRight',ax+306,y+10,13);});
if(!approvals.length)text(snapshot?'Tidak ada data ditemukan':'—',ax+92,cy+150,12,C.muted);button('Lihat Semua',ax+18,cy+282,304);icon('ArrowRight',ax+204,cy+293,13);
const ty=878;rect('Recent Sales & Procurement documents',284,ty,1594,424,C.white,11,C.border);text('Dokumen Sales & Procurement Terbaru',305,ty+20,13,C.ink,'SemiBold');text('Aktivitas operasional company Anda',305,ty+44,10.5,'#9399a1');text('Lihat Semua',1775,ty+30,10,'#78877f','Medium');icon('ArrowRight',1848,ty+30,13,'#78877f');rect('Table header',285,ty+74,1592,36,'#fafbfc');
const cols=[['Dokumen',305],['Jenis',583],['Relasi',858],['Tanggal',1290],['Nilai',1487],['Status',1748]]; cols.forEach(([v,x])=>text(v,x,ty+86,10,'#8a939a','Medium'));
const kinds={PURCHASE_REQUEST:'Purchase Request',PURCHASE_ORDER:'Purchase Order',PURCHASE_RECEIPT:'Purchase Receipt',PURCHASE_INVOICE:'Purchase Invoice',PAYMENT:'Payment',QUOTATION:'Quotation',SALES_ORDER:'Sales Order',DELIVERY_NOTE:'Delivery Note',SALES_INVOICE:'Sales Invoice'};
const rows=snapshot?[...snapshot.purchases.data.map(v=>({...v,party:v.supplierName})),...snapshot.salesDocs.data.map(v=>({...v,party:v.customerName}))].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).slice(0,6):[];
rows.forEach((v,i)=>{const y=ty+110+i*50;rect('Row divider',285,y+49,1592,1,'#f0f2f4');text(v.number,305,y+18,11,'#495b50','Medium');text(kinds[v.kind],583,y+18,11,'#657179');text(v.party,858,y+18,11,'#657179');text(new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(v.date)),1290,y+18,11,'#657179');text(currency(v.amount),1487,y+18,11,'#657179','Medium');const status={POSTED:'Dibukukan',APPROVED:'Disetujui',DRAFT:'Draft',PENDING:'Menunggu',CANCELLED:'Dibatalkan',REJECTED:'Ditolak'}[v.status]||v.status;rect('Status / '+status,1748,y+12,105,26,v.status==='PENDING'?'#fffbeb':'#ecfdf5',6);text(status,1761,y+19,11,v.status==='PENDING'?'#b45309':'#047857','Medium');});
if(!rows.length) {text('Data dokumen belum tersedia untuk snapshot ini',870,ty+216,12,C.muted);}
rect('Operational scope notice',284,1322,1594,44,'#f2f6f3',8,'#e4ebe6');icon('Info',299,1336,16,'#6c8a78');text('Angka berasal dari dokumen operasional yang dibukukan. Belum termasuk pajak dan belum berupa laporan keuangan lengkap.',326,1338,11,'#6c7e71');
text('Enterprise ERP  /  ALP',284,1407,10,'#a0a7ae');node('ellipse','Live dot',1752,1410,6,6,{fill:C.green});text('Terhubung ke API',1767,1406,10,'#8f9993');
writeFileSync('designs/dashboard.commands.json',JSON.stringify(commands,null,2));
try {
  await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'Enterprise ERP Dashboard Designer',version:'1.0'}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const built=await tool('batch',{commands,label:'Enterprise ERP Dashboard — source recreation'});writeFileSync('.local/figcraft-build-result.json',JSON.stringify(built));
  await tool('save_file',{path:resolve('designs/enterprise-erp-dashboard-live.figcraft')});
  await tool('export',{path:resolve('designs/enterprise-erp-dashboard-live.png'),format:'png',scale:1});
  await tool('export',{path:resolve('designs/enterprise-erp-dashboard-live.svg'),format:'svg',svgOutlineText:false});
  const inspected=await tool('inspect_document',{depth:3,outline:true});writeFileSync('designs/dashboard-inspection.json',JSON.stringify(inspected,null,2));
  writeFileSync('designs/README.md',`# Enterprise ERP Dashboard\n\nNative editable FigCraft design generated through the FigCraft MCP server (stdio JSON-RPC), using batch, save_file, export and inspect_document.\n\nFrame: 1920 × 1440. Scope: existing desktop operational Dashboard only. Source: globals.css, app-shell.tsx, operational-dashboard.tsx, navigation.ts and i18n.ts. No application source was changed. Text, shapes, Lucide-based vectors, cards and table are editable native layers.\n\nCurrent browser CDP is unavailable, so pixel-for-pixel matching has not been visually verified. ${snapshot?'Data uses a read-only Alpha database snapshot.':'Local database is unavailable; values are deliberately unavailable rather than fabricated. The chart and table require a reference snapshot to finish exact matching.'}\n\nOpen enterprise-erp-dashboard-live.figcraft in FigCraft. PNG/SVG previews are included. dashboard.commands.json retains native creation commands.\n`);
  console.log(`Created native FigCraft Dashboard using ${commands.length} MCP layer commands. Verified by document inspection and PNG/SVG export. Snapshot data available: ${!!snapshot}`);
}finally{child.kill();}
