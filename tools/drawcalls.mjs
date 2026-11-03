// Mede desenhos por quadro, triângulos e fps da página ao vivo, com a qualidade máxima.
import {createRequire} from 'node:module';
const req = createRequire('C:/Users/marcus.leite/.claude/skills/teardown/node_modules/x.js');
const {chromium} = req('playwright');
const b = await chromium.launch({args: ['--use-angle=d3d11', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1600, height: 900}});
await p.goto('file:///C:/Users/marcus.leite/Downloads/DV/xpto-cameras/teardown-out/dist/live.html');
await p.waitForFunction(() => window.SIM_SHOWN, null, {timeout: 60000});
await p.waitForTimeout(16000);
console.log(await p.evaluate(() => new Promise((res) => {
  const r = window.LIVE.st.renderer;
  r.info.autoReset = false;
  r.info.reset();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const i = r.info.render;
    let n = 0;
    const t0 = performance.now();
    const f = () => {
      n++;
      if (performance.now() - t0 < 3000) requestAnimationFrame(f);
      else res(JSON.stringify({desenhos_por_quadro: Math.round(i.calls / (i.frame || 1)), triangulos_por_quadro: Math.round(i.triangles / (i.frame || 1)), fps: (n / 3).toFixed(1), nivel: window.LIVE.tier}));
    };
    r.info.reset();
    requestAnimationFrame(f);
  }));
})));
await b.close();
