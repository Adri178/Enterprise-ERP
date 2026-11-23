import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { withFigcraft } from './figcraft-mcp.mjs';

const manifest = JSON.parse(readFileSync('designs/dashboard-prototype-manifest.json'));
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
await withFigcraft(async ({ tool, data }) => {
  const run = (command, params) => tool('run_command', { document: 5, command, params });
  const inspect = id => tool('get_node', { document: 5, id, depth: 20, fields: ['name', 'type', 'characters', 'visible', 'boundVariables', 'interactions', 'x', 'y', 'width', 'height', 'flows'] }).then(data);
  const tree = data(await tool('inspect_document', { document: 5, depth: 20 }));
  const nodes = new Map(), roots = new Map();
  function walk(n) { assert(!n.truncated, `Truncated inspection at ${n.id}`); assert(!nodes.has(n.id)); nodes.set(n.id, n); n.children?.forEach(walk); }
  for (const page of tree.pages) { page.children.forEach(n => roots.set(n.id, n)); walk(page); }
  const variables = data(await run('variable.list'));
  const variableIds = new Set(variables.variables.map(v => v.id));
  const collections = new Map(variables.collections.map(v => [v.id, v]));
  let interactions = 0, actions = 0;
  check('All prototype destinations, variable bindings and mode actions resolve', () => {
    for (const n of nodes.values()) {
      for (const id of Object.values(n.boundVariables || {})) assert(variableIds.has(id), `Missing binding ${id}`);
      for (const interaction of n.interactions || []) {
        interactions++;
        for (const a of interaction.actions || []) {
          actions++;
          if (a.dest != null) assert(roots.has(a.dest), `Missing top-level destination ${a.dest}`);
          if (a.variable) assert(variableIds.has(a.variable));
          if (a.collection) assert(collections.get(a.collection)?.modes.some(m => m.id === a.mode));
          assert.notEqual(a.type, 'openUrl', 'Prototype must not navigate to remote services');
        }
      }
    }
    assert(interactions >= 300);
  });
  check('Every modal has close and Escape interactions', () => {
    for (const root of roots.values()) {
      if (!root.name.startsWith('Prototype /') || root.id === manifest.documents) continue;
      assert(root.children.some(n => n.name === 'Hotspot / Tutup' && n.interactions?.some(i => i.actions.some(a => a.type === 'closeOverlay'))), root.name);
      assert(root.interactions?.some(i => i.trigger.key === 'Escape'), root.name);
      assert(root.width <= 1920 && root.height <= 1440);
    }
  });
  check('Exact primary module hierarchy is preserved', () => {
    for (const name of ['Organization', 'Master Data', 'Procurement', 'Inventory', 'Sales & CRM', 'Accounting', 'Human Resources', 'Manufacturing', 'Reports & Analytics', 'Settings & Permissions'])
      assert([...roots.values()].some(n => n.name === `Prototype / Menu ${name}`), name);
  });
  check('Prototype action boundary is local navigation and simulation only', () => {
    const allowed = new Set(['openOverlay', 'swapOverlay', 'closeOverlay', 'navigate', 'setVariable', 'setVariableMode']);
    for (const n of nodes.values()) for (const i of n.interactions || []) for (const a of i.actions) assert(allowed.has(a.type));
  });
  const company = collections.get(manifest.companyCollection);
  const filter = variables.collections.find(c => c.name === 'Prototype document filter');
  const getFlat = n => [n, ...(n.children || []).flatMap(getFlat)];
  const mode = (ids, collection, name) => run('variable.setMode', { ids, collection, mode: name });
  const primaryRoots = [362, manifest.documents, manifest.frames['Global search'], manifest.frames.Notifications];
  const originalValues = variables.variables.filter(v => v.collection === 'VariableCollectionId:2');
  try {
    for (const [name, label, amount, empty] of [['Alpha', 'PT Alpha Distribusi', 'Rp 2.220.000', false], ['Beta', 'PT Beta Industri', 'Rp 0', true], ['Gamma', 'PT Gamma Digital', 'Rp 0', true]]) {
      await mode(primaryRoots, company.id, name);
      const dashboard = getFlat(await inspect(362));
      const documents = getFlat(await inspect(manifest.documents));
      const search = getFlat(await inspect(manifest.frames['Global search']));
      check(`${name}: Company labels, KPI, table/graph empty state and scoped search`, () => {
        assert.equal(dashboard.find(n => n.id === 528).characters, label);
        assert.equal(dashboard.find(n => n.id === 580).characters, amount);
        assert.equal(dashboard.find(n => n.name === 'Scenario / empty chart').visible, empty);
        assert.equal(dashboard.find(n => n.name === 'Scenario / empty transactions').visible, empty);
        assert.equal(documents.find(n => n.name === 'Company-scoped document rows').visible, !empty);
        assert.equal(search.find(n => n.name.startsWith('Hotspot / PO-')).visible, !empty);
        assert.equal(search.find(n => n.characters === 'Tidak ada dokumen pada skenario Company ini.').visible, empty);
      });
      if (name === 'Beta') await tool('export', { document: 5, ids: [362], path: resolve('designs/enterprise-erp-prototype-company-beta.png'), format: 'png', scale: .75 });
    }
    for (const selected of ['All', 'Procurement', 'Sales']) {
      await mode([manifest.documents], filter.id, selected);
      const list = getFlat(await inspect(manifest.documents));
      check(`${selected}: document filter shows exactly one row group`, () => {
        for (const name of ['All', 'Procurement', 'Sales']) assert.equal(list.find(n => n.name === `Filtered rows / ${name}`).visible, name === selected);
      });
    }
    for (const [name, value] of [['quantityChoice', '2'], ['formTotal', 'Rp 194.000'], ['supplierChoice', 'Supplier Contoh B']]) {
      const variable = variables.variables.find(v => v.name === name);
      await run('variable.set', { variable: variable.id, value });
    }
    const form = getFlat(await inspect(manifest.frames['Buat Purchase Request']));
    check('Transaction preset bindings render quantity, total and Supplier correctly', () => {
      assert(form.some(n => n.characters === '2'));
      assert(form.some(n => n.characters === 'Rp 194.000'));
      assert(form.some(n => n.characters === 'Supplier Contoh B'));
    });
    await tool('export', { document: 5, ids: [manifest.frames['Buat Purchase Request']], path: resolve('designs/enterprise-erp-prototype-form.png'), format: 'png', scale: 1 });
  } finally {
    // Tests only alter native design variables; restore the default presentation state.
    await mode(primaryRoots, company.id, null);
    await mode([manifest.documents], filter.id, null);
    for (const variable of originalValues) await run('variable.set', { variable: variable.id, value: Object.values(variable.values)[0].value });
  }
  await tool('save_file', { document: 5 });
  for (const [id, file] of [[362, 'enterprise-erp-dashboard-prototype.png'], [manifest.documents, 'enterprise-erp-prototype-documents.png']])
    await tool('export', { document: 5, ids: [id], path: resolve('designs', file), format: 'png', scale: .75 });
  const report = { checks, passed: checks.length, nodes: nodes.size, interactions, actions,
    limitations: ['Click playback was not tested: native app access approval timed out.', 'Text entry uses presets; company Beta/Gamma are empty prototype scenarios.', 'Module pages outside the Dashboard slice show a scope notice.', 'This verification checks native definitions and rendered variable states, not runtime web ERP behavior.'] };
  writeFileSync('designs/dashboard-prototype-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
});
