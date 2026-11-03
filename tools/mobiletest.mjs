// A página no celular: em pé e deitado, prints da tela e das abas, erros do console.
import {createRequire} from 'node:module';
const req = createRequire('C:/Users/marcus.leite/.claude/skills/teardown/node_modules/x.js');
const {chromium} = req('playwright');
const url = process.argv[2] ?? 'file:///C:/Users/marcus.leite/Downloads/DV/xpto-cameras/public/index.html';
const b = await chromium.launch({args: ['--use-angle=d3d11', '--ignore-gpu-blocklist']});
for (const [name, w, h] of [['pe', 390, 844], ['deitado', 844, 390]]) {
  const ctx = await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'});
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url);
  await p.waitForFunction(() => window.SIM_SHOWN, null, {timeout: 90000});
  await p.waitForTimeout(19000);
  await p.screenshot({path: `teardown-out/cel-${name}-1.png`});
  const info = await p.evaluate(() => ({mobile: window.LIVE.mobile, largura: document.documentElement.scrollWidth, janela: innerWidth, altura: document.documentElement.scrollHeight}));
  console.log(name, JSON.stringify(info));
  // rola até as abas, abre a de LPR e a de controles
  await p.evaluate(() => window.scrollTo(0, document.querySelector('.mx-tabs').offsetTop - 60));
  await p.waitForTimeout(400);
  await p.getByRole('button', {name: 'LPR', exact: true}).tap();
  await p.waitForTimeout(400);
  await p.screenshot({path: `teardown-out/cel-${name}-2.png`});
  await p.getByRole('button', {name: 'CONTROLES', exact: true}).tap();
  await p.waitForTimeout(300);
  await p.screenshot({path: `teardown-out/cel-${name}-3.png`, fullPage: true});
  console.log(name, 'erros', errs);
  await ctx.close();
}
await b.close();
