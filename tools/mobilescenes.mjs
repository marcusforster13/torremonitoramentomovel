// O passeio no celular em pé: pula para cada cena e fotografa só a parte de cima (cena + legenda).
import {createRequire} from 'node:module';
const req = createRequire('C:/Users/marcus.leite/.claude/skills/teardown/node_modules/x.js');
const {chromium} = req('playwright');
const b = await chromium.launch({args: ['--use-angle=d3d11', '--ignore-gpu-blocklist']});
const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file:///C:/Users/marcus.leite/Downloads/DV/xpto-cameras/public/index.html');
await p.waitForFunction(() => window.SIM_SHOWN, null, {timeout: 90000});
const times = (process.argv[2] ?? '3,8,12,18,22.5,28,31,37,40,45.5,53,62').split(',').map(Number);
for (const t of times) {
  await p.evaluate((t) => window.LIVE.tourAt(t - 2.6), t);
  await p.waitForTimeout(2600);
  await p.screenshot({path: `teardown-out/mcena-${String(t).replace('.', '_')}.png`, clip: {x: 0, y: 0, width: 390, height: 700}});
}
console.log('erros', errs);
await b.close();
