import { withFigcraft } from './figcraft-mcp.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const { frameId, originalHash } = JSON.parse(readFileSync('.local/apple-frame.json','utf8'));
const luminance = hex => { const c=hex.slice(1,7).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722; };
const contrast = (fg,bg) => (Math.max(luminance(fg),luminance(bg))+.05)/(Math.min(luminance(fg),luminance(bg))+.05);
await withFigcraft(async({tool,data})=>{
  const document=resolve('designs/enterprise-erp-dashboard-comparison.figcraft');
  const read=data(await tool('get_node',{document,id:frameId,depth:20})), root=read.node||read, nodes=[];
  function walk(n){nodes.push(n);for(const c of n.children||[])walk(c);}walk(root);
  const commands=[];
  for(const n of nodes){const color=n.fills?.[0]?.color;if(n.type==='TEXT'&&color&&color!=='#FFFFFF'&&contrast(color,'#F5F6FA')<4.5)commands.push({command:'node.set',params:{ids:[n.id],props:{fill:color==='#007AFF'?'#0061D1':'#626D7E'}}});if(n.type==='RECTANGLE'&&n.name==='Buat Transaksi')commands.push({command:'node.set',params:{ids:[n.id],props:{fill:'#0065DB'}}});}
  if(commands.length)await tool('batch',{document,label:'Improve small-text contrast on Apple comparison',commands});
  await tool('save_file',{document});
  await tool('export',{document,ids:[frameId],path:resolve('designs/enterprise-erp-dashboard-apple.png'),format:'png',scale:1});
  await tool('export',{document,ids:[frameId],path:resolve('designs/enterprise-erp-dashboard-apple.svg'),format:'svg',svgOutlineText:false});
  await tool('export',{document,ids:[2,frameId],path:resolve('designs/enterprise-erp-dashboard-both.png'),format:'png',scale:.5});
  const original=data(await tool('get_node',{document,id:2,depth:20}));if(createHash('sha256').update(JSON.stringify(original)).digest('hex')!==originalHash)throw Error('Original frame changed');
  const final=data(await tool('get_node',{document,id:frameId,depth:20}));writeFileSync('designs/apple-dashboard-inspection.json',JSON.stringify(final,null,2));
  const report={adjustedLayers:commands.length,originalPreserved:true,secondaryInk:'#626D7E',secondaryOnCanvas:contrast('#626D7E','#F5F6FA'),whiteOnAction:contrast('#FFFFFF','#0065DB'),action:'#0065DB',note:'Static token check only; not a full interactive accessibility audit.'};writeFileSync('designs/apple-contrast-check.json',JSON.stringify(report,null,2));
  await tool('run_command',{document,command:'view.set',params:{zoom:.48,cx:960,cy:2380}});console.log(JSON.stringify(report));
});
