// Gravação de tela de celular, quadro a quadro: a página ao vivo num celular simulado (390 x 844, escala 3, como um
// iPhone), com um relógio virtual: cada quadro avança 1/30 s, é desenhado e fotografado; o ffmpeg junta tudo com a
// trilha do filme. O passeio automático do celular segue o mesmo roteiro do filme, então a trilha bate.
//   node tools/phonerec.mjs <pagina.html> <segundos> <trilha.wav> <saida.mp4>
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const req = createRequire('C:/Users/marcus.leite/.claude/skills/teardown/node_modules/x.js');
const {chromium} = req('playwright');
const [page, secs, wav, out] = process.argv.slice(2);
const FPS = 30;
const b = await chromium.launch({args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']});
const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
await ctx.addInitScript(() => {
  // relógio virtual: performance.now e requestAnimationFrame só andam quando o gravador manda
  let now = 0;
  let q = [];
  performance.now = () => now;
  window.requestAnimationFrame = (cb) => q.push(cb);
  window.__step = (dt) => {
    now += dt;
    const run = q;
    q = [];
    for (const f of run) f(now);
    return run.length;
  };
});
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERRO', e.message));
await p.goto('file:///' + page + '?rec');
await p.waitForFunction(() => window.LIVE, null, {timeout: 120000, polling: 500});
// o primeiro quadro (sai a tela de abertura) e o fade dela
await p.evaluate(() => window.__step(16));
await p.waitForTimeout(800);
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-vf', 'scale=1170:2532:flags=lanczos', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], {stdio: ['pipe', 'inherit', 'inherit']});
const N = Math.round(Number(secs) * FPS);
for (let i = 0; i < N; i++) {
  await p.evaluate((dt) => window.__step(dt), 1000 / FPS);
  const png = await p.screenshot({type: 'jpeg', quality: 92});
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 300 === 0) console.log(`${(i / FPS).toFixed(0)} s de ${secs}`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
console.log('pronto', out);
await b.close();
