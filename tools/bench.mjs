// Desenha os mesmos quadros do filme N vezes e mede o tempo médio por quadro (com gl.finish).
import {createRequire} from 'node:module';
const req = createRequire('C:/Users/marcus.leite/.claude/skills/teardown/node_modules/x.js');
const {chromium} = req('playwright');
const b = await chromium.launch({args: ['--use-angle=d3d11', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1600, height: 900}});
await p.goto('file:///C:/Users/marcus.leite/Downloads/DV/xpto-cameras/teardown-out/dist/film.html?capture');
await p.waitForFunction(() => window.SIM?.ready, null, {timeout: 60000});
const r = await p.evaluate(() => {
  const gl = document.getElementById('gl').getContext('webgl2');
  const res = {};
  for (const t of [3, 17, 46, 68]) {
    for (let i = 0; i < 10; i++) window.SIM.render(t);
    gl.finish();
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) window.SIM.render(t + i * 0.001);
    gl.finish();
    res['t' + t] = ((performance.now() - t0) / 60).toFixed(2) + ' ms';
  }
  return res;
});
console.log(process.argv[2], JSON.stringify(r));
await b.close();
