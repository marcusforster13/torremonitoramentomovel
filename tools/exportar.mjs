import fs from 'node:fs';
import {createRequire} from 'node:module';
const req = createRequire('C:/Users/marcus.leite/.claude/skills/teardown/node_modules/x.js');
const {chromium} = req('playwright');
const b = await chromium.launch({args: ['--use-angle=d3d11', '--ignore-gpu-blocklist']});
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERRO', e.message));
await p.goto('file:///C:/Users/marcus.leite/Downloads/DV/xpto-cameras/teardown-out/dist/exportar_src.html?capture');
await p.waitForFunction(() => window.OUT, null, {timeout: 120000});
fs.mkdirSync('exportar', {recursive: true});
for (const [n, d] of await p.evaluate(() => window.OUT)) {
  fs.writeFileSync('exportar/' + n, Buffer.from(d, 'base64'));
  console.log(n, (fs.statSync('exportar/' + n).size / 1e6).toFixed(2), 'MB');
}
await b.close();
