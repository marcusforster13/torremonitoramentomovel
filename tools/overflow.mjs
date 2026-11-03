// Confere se algum texto do console passa da borda do painel em que está, em vários instantes do filme.
import {createRequire} from 'node:module';
const req = createRequire('C:/Users/marcus.leite/.claude/skills/teardown/node_modules/x.js');
const {chromium} = req('playwright');
const b = await chromium.launch({args: ['--use-angle=d3d11', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1600, height: 900}});
await p.goto('file:///C:/Users/marcus.leite/Downloads/DV/xpto-cameras/teardown-out/dist/film.html?capture');
await p.waitForFunction(() => window.SIM?.ready, null, {timeout: 60000});
const bad = new Set();
for (let t = 0; t < 46; t += 0.5) {
  const r = await p.evaluate((t) => {
    window.SIM.render(t);
    const panels = [...document.querySelectorAll('.cp')].map((e) => e.getBoundingClientRect());
    const out = [];
    for (const e of document.querySelectorAll('.ui div, .ui img')) {
      if (e.classList.contains('cp') || e.closest('.alert,.call') || !e.offsetParent) continue;
      if (!e.childElementCount && !e.textContent.trim() && e.tagName !== 'IMG') continue;
      const r = e.getBoundingClientRect();
      if (!r.width) continue;
      const cx = r.left + 2;
      const cy = r.top + r.height / 2;
      const host = panels.find((q) => cx >= q.left && cx <= q.right && cy >= q.top && cy <= q.bottom);
      const range = document.createRange();
      range.selectNodeContents(e);
      const tr = e.tagName === 'IMG' ? r : range.getBoundingClientRect();
      if (host && (tr.right > host.right - 4 || tr.bottom > host.bottom - 2)) out.push(`${e.textContent.trim().slice(0, 40)} → ${Math.round(tr.right - host.right + 4)}px`);
    }
    return out;
  }, t);
  for (const x of r) bad.add(`t=${t}: ${x}`);
}
console.log(bad.size ? [...bad].join('\n') : 'nenhum texto fora dos painéis');
await b.close();
