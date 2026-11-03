// A torre XPTO como página que se dirige: o reboque, a rua e o console do filme em tempo real. IMPLANTAR, MONITORAR e
// RECOLHER iniciam uma sequência, o play pausa, a linha do tempo arrasta, VELOCIDADE muda o ritmo; as 7 vistas, os 5
// modos de exibição, órbita arrastando e zoom na roda. Parada, ela toca o SCRIPT do filme como passeio automático
// com o ponteiro do operador; um clique, arraste, roda ou tecla devolve o controle, 25 s sem mexer retoma o passeio.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole, DISPLAY, FEED, SEQS, VIEWS} from './console.js';
import {absView, BLEND, camAt, displayAt, DURATION, isNear, lprShown, makeConsoleFrame, makeCursor, mechAt, seqAt, ss, viewAt, VIEW_FN} from './film.js';
import {SEQ} from './kin.js';
import {createXptoStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const SPEED = [0.1, 2];
const speedK = (v) => (v - SPEED[0]) / (SPEED[1] - SPEED[0]);

const CSS = `
html,body{background:#e9eef2;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(1.04)}
.bt:active{transform:scale(.96)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:810px;top:104px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:24px;padding:0 13px;border:1px solid rgba(255,255,255,.85);border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.7),rgba(255,255,255,.38));-webkit-backdrop-filter:blur(14px) saturate(180%);backdrop-filter:blur(14px) saturate(180%);box-shadow:inset 0 1px 0 #fff,0 4px 14px rgba(20,40,90,.14);color:#0a0a4a;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#e5484d}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#7d8696;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
.boot{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font:600 12px 'JetBrains Mono',monospace;letter-spacing:2px;color:#7d8696;background:#e9eef2;z-index:99}
`;

export async function runLive() {
  document.title = 'XPTO inc. · Torre de Monitoramento Móvel';
  document.documentElement.lang = 'pt-BR';
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const boot = document.createElement('div');
  boot.className = 'boot';
  boot.textContent = 'CARREGANDO A TORRE XPTO…';
  document.body.appendChild(boot);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  await document.fonts.ready;
  const st = await createXptoStage({canvas});
  const ui = createConsole(app);
  const tourCursor = makeCursor(ui);
  const frameConsole = makeConsoleFrame(ui, st);

  // ------------------------------------------------------------ níveis de qualidade
  const TIERS = [
    {samples: 8, ao: true, shadow: 4096, pr: 2},
    {samples: 4, ao: false, shadow: 2048, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    // no nível mais leve o vidro perde o desfoque (backdrop-filter custa caro sobre o WebGL)
    document.body.classList.toggle('lite', tier === 2);
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Gire o celular para ver o console inteiro';
  document.body.appendChild(note);

  // ------------------------------------------------------------ estado
  let T = 0;
  let seq = 'deploy';
  let tau = 0;
  let speed = 1;
  let paused = false;
  let view = 'hero';
  let viewAt0 = 0;
  const disp = Object.fromEntries(DISPLAY.map((k) => [k, {on: 0, t: -9}]));
  const off = {az: 0, el: 0, k: 1};
  const cam = absView(VIEW_FN.hero(0), 0);
  let ring = {t: -9, x: 0, y: 0};
  const eased = (k, dur = 0.7) => {
    const d = disp[k];
    const x = ss(d.t, d.t + dur, T);
    return d.on ? x : 1 - x;
  };
  const pulse = (k) => (ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]});

  // ------------------------------------------------------------ o passeio
  const AP = {on: true, t0: 0, loop: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    paused = false;
    speed = 1;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    const [t0, v] = viewAt(cyc);
    view = v;
    viewAt0 = T - (cyc - t0);
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });
  const syncDisplay = (cyc) => {
    const want = displayAt(cyc);
    for (const k of DISPLAY) {
      if (disp[k].on !== want[k]) {
        disp[k].on = want[k];
        disp[k].t = T;
      }
    }
  };

  // ------------------------------------------------------------ controles
  const startSeq = (s) => {
    seq = s;
    tau = 0;
    paused = false;
  };
  for (const s of SEQS)
    ui.btn[s].addEventListener('click', () => {
      takeOver();
      pulse(s);
      startSeq(s);
    });
  for (const v of VIEWS)
    ui.btn[v].addEventListener('click', () => {
      takeOver();
      pulse(v);
      view = v;
      viewAt0 = T;
      Object.assign(off, {az: 0, el: 0, k: 1});
    });
  for (const k of DISPLAY)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      disp[k].on = disp[k].on ? 0 : 1;
      disp[k].t = T;
    });
  ui.btn.play.addEventListener('click', () => {
    takeOver();
    pulse('play');
    if (tau >= SEQ[seq].dur - 1e-3) tau = 0;
    paused = !paused;
  });
  const slider = (x0, w, y, apply) => {
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${x0 - 8}px`, top: `${y - 11}px`, width: `${w + 16}px`, height: '22px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      apply(clamp((x - x0) / w, 0, 1));
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      d.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  };
  slider(ui.TL.x, ui.TL.w, 821, (k) => {
    tau = k * SEQ[seq].dur;
    paused = true;
  });
  slider(ui.SP.x, ui.SP.w, 824, (k) => (speed = SPEED[0] + k * (SPEED[1] - SPEED[0])));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = VIEWS[Number(key) - 1];
    if (v) ui.btn[v].click();
    else if (key === ' ') ui.btn.play.click();
    else if (key === 'i') ui.btn.deploy.click();
    else if (key === 'm') ui.btn.patrol.click();
    else if (key === 'r') ui.btn.stow.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 'c') ui.btn.cover.click();
    else if (key === 'e') ui.btn.exploded.click();
    else if (key === 'n') ui.btn.night.click();
    else if (key === 'o') ui.btn.orbit.click();
    else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -25, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.6);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ o quadro
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let tgt;
    let cursor;
    let since;
    if (AP.on) {
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      const cyc = c - loop * DURATION;
      if (loop > AP.loop) AP.loop = loop;
      const s = seqAt(cyc);
      seq = s.seq;
      tau = s.tau;
      syncDisplay(cyc);
      tgt = camAt(cyc, displayAt(cyc).orbit);
      const [t0, v] = viewAt(cyc);
      view = v;
      since = cyc - t0;
      cursor = tourCursor(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
    } else {
      if (T - lastInput > IDLE) startTour();
      if (!paused) tau = Math.min(SEQ[seq].dur, tau + dt * speed);
      since = T - viewAt0;
      tgt = absView(VIEW_FN[view](since), mechAt(seq, tau).m.h);
      tgt.az += off.az + (disp.orbit.on ? 9 * (T - disp.orbit.t) : 0);
      tgt.el = clamp(tgt.el + off.el, -20, 88);
      tgt.d *= off.k;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }
    const {m, panRate} = mechAt(seq, tau);
    const k = 1 - Math.exp(-dt / (AP.on ? 0.25 : 0.5));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy', 'head']) cam[key] += (tgt[key] - cam[key]) * k;
    const night = eased('night', 0.9);
    const feeds = {ptz: FEED.ptz, lpr: FEED.lpr, lprK: lprShown(m)};
    const out = st.frame(m, {...cam, az: cam.az * D2R, el: cam.el * D2R}, {explode: eased('exploded', 0.8), cover: eased('cover'), night, feeds});
    const lastBox = out.plateBox;
    const display = Object.fromEntries(DISPLAY.map((x) => [x, disp[x].on]));
    frameConsole({seq, tau, m, panRate, view, display, night, near: isNear(view), labels: eased('labels', 0.6) * ss(BLEND * 0.5, BLEND * 0.5 + 0.6, since), cursor, plateBox: lastBox, faceBox: out.faceBox, tour: AP.on, since, paused: AP.on ? false : paused, speed: AP.on ? 1 : speed, speedK: speedK(AP.on ? 1 : speed)});
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>PASSEIO AUTOMÁTICO · CLIQUE PARA ASSUMIR' : '▶ RETOMAR PASSEIO';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      boot.remove();
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, get tier() {
    return tier;
  }, get T() {
    return T;
  }};
}
