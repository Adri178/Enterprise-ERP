import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export async function withFigcraft(work) {
  const child = spawn('C:/Program Files/ArtCraft/FigCraft/figcraft-cli.exe', ['mcp', '--attach', '7979']);
  let sequence = 0; const pending = new Map();
  createInterface({ input: child.stdout }).on('line', line => { try { const message = JSON.parse(line); if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } } catch {} });
  child.stderr.resume();
  const rpc = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); setTimeout(() => reject(Error(`Figcraft timeout: ${method}`)), 45000).unref(); });
  async function tool(name, args = {}) {
    const response = await rpc('tools/call', { name, arguments: args });
    if (response.error || response.result?.isError) throw Error(JSON.stringify(response));
    return response.result;
  }
  const data = result => { const value = result.content?.find(block => block.type === 'text')?.text; try { return JSON.parse(value); } catch { return value; } };
  try {
    await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'Enterprise ERP Comparison', version: '1.0' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return await work({ tool, data });
  } finally { child.kill(); }
}
