import{createRequire}from'node:module';import{readFileSync,writeFileSync}from'node:fs';import{resolve}from'node:path';import{createHash}from'node:crypto';import{withFigcraft}from'./figcraft-mcp.mjs';
const require=createRequire(resolve('apps/web/package.json'));const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),icons=require('lucide-react'),{getPath}=require('recharts/lib/shape/Curve.js');
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

const snapshot = JSON.parse(readFileSync('.local/figcraft-data.json','utf8'));
const money = v => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v);
const labelColor = '#6E7480', ink = '#20232B', blue = '#007AFF', green = '#278A5B';
commands.push({command:'node.create',as:'canvas',params:{type:'frame',name:'02 / Apple-inspired — Liquid Glass',x:0,y:1660,width:1920,height:1440,props:{fill:'#F5F6FA',clip:true}}});
function shadow(id, radius=26, strength='#2032530A') { const item=commands.find(c=>c.as===id); item.params.props.effects=[{type:'dropShadow',color:strength,offset:[0,8],radius}]; }
function surface(name,x,y,w,h,parent='canvas') { const id=rect(name,x,y,w,h,'#FFFFFF',26,'#EBEDF2',parent);shadow(id);commands.find(c=>c.as===id).params.props.cornerSmoothing=.65;return id; }
function glass(name,x,y,w,h,r=24,parent='canvas') {
  const id=rect(name,x,y,w,h,'#FFFFFFBA',r,'#FFFFFFE8',parent);
  commands.find(c=>c.as===id).params.props.effects=[{type:'backgroundBlur',radius:24},{type:'innerShadow',color:'#FFFFFFE8',offset:[0,1],radius:2},{type:'dropShadow',color:'#23345512',offset:[0,8],radius:28}];
  commands.push({command:'effect.add',params:{ids:[ref(id)],type:'glass'}});
  return id;
}
function title(value,x,y,size=18,color=ink,weight='SemiBold',w,parent='canvas'){const id=text(value,x,y,size,color,weight,w,parent);commands.find(c=>c.as===id).params.props.letterSpacing=size>=30?-1.1:size>=18?-.35:0;return id;}
function pill(value,x,y,w,primary=false,name=null,parent='canvas') {
  const id=primary?rect(value,x,y,w,44,blue,22,null,parent):glass(value,x,y,w,44,22,parent);
  if(primary)shadow(id,16,'#007AFF21');if(name)icon(name,x+16,y+13,18,primary?'#FFFFFF':labelColor,parent);
  text(value,x+(name?43:18),y+13,13,primary?'#FFFFFF':ink,'Medium',undefined,parent);return id;
}
// Very restrained colour behind the material makes refraction visible without tinting financial data.
node('ellipse','Ambient / blue behind navigation',-180,50,480,700,{fill:'#DDE9FD',opacity:.5,effects:[{type:'layerBlur',radius:100}]});
node('ellipse','Ambient / toolbar light',1380,-150,520,290,{fill:'#DCE9FF',opacity:.65,effects:[{type:'layerBlur',radius:90}]});
const side=frame('Navigation / floating sidebar',20,20,272,1400,'#00000000');
glass('Material / Sidebar',0,0,272,1400,28,side);
icon('Boxes',24,31,27,blue,side);title('Enterprise',62,32,21,ink,'SemiBold',undefined,side);text('ERP',170,34,19,'#9096A3','Regular',undefined,side);
glass('Company workspace',16,100,240,82,20,side);rect('Company emblem',31,118,42,42,'#E6F0FF',13,null,side);icon('Building2',42,129,20,blue,side);text('PT Alpha Distribusi',85,119,13,ink,'SemiBold',undefined,side);text('Enterprise Workspace',85,141,10.5,labelColor,'Regular',undefined,side);icon('ChevronsUpDown',226,131,14,labelColor,side);
text('WORKSPACE',28,208,10,'#8A909C','SemiBold',undefined,side);
rect('Current module / Dashboard',16,238,240,48,'#E5EFFF',15,null,side);icon('LayoutDashboard',32,252,20,blue,side);text('Dashboard',66,252,14,blue,'SemiBold',undefined,side);
text('MODUL',28,310,10,'#8A909C','SemiBold',undefined,side);
const mods=[['Organization','Building2'],['Master Data','Database'],['Procurement','ShoppingCart'],['Inventory','Package'],['Sales & CRM','ChartNoAxesCombined'],['Accounting','Calculator'],['Human Resources','Users'],['Manufacturing','Factory'],['Reports & Analytics','BarChart3'],['Settings & Permissions','Settings2']];
mods.forEach(([label,name],i)=>{const y=340+i*52;icon(name,32,y+12,20,'#777E8D',side);text(label,66,y+14,13.5,'#48505F','Medium',undefined,side);icon('ChevronDown',231,y+17,12,'#9A9FAC',side);});
rect('Sidebar footer hairline',28,1162,216,1,'#DCE1EB',0,null,side);
icon('CircleHelp',32,1190,20,labelColor,side);text('Butuh bantuan?',66,1189,13,ink,'Medium',undefined,side);text('Buka Pusat Bantuan',66,1211,11,labelColor,'Regular',undefined,side);icon('ArrowUpRight',226,1200,14,labelColor,side);
glass('Profile / account control',16,1306,240,74,20,side);node('ellipse','Avatar',30,1323,40,40,{fill:'#E0EBFE'},side);text('AP',41,1336,12,'#3666B6','SemiBold',undefined,side);text('Aditya Pratama',83,1323,12.5,ink,'SemiBold',undefined,side);text('ADMIN · Alpha',83,1345,11,labelColor,'Regular',undefined,side);icon('MoreHorizontal',224,1336,18,labelColor,side);
const bar=frame('Controls / Liquid Glass toolbar',328,28,1552,72,'#00000000');
glass('Material / toolbar',0,0,1552,72,28,bar);
text('Enterprise ERP',24,28,13,labelColor,'Medium',undefined,bar);icon('ChevronRight',130,29,13,'#A1A8B4',bar);text('Dashboard',156,28,13,ink,'SemiBold',undefined,bar);
glass('Search capsule',900,14,294,44,22,bar);icon('Search',916,28,17,'#818998',bar);text('Cari modul atau dokumen',945,29,12,'#818998','Regular',undefined,bar);text('⌘ K',1157,30,10,'#818998','Medium',undefined,bar);
glass('Company switcher capsule',1210,14,218,44,22,bar);node('ellipse','Active Company indicator',1227,33,7,7,{fill:green},bar);text('PT Alpha Distribusi',1245,29,12.5,ink,'Medium',undefined,bar);icon('ChevronsUpDown',1402,29,13,labelColor,bar);
glass('Notifications control',1442,14,44,44,22,bar);icon('Bell',1455,27,18,'#5D6573',bar);glass('Settings control',1496,14,44,44,22,bar);icon('Settings2',1509,27,18,'#5D6573',bar);
title('Dashboard',328,142,42);text('Ringkasan Sales, Procurement, dan Inventory company aktif.',330,199,15,labelColor);
pill('Procurement',1510,157,160,false,'ShoppingCart');pill('Buat Transaksi',1686,157,194,true,'Plus');
node('ellipse','Company active dot',330,247,7,7,{fill:green});text('PT Alpha Distribusi',345,241,13,ink,'Medium');text('Data operasional',475,242,12,'#9197A3');
pill('Seluruh periode',1708,229,172,false,'CalendarDays');
surface('Summary / solid financial surface',328,286,1552,252);
rect('Summary column divider 1',845,310,1,204,'#EEF0F5');rect('Summary column divider 2',1362,310,1,204,'#EEF0F5');rect('Summary row divider',352,412,1504,1,'#EEF0F5');
const metrics=[['Total Sales',snapshot.sales.sales,'CircleDollarSign','Sales Invoice dibukukan'],['Total Purchases',snapshot.purchase.purchases,'ShoppingBag','Purchase Invoice dibukukan'],['Utang Belum Lunas',snapshot.purchase.outstanding,'FileClock','Purchase Invoice'],['Piutang Belum Lunas',snapshot.sales.outstanding,'FileClock','Sales Invoice'],['Menunggu Approval',snapshot.purchase.requestsPending,'ClipboardCheck','Purchase Request'],['Nilai Inventory',snapshot.purchase.inventoryValue,'Package','Seluruh Warehouse']];
metrics.forEach(([label,value,name,hint],i)=>{const x=352+(i%3)*517.333,y=307+Math.floor(i/3)*126;text(label,x,y,13,labelColor,'Medium');icon(name,x+437,y,18,'#8A93A4');title(i===4?String(value):money(value),x,y+25,33,ink);text(hint,x,y+75,11,'#939AA8');});
surface('Analytics / solid content surface',328,562,1172,366);title('Revenue & Expenses',356,587,20);text('Nilai Invoice, bukan laporan laba rugi.',356,620,12,labelColor);
rect('Time scope badge',1335,586,137,32,'#F5F6FA',16);text('6 bulan terakhir',1353,595,11.5,labelColor,'Medium');
node('ellipse','Sales legend',356,658,7,7,{fill:'#32A474'});text('Sales Invoice',373,654,11.5,labelColor,'Medium');node('ellipse','Purchase legend',486,658,7,7,{fill:'#99A8BD'});text('Purchase Invoice',503,654,11.5,labelColor,'Medium');
const chart=snapshot.purchaseChart.map(v=>({...v,sales:snapshot.salesChart.find(s=>s.month===v.month)?.sales||0}));const peak=Math.max(1,...chart.flatMap(v=>[v.sales,v.purchases])),unit=10**Math.floor(Math.log10(peak/4)),max=Math.ceil(peak/4/unit)*unit*4;
for(let i=0;i<5;i++){const y=696+i*43;rect('Chart grid / '+i,407,y,1065,1,'#EFF1F6');text(new Intl.NumberFormat('id-ID',{notation:'compact',maximumFractionDigits:1}).format(max*(4-i)/4),356,y-7,11,'#9097A5');}
chart.forEach((row,i)=>{const x=407+i*211;text(new Intl.DateTimeFormat('id-ID',{month:'short'}).format(new Date(row.month+'-01T12:00:00Z')),x-4,888,11.5,'#8A919E');});
for(const [key,color]of[['purchases','#9CAAC0'],['sales','#32A474']]){const points=chart.map((row,i)=>({x:i*211,y:172-row[key]/max*172}));if(key==='sales')vector('Sales area / same Alpha values',getPath({type:'monotone',layout:'horizontal',points,baseLine:172}),407,696,'canvas','#00000000',0,'#32A47415');const curve=vector('Chart / '+key,getPath({type:'monotone',layout:'horizontal',points}),407,696,'canvas',color,key==='sales'?2.5:1.8);if(key==='purchases')commands.find(c=>c.as===curve).params.props.dashes=[5,5];}
surface('Approval / solid empty-state surface',1524,562,356,366);title('Menunggu Persetujuan',1548,590,17);text('Purchase Request',1548,620,12,labelColor);rect('Approval count',1822,586,34,28,'#F0F3F9',14);text(String(snapshot.approvals.meta.total),1835,593,12,'#64728B','SemiBold');
if(!snapshot.approvals.data.length){node('ellipse','Reviewed state / green',1678,670,48,48,{fill:'#E6F5EC'});icon('CircleCheck',1689,681,26,'#37865B');title('Tidak ada Approval tertunda',1564,744,14,ink,'SemiBold');text('Semua Purchase Request telah ditinjau.',1565,769,11.5,labelColor);}
else{snapshot.approvals.data.slice(0,3).forEach((doc,i)=>{const y=665+i*57;icon('ClipboardCheck',1548,y,20,labelColor);text(doc.number,1580,y,12,ink,'SemiBold');text(doc.supplierName,1580,y+21,11,labelColor);});}
pill('Lihat Purchase Request',1548,858,308,false,'ArrowRight');
surface('Transactions / solid table surface',328,952,1552,420);title('Dokumen Sales & Procurement Terbaru',356,978,20);text('Aktivitas operasional company Anda',356,1010,12,labelColor);pill('Lihat Semua',1727,976,125,false);
const columns=[['Dokumen',356],['Jenis',618],['Relasi',888],['Tanggal',1280],['Nilai',1481],['Status',1742]];columns.forEach(([label,x])=>text(label,x,1053,11,'#8B92A0','Medium'));rect('Table heading hairline',352,1079,1504,1,'#EAEDF3');
const kinds={PURCHASE_REQUEST:'Purchase Request',PURCHASE_ORDER:'Purchase Order',PURCHASE_RECEIPT:'Purchase Receipt',PURCHASE_INVOICE:'Purchase Invoice',PAYMENT:'Payment',QUOTATION:'Quotation',SALES_ORDER:'Sales Order',DELIVERY_NOTE:'Delivery Note',SALES_INVOICE:'Sales Invoice'};
const rows=[...snapshot.purchases.data.map(v=>({...v,party:v.supplierName})),...snapshot.salesDocs.data.map(v=>({...v,party:v.customerName}))].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).slice(0,6);
rows.forEach((doc,i)=>{const y=1084+i*45;text(doc.number,356,y+14,12.5,'#3971B8','Medium');text(kinds[doc.kind],618,y+14,12.5,'#596170');text(doc.party,888,y+14,12.5,'#596170');text(new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(doc.date)),1280,y+14,12.5,'#7F8796');text(money(doc.amount),1481,y+14,12.5,ink,'Medium');const status={POSTED:'Dibukukan',APPROVED:'Disetujui',DRAFT:'Draft',PENDING:'Menunggu',CANCELLED:'Dibatalkan',REJECTED:'Ditolak'}[doc.status]||doc.status;const positive=['POSTED','APPROVED'].includes(doc.status);rect('Status / '+status,1742,y+8,108,28,positive?'#EAF6EE':'#F2F4F8',14);node('ellipse','Status marker',1754,y+19,5,5,{fill:positive?'#3D9360':'#8B94A4'});text(status,1767,y+16,11,positive?'#357D50':'#697384','Medium');if(i<5)rect('Table row hairline',352,y+44,1504,1,'#F0F2F6');});
text('Angka operasional yang dibukukan; belum termasuk pajak dan belum berupa laporan keuangan lengkap.',332,1397,11,'#969DAA');node('ellipse','Snapshot connection indicator',1725,1401,6,6,{fill:green});text('Terhubung ke API',1742,1396,11,'#87938B');
// Three portable design tokens; platform-specific fonts/assets are not embedded.
commands.push({command:'style.create',params:{type:'paint',name:'Comparison/Apple/Accent',value:[blue],description:'Action and current navigation only.'}},{command:'style.create',params:{type:'paint',name:'Comparison/Apple/Content',value:['#FFFFFF'],description:'Solid finance and table surface.'}},{command:'style.create',params:{type:'paint',name:'Comparison/Apple/Ink',value:[ink],description:'Primary text with strong contrast.'}});
await withFigcraft(async({tool,data})=>{
  const path=resolve('designs/enterprise-erp-dashboard-live.figcraft');
  const before=data(await tool('get_node',{document:path,id:2,depth:20}));
  const original=before.node||before;
  if(original.name!=='Enterprise ERP / Dashboard / Desktop 1920')throw Error('Original Dashboard frame does not match expected document');
  const originalHash=createHash('sha256').update(JSON.stringify(before)).digest('hex');
  const beforeDoc=data(await tool('inspect_document',{document:path,depth:1}));
  if(beforeDoc.pages.some(p=>p.children?.some(n=>n.name==='02 / Apple-inspired — Liquid Glass')))throw Error('Comparison already exists; refine it instead of appending duplicates');
  const bottom=original.y+original.height;commands[0].params.x=original.x;commands[0].params.y=bottom+220;
  commands.push({command:'node.create',params:{type:'text',name:'Comparison label',x:original.x,y:bottom+126,text:'02 / APPLE-INSPIRED',props:{fontFamily:'Inter',fontStyle:'SemiBold',fontSize:12,letterSpacing:1.7,fill:'#7D8799'}}},{command:'node.create',params:{type:'text',name:'Comparison description',x:original.x,y:bottom+155,text:'Liquid Glass · Hierarki yang lebih jelas · Data Alpha yang sama',props:{fontFamily:'Inter',fontSize:22,fill:'#3E485B'}}});
  writeFileSync('designs/apple-dashboard.commands.json',JSON.stringify(commands,null,2));
  const result=data(await tool('batch',{document:path,label:'Add Apple-inspired Dashboard below original',commands}));
  const frameId=result[0].id;writeFileSync('.local/apple-frame.json',JSON.stringify({document:path,frameId,originalHash,commandCount:commands.length}));
  const after=data(await tool('get_node',{document:path,id:2,depth:20}));
  if(createHash('sha256').update(JSON.stringify(after)).digest('hex')!==originalHash)throw Error('Original frame changed unexpectedly');
  await tool('save_file',{document:path});
  await tool('save_file',{document:path,path:resolve('designs/enterprise-erp-dashboard-comparison.figcraft')});
  await tool('export',{document:resolve('designs/enterprise-erp-dashboard-comparison.figcraft'),ids:[frameId],path:resolve('designs/enterprise-erp-dashboard-apple.png'),format:'png',scale:1});
  await tool('export',{document:path,ids:[frameId],path:resolve('designs/enterprise-erp-dashboard-apple.svg'),format:'svg',svgOutlineText:false});
  const inspection=data(await tool('get_node',{document:resolve('designs/enterprise-erp-dashboard-comparison.figcraft'),id:frameId,depth:20}));writeFileSync('designs/apple-dashboard-inspection.json',JSON.stringify(inspection,null,2));
  console.log(JSON.stringify({frameId,commands:commands.length,originalPreserved:true,belowY:bottom+220}));
});
