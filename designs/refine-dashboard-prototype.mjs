import { readFileSync, writeFileSync } from 'node:fs';
import { withFigcraft } from './figcraft-mcp.mjs';
const manifest = JSON.parse(readFileSync('designs/dashboard-prototype-manifest.json'));
await withFigcraft(async ({ tool, data }) => {
  const tree = data(await tool('inspect_document', { document: 5, depth: 20 }));
  const all = [];
  function walk(n) { all.push(n); n.children?.forEach(walk); }
  tree.pages.forEach(walk);
  const list = all.find(n => n.id === manifest.documents);
  const toolbar = list.children.find(n => n.name.startsWith('Controls /'));
  const breadcrumb = toolbar.children.find(n => ['Dashboard', 'Daftar Dokumen'].includes(n.characters));
  const variables = data(await tool('run_command', { document: 5, command: 'variable.list' }));
  const variable = name => variables.variables.find(v => v.name === name).id;
  const commands = [{ command: 'node.set', params: { ids: [breadcrumb.id], props: { characters: 'Daftar Dokumen' } } }];
  for (let id = 623; id <= 647; id++) commands.push({ command: 'variable.bind', params: { ids: [id], field: 'visible', variable: variable('Show Alpha snapshot') } });
  for (const id of [657, 658]) commands.push({ command: 'variable.bind', params: { ids: [id], field: 'visible', variable: variable('Show Alpha snapshot') } });
  for (const [as, text, x, y, size] of [['approvalEmptyTitle', 'Belum ada Purchase Request', 1564, 744, 14], ['approvalEmptyNote', 'Skenario Company ini belum memiliki transaksi.', 1548, 769, 11]])
    if (!all.some(n => n.characters === text)) commands.push({ command: 'node.create', as, params: { type: 'text', parent: 362, x, y, text, props: { fontFamily: 'Inter', fontSize: size, fill: '#626D7E' } } },
      { command: 'variable.bind', params: { ids: [{ $ref: as }], field: 'visible', variable: variable('Show scenario empty') } });
  for (const n of all.filter(n => n.characters === '⌘ K')) commands.push({ command: 'node.set', params: { ids: [n.id], props: { characters: 'Ctrl K', x: 1149 } } });
  const search = all.find(n => n.id === manifest.frames['Global search']);
  for (const n of search.children.filter(n => n.y >= 260 && n.y < 324)) commands.push({ command: 'variable.bind', params: { ids: [n.id], field: 'visible', variable: variable(n.characters === 'Tidak ada dokumen pada skenario Company ini.' ? 'Show scenario empty' : 'Show Alpha snapshot') } });
  if (!search.children.some(n => n.characters === 'Tidak ada dokumen pada skenario Company ini.')) commands.push({ command: 'node.create', as: 'emptySearch', params: { type: 'text', parent: search.id, x: 32, y: 280, text: 'Tidak ada dokumen pada skenario Company ini.', props: { fontFamily: 'Inter', fontSize: 14, fill: '#626D7E' } } },
    { command: 'variable.bind', params: { ids: [{ $ref: 'emptySearch' }], field: 'visible', variable: variable('Show scenario empty') } });
  const notices = all.find(n => n.id === manifest.frames.Notifications);
  for (const n of notices.children.filter(n => n.type === 'TEXT' && n.y >= 116 && n.y <= 150)) commands.push({ command: 'variable.bind', params: { ids: [n.id], field: 'visible', variable: variable(n.characters === 'Belum ada Notifications pada Company ini.' ? 'Show scenario empty' : 'Show Alpha snapshot') } });
  if (!notices.children.some(n => n.characters === 'Belum ada Notifications pada Company ini.')) commands.push({ command: 'node.create', as: 'emptyNotice', params: { type: 'text', parent: notices.id, x: 28, y: 116, text: 'Belum ada Notifications pada Company ini.', props: { fontFamily: 'Inter', fontSize: 14, fill: '#626D7E' } } },
    { command: 'variable.bind', params: { ids: [{ $ref: 'emptyNotice' }], field: 'visible', variable: variable('Show scenario empty') } });
  const filterIndex = list.children.findIndex(n => n.boundVariables?.characters === variable('Document filter label'));
  if (!list.children.some(n => n.name === 'Filter control surface')) commands.push({ command: 'node.create', params: { type: 'rectangle', parent: list.id, index: filterIndex, name: 'Filter control surface', x: 360, y: 410, width: 300, height: 44, props: { fill: '#EDF2FA', cornerRadius: 22 } } },
    { command: 'node.create', params: { type: 'text', parent: list.id, name: 'Filter chevron', x: 628, y: 421, text: '⌄', props: { fontFamily: 'Inter', fontSize: 18, fill: '#626D7E' } } });
  writeFileSync('designs/refine-prototype.commands.json', JSON.stringify(commands, null, 2));
  await tool('batch', { document: 5, label: 'Refine Company context and prototype controls', commands });
  await tool('save_file', { document: 5 });
  console.log(JSON.stringify({ refined: commands.length }));
});
