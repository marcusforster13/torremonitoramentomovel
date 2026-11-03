// O filme da torre XPTO: o reboque chega fechado e é implantado, os carros passam, a PTZ rastreia, as LPRs leem as
// placas; o operador percorre as vistas (geral, rua, LPR, PTZ, cabeça explodida, planta com a noite em IR) e recolhe
// tudo no fim. Uma função pura de t: o mesmo SCRIPT vira o passeio automático da página ao vivo.
import * as THREE from 'three';
import {runSim} from 'teardown-kit/runtime.js';
import {createConsole, DISPLAY, FEED} from './console.js';
import {phaseOf, SEQ, stateAt, statusOf} from './kin.js';
import {createXptoStage} from './stage.js';

export const SCRIPT = [
  {t: 0, seq: 'deploy', view: 'hero'},
  {t: 1.6, display: 'labels'},
  {t: 3.4, view: 'lateral'},
  {t: 6.4, view: 'hero'},
  {t: 12.0, display: 'labels'},
  {t: 13.4, seq: 'patrol', view: 'rua'},
  {t: 14.2, display: 'cover'},
  {t: 15.2, view: 'lpr'},
  {t: 18.2, view: 'ptz'},
  {t: 18.6, display: 'labels'},
  {t: 20.0, display: 'labels'},
  {t: 20.2, view: 'calcada'},
  {t: 24.0, view: 'cabeca'},
  {t: 24.6, display: 'exploded'},
  {t: 26.8, display: 'exploded'},
  {t: 27.2, view: 'planta'},
  {t: 27.6, display: 'night'},
  {t: 30.6, display: 'night'},
  {t: 31.0, display: 'cover'},
  {t: 31.4, view: 'hero'},
  {t: 31.8, display: 'orbit'},
  {t: 34.4, seq: 'stow'},
];
export const DURATION = 46;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'xpto', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ a sequência e a exibição no instante t do filme
export const seqAt = (t) => {
  const e = SCRIPT.filter((x) => x.seq && x.t <= t).pop();
  return {seq: e.seq, tau: Math.min(SEQ[e.seq].dur, t - e.t)};
};
export const displayAt = (t) => {
  const out = Object.fromEntries(DISPLAY.map((k) => [k, 0]));
  for (const e of SCRIPT) if (e.display && e.t <= t) out[e.display] = out[e.display] ? 0 : 1;
  return out;
};
const lastFlip = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).pop()?.t ?? -9;
export const easedDisplay = (key, t, dur = 0.7) => {
  const on = displayAt(t)[key];
  const k = ss(lastFlip(key, t), lastFlip(key, t) + dur, t);
  return on ? k : 1 - k;
};
/** O estado da torre e a velocidade de pan (derivada numérica do mesmo modelo). */
export const mechAt = (seq, tau) => {
  const m = stateAt(seq, tau);
  const n = stateAt(seq, Math.min(SEQ[seq].dur, tau + 0.04));
  const d = ((((n.ptz.pan - m.ptz.pan + 540) % 360) - 180) / 0.04);
  return {m, panRate: tau + 0.04 <= SEQ[seq].dur ? d : 0};
};

// ------------------------------------------------------------ vistas: {tx, ty, tz, az, el, d (graus, m), sx, sy, head}
export const VIEW_FN = {
  hero: (u) => ({tx: -1.1, ty: 2.95, tz: 0.4, az: 38 + 1.5 * u, el: 11, d: 14, sx: 10, sy: -18, head: 0}),
  lateral: (u) => ({tx: -1.2, ty: 2.95, tz: 0.2, az: 8 + 1.2 * u, el: 5, d: 13, sx: 10, sy: -18, head: 0}),
  rua: (u) => ({tx: -1.4, ty: 2.0, tz: 2.6, az: 58 + 1.0 * u, el: 15, d: 17, sx: 10, sy: -22, head: 0}),
  calcada: (u) => ({tx: 2.6, ty: 2.1, tz: 1.6, az: 20 + 1.0 * u, el: 8, d: 13, sx: 10, sy: -22, head: 0}),
  cabeca: (u) => ({tx: 0, ty: -0.3, tz: 0.05, az: 215 + 4 * u, el: 9, d: 3.4, sx: 10, sy: -24, head: 1}),
  ptz: (u) => ({tx: 0.05, ty: -0.35, tz: 0.3, az: 28 + 3 * u, el: 4, d: 3.0, sx: 10, sy: -24, head: 1}),
  lpr: (u) => ({tx: -3.6, ty: 2.2, tz: 2.8, az: 80 + 0.8 * u, el: 15, d: 14.5, sx: 10, sy: -22, head: 0}),
  planta: (u) => ({tx: -1.0, ty: 0, tz: 2.2, az: 2 * u, el: 82, d: 19, sx: 10, sy: -16, head: 0}),
};
const VIEWS_T = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  return o;
};
export const camAt = (t, orbit = 0) => {
  let i = 0;
  while (i < VIEWS_T.length - 1 && VIEWS_T[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS_T[i][1]](t - VIEWS_T[i][0]);
  let o = cur;
  if (i > 0) {
    const k = ss(VIEWS_T[i][0], VIEWS_T[i][0] + 1.6, t);
    if (k < 1) o = blend(VIEW_FN[VIEWS_T[i - 1][1]](t - VIEWS_T[i - 1][0]), cur, k);
  }
  if (orbit > 0) o = {...o, az: o.az + 9 * Math.max(0, t - lastFlip('orbit', t)) * orbit};
  return o;
};
export const viewAt = (t) => VIEWS_T.filter(([a]) => a <= t).pop();

// ------------------------------------------------------------ o ponteiro do operador
const REST = [[860, 470], [760, 420], [940, 520], [820, 380]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).flatMap((e) => {
    const out = [];
    if (e.seq) out.push({t: e.t, spot: ui.spots[e.seq]});
    if (e.view) out.push({t: e.t + (e.seq ? 0.35 : 0), spot: ui.spots[e.view]});
    if (e.display) out.push({t: e.t, spot: ui.spots[e.display]});
    return out;
  });
  const WP = [[0, 900, 600]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot], [e.t + 0.22, ...e.spot]);
    WP.push([e.t + 1.4, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(24, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ os rótulos: de perto as câmeras, de longe o reboque
const NEAR = [
  {name: 'CÂMERA PTZ', sub: 'SPEED DOME · ZOOM ÓPTICO 32× · PAN 360°', at: 'ptz'},
  {name: 'BULLETS (4×)', sub: '4 MP · 103° CADA · 360° NO TOTAL', at: 'bullet'},
  {name: 'LPR 1 · FAIXA 1', sub: 'f 12 mm · IR 850 nm · 1/1000 s', at: 'lpr0'},
  {name: 'LPR 2 · FAIXA 2', sub: 'f 18 mm · IR 850 nm · 1/1000 s', at: 'lpr1'},
  {name: 'CAIXA DE EQUIPAMENTOS', sub: 'NVR · ROTEADOR 4G · CONTROLADOR', at: 'box'},
  {name: 'ANTENAS 4G', sub: 'IMAGEM AO VIVO NA CENTRAL', at: 'antenna'},
];
const FAR = [
  {name: 'CABEÇA DE CÂMERAS', sub: 'PTZ · 4 BULLETS · 2 LPR', at: 'ptz'},
  {name: 'MASTRO TELESCÓPICO', sub: '3,70 → 5,45 m', at: 'mast'},
  {name: 'PAINÉIS SOLARES', sub: '3 × 600 Wp · DOBRÁVEIS', at: 'panel'},
  {name: 'BANCO DE BATERIAS', sub: '4 × 200 Ah · 9,6 kWh', at: 'battery'},
  {name: 'PEDESTRE', sub: 'RECONHECIMENTO FACIAL PELA PTZ', at: 'person', person: true},
];
export function makeLabels(st) {
  return (near, o) => {
    if (o < 0.02) return [];
    const pts = (near ? NEAR : FAR)
      .filter((p) => !p.person || st.rig.ped.g.visible)
      .map((p) => ({p, at: st.project(st.rig.anchors[p.at]())}))
      .filter((x) => x.at && x.at[0] > 330 && x.at[0] < 1290 && x.at[1] > 110 && x.at[1] < 740);
    const L = pts.filter((x) => x.at[0] < 800).sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.at[0] >= 800).sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let y = 130;
      for (const c of col) {
        y = Math.max(y, Math.min(700, c.at[1] - 10));
        out.push({name: c.p.name, sub: c.p.sub, at: c.at, label: [x, y], w, o});
        y += 36;
      }
    };
    stack(L, 340, 200);
    stack(R, near ? 1104 : 1078, 200);
    return out;
  };
}

/** Os dados do console para um quadro. s: {seq, tau, m, panRate, view, display, night, labels, cursor, plateBox, ...}. */
export function makeConsoleFrame(ui, st) {
  const labels = makeLabels(st);
  return (s) => {
    const S = SEQ[s.seq];
    const m = s.m;
    const lprK = lprShown(m);
    ui.update({
      m,
      status: statusOf(m),
      seq: s.seq,
      prog: s.tau / S.dur,
      tau: s.tau,
      dur: S.dur,
      from: S.from,
      to: S.to,
      phase: phaseOf(s.seq, s.tau),
      view: s.view,
      display: s.display,
      night: s.night,
      panRate: s.panRate,
      lprK,
      plateBox: s.plateBox,
      faceBox: s.faceBox,
      paused: s.paused ?? false,
      speed: s.speed ?? 1,
      speedK: s.speedK ?? 0.47,
      callouts: labels(s.near, s.labels),
      cursor: s.cursor,
    });
    return lprK;
  };
}
// a LPR mostrada na imagem ao vivo: a que tem um carro no campo, senão a da última leitura
export const lprShown = (m) => (m.lpr[1] && m.lpr[1].inView ? 1 : m.lpr[0] ? 0 : m.reads.length ? m.reads[m.reads.length - 1].lpr : 0);
export const isNear = (view) => view === 'cabeca' || view === 'ptz';

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = await createXptoStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    return {
      resize,
      render(t) {
        const {seq, tau} = seqAt(t);
        const {m, panRate} = mechAt(seq, tau);
        const disp = displayAt(t);
        const cam = camAt(t, disp.orbit);
        const night = easedDisplay('night', t, 0.9);
        const out = st.frame(m, {...cam, az: cam.az * D2R, el: cam.el * D2R}, {explode: easedDisplay('exploded', t, 0.8), cover: easedDisplay('cover', t), night, feeds: {ptz: FEED.ptz, lpr: FEED.lpr, lprK: lprShown(m)}});
        const [vt0, view] = viewAt(t);
        frame({seq, tau, m, panRate, view, display: disp, night, near: isNear(view), labels: easedDisplay('labels', t, 0.5) * ss(vt0 + 1.0, vt0 + 1.6, t), cursor: cursorAt(t), plateBox: out.plateBox, faceBox: out.faceBox});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
void THREE;
