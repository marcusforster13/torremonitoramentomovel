// A matemática da torre XPTO: dimensões reais, uma entrada (a sequência e o tempo dentro dela) e todas as poses e
// leituras como função dela. Nada de three.js aqui. Mundo em metros: o mastro na origem, y para cima, a rua ao longo
// de x (faixa 1 indo para +x, faixa 2 voltando para -x), o reboque paralelo à rua na calçada (z < 4).

const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ especificações (modelo representativo)
export const SPEC = {
  mastLow: 3.25, // altura da cabeça de câmeras recolhida (m)
  mastHigh: 5.45, // estendida
  lane: [5.75, 9.25], // centro das faixas (z)
  curb: 4.0,
  plateW: 0.4, // placa Mercosul 400 x 130 mm
  plateH: 0.13,
  carLen: 4.4,
  lpr: {px: 1920, sensorW: 5.6, f: [12, 18], shutter: 1 / 1000, minPx: 130, dy: -0.72, look: [11, 14]},
  ptz: {zoom: 32, hfovWide: 59, panMax: 240, tiltMin: -15, tiltMax: 90, dy: -0.38, arm: 0.42},
  bullet: {hfov: 103, range: 30, n: 4, dy: 0.12},
  solar: {n: 3, wp: 600},
  battery: {n: 4, ah: 200, v: 12},
  load: {ptz: 24, ptzMotor: 12, bullet: 6, lpr: 9, lprIr: 7, core: 22},
};
export const LPR_HFOV = SPEC.lpr.f.map((f) => (2 * Math.atan(SPEC.lpr.sensorW / (2 * f))) / D2R); // 26,3° e 17,7°
export const BATT_WH = SPEC.battery.n * SPEC.battery.ah * SPEC.battery.v; // 9600 Wh

// ------------------------------------------------------------ os carros: placa, faixa, velocidade, quando passam
// cada carro: entra em x0 no instante t0 da sequência MONITORAR e anda a v m/s ao longo de dir
export const CARS = [
  {plate: 'XPT4A23', color: '#c9ced6', lane: 0, dir: 1, v: 40 / 3.6, t0: 0.4, x0: -42},
  {plate: 'BRA2E19', color: '#2b3f6b', lane: 1, dir: -1, v: 50 / 3.6, t0: 7.6, x0: 44},
];

// ------------------------------------------------------------ sequências
export const SEQ = {
  deploy: {dur: 12, from: 'TRANSPORTE', to: 'EM OPERAÇÃO'},
  patrol: {dur: 16, from: 'VIGILÂNCIA', to: 'FIM DO CICLO'},
  stow: {dur: 10, from: 'EM OPERAÇÃO', to: 'TRANSPORTE'},
};
// a implantação: painéis abrem, mastro sobe, câmeras ligam; recolher é o inverso, mais rápido
const deployState = (tau) => ({fold: ss(0.6, 4.2, tau), mast: ss(4.4, 10.2, tau), power: ss(10.3, 11.3, tau)});
const stowState = (tau) => ({power: 1 - ss(0.2, 0.9, tau), mast: 1 - ss(1.0, 6.0, tau), fold: 1 - ss(6.2, 9.4, tau)});

/** Posição de um carro no instante tau da patrulha; null antes de entrar e depois de sair. */
export function carAt(c, tau) {
  const s = tau - c.t0;
  if (s < 0) return null;
  const x = c.x0 + c.dir * c.v * s;
  if (Math.abs(x) > 46) return null;
  return {x, z: SPEC.lane[c.lane], dir: c.dir, s};
}

const H = (mast) => SPEC.mastLow + (SPEC.mastHigh - SPEC.mastLow) * mast;

/** Geometria da LPR para um carro: distância à placa, pixels na placa, ângulo vertical, borrão de movimento. */
export function lprGeom(car, cam, k = 0) {
  // a placa que a câmera vê: a dianteira do carro que se aproxima
  const px = car.x + car.dir * (SPEC.carLen / 2);
  const dx = px - cam.x;
  const dz = car.z - cam.z;
  const dy = 0.45 - cam.y;
  const d = Math.hypot(dx, dy, dz);
  const across = 2 * d * Math.tan((LPR_HFOV[k] / 2) * D2R);
  const pixels = (SPEC.plateW / across) * SPEC.lpr.px;
  const vert = Math.atan2(-dy, Math.hypot(dx, dz)) / D2R;
  // borrão de movimento em cm durante o obturador
  const blur = CARS[car.i ?? 0].v * SPEC.lpr.shutter * 100;
  return {d, pixels, vert, blur, plateX: px};
}

export const lprCam = (k, h) => ({x: k === 0 ? -0.18 : 0.18, y: h + SPEC.lpr.dy, z: 0.05});
/** O que a LPR k vê do carro c (com c.i): null se o carro não vem na direção dela ou já passou. */
export function lprLook(k, c, h) {
  const cam = lprCam(k, h);
  const ahead = k === 0 ? c.x < 0 : c.x > 0;
  const coming = k === 0 ? c.dir === 1 : c.dir === -1;
  if (!ahead || !coming) return null;
  const g = lprGeom(c, cam, k);
  // dentro do campo: o ângulo horizontal entre o eixo da câmera (mirando a faixa a SPEC.lpr.look m) e a placa
  const axis = Math.atan2(SPEC.lane[k] - cam.z, SPEC.lpr.look[k]);
  const ang = Math.abs(Math.atan2(c.z - cam.z, Math.abs(g.plateX - cam.x)) - axis) / D2R;
  const inView = ang < LPR_HFOV[k] / 2 && g.d < 40;
  return {...g, car: c.i, inView, readable: inView && g.pixels >= SPEC.lpr.minPx};
}

/** O estado completo de uma sequência no instante tau: tudo que move e tudo que os painéis mostram. */
export function stateAt(seq, tau) {
  const base = seq === 'deploy' ? deployState(tau) : seq === 'stow' ? stowState(tau) : {fold: 1, mast: 1, power: 1};
  const h = H(base.mast);
  const out = {seq, tau, ...base, h, cars: [], ptz: {pan: 35, tilt: 18, zoom: 1, track: -1}, lpr: [null, null], reads: []};
  // a patrulha: carros, rastreio da PTZ, leituras das LPRs
  if (seq === 'patrol') {
    const ptzPos = {x: 0, y: h + SPEC.ptz.dy, z: SPEC.ptz.arm};
    CARS.forEach((c, i) => {
      const p = carAt(c, tau);
      out.cars.push(p ? {...p, i} : null);
    });
    // a PTZ segue o carro mais recente em cena; entre carros, volta para a varredura
    let track = -1;
    for (let i = CARS.length - 1; i >= 0; i--) if (out.cars[i] && Math.abs(out.cars[i].x) < 34) {
      track = i;
      break;
    }
    const scan = {pan: 35 + 40 * Math.sin(tau * 0.5), tilt: 14, zoom: 1};
    const aim = (car) => {
      const dx = car.x - ptzPos.x;
      const dz = car.z - ptzPos.z;
      const g = Math.hypot(dx, dz);
      const pan = Math.atan2(dx, dz) / D2R;
      const tilt = Math.atan2(ptzPos.y - 0.7, g) / D2R;
      const d = Math.hypot(g, ptzPos.y - 0.7);
      // o zoom que deixa o carro com ~55% da largura do quadro
      const want = 2 * Math.atan(SPEC.carLen / 0.55 / 2 / d) / D2R;
      const zoom = clamp(Math.tan((SPEC.ptz.hfovWide / 2) * D2R) / Math.tan((want / 2) * D2R), 1, SPEC.ptz.zoom);
      return {pan, tilt, zoom, d};
    };
    if (track >= 0) {
      const a = aim(out.cars[track]);
      // entra no rastreio suavemente a partir da varredura
      const k = ss(0, 0.9, out.cars[track].s);
      const lerpA = (u, v) => u + ((((v - u + 540) % 360) - 180) * k);
      out.ptz = {pan: lerpA(scan.pan, a.pan), tilt: scan.tilt + (a.tilt - scan.tilt) * k, zoom: scan.zoom + (a.zoom - scan.zoom) * k, track, d: a.d};
    } else out.ptz = {...scan, track: -1};
    // LPR 0 olha para -x (lê a dianteira de quem vem pela faixa 1), LPR 1 para +x (faixa 2 vindo de +x)
    for (let k = 0; k < 2; k++) {
      let best = null;
      for (const c of out.cars) if (c) best = lprLook(k, c, h) ?? best;
      out.lpr[k] = best;
    }
    for (const [i, c] of CARS.entries()) {
      const r = readInfo(i, h);
      if (r && tau >= r.t) out.reads.push({car: i, lpr: c.lane, t: r.t, age: tau - r.t, plate: c.plate, pixels: r.pixels, conf: confOf(r.pixels, r.vert), kmh: c.v * 3.6, d: r.d});
    }
  }
  // energia: a carga vem do que está ligado; o sol, da área aberta dos painéis
  const L = SPEC.load;
  const moving = seq === 'patrol' && out.ptz.track >= 0 ? 1 : 0;
  out.watts = base.power * (L.core + L.ptz + L.ptzMotor * moving + SPEC.bullet.n * L.bullet + 2 * (L.lpr + L.lprIr * 0.25));
  out.solar = SPEC.solar.wp * (1 + 2 * base.fold) * 0.62;
  out.autonomy = out.watts > 1 ? (BATT_WH * 0.8) / out.watts : Infinity;
  return out;
}

export const confOf = (pixels, vert) => clamp(0.62 + 0.36 * clamp((pixels - 110) / 70, 0, 1) - Math.max(0, vert - 30) * 0.01, 0, 0.995);

// a leitura de cada carro: a LPR guarda o melhor quadro enquanto a placa está legível e no campo, e publica o
// resultado 0,35 s depois do primeiro quadro legível (o tempo do OCR). Tabelada uma vez por altura de cabeça.
const readCache = new Map();
function readInfo(i, h) {
  const key = i + ':' + h.toFixed(3);
  if (readCache.has(key)) return readCache.get(key);
  const c = CARS[i];
  let first = null;
  let best = null;
  for (let tau = c.t0; tau < SEQ.patrol.dur; tau += 1 / 120) {
    const p = carAt(c, tau);
    if (!p) continue;
    const g = lprLook(c.lane, {...p, i}, h);
    if (!g) break;
    if (g.readable) {
      if (first === null) first = tau;
      if (!best || g.pixels > best.pixels) best = g;
    }
  }
  const r = first === null ? null : {t: first + 0.35, ...best};
  readCache.set(key, r);
  return r;
}

/** Uma linha curta para o painel de estado. */
export function statusOf(s) {
  if (s.seq === 'deploy') {
    if (s.power > 0.5) return ['Em operação', 'CÂMERAS ONLINE · 4G CONECTADO', 'ok'];
    if (s.mast > 0.02) return ['Elevando mastro', `CABEÇA A ${s.h.toFixed(2).replace('.', ',')} m`, 'move'];
    if (s.fold > 0.02 && s.fold < 0.99) return ['Abrindo painéis solares', 'ARTICULAÇÕES LATERAIS', 'move'];
    return ['Modo transporte', 'MASTRO RECOLHIDO · PAINÉIS FECHADOS', 'off'];
  }
  if (s.seq === 'stow') {
    if (s.fold < 0.01) return ['Modo transporte', 'PRONTO PARA REBOQUE', 'off'];
    if (s.mast < 0.99 && s.mast > 0.01) return ['Recolhendo mastro', `CABEÇA A ${s.h.toFixed(2).replace('.', ',')} m`, 'move'];
    if (s.mast <= 0.01) return ['Fechando painéis', 'ARTICULAÇÕES LATERAIS', 'move'];
    return ['Desligando câmeras', 'GRAVAÇÃO ENCERRADA', 'move'];
  }
  const live = s.lpr.find((l) => l && l.readable);
  if (live) return ['Leitura de placa', `LPR ${s.lpr.indexOf(live) + 1} · ${Math.round(live.pixels)} px NA PLACA`, 'ok'];
  if (s.ptz.track >= 0) return ['Rastreando veículo', `PTZ ${s.ptz.zoom.toFixed(1).replace('.', ',')}× · ${Math.round(s.ptz.d ?? 0)} m`, 'ok'];
  return ['Vigilância', 'PTZ EM VARREDURA · 4 BULLETS 360°', 'ok'];
}

/** A fase escrita na barra de operação. */
export function phaseOf(seq, tau) {
  if (seq === 'deploy') return tau < 0.6 ? 'NIVELAR SAPATAS' : tau < 4.2 ? 'ABRIR PAINÉIS SOLARES' : tau < 10.2 ? 'ELEVAR MASTRO TELESCÓPICO' : 'LIGAR CÂMERAS';
  if (seq === 'stow') return tau < 1 ? 'DESLIGAR CÂMERAS' : tau < 6 ? 'RECOLHER MASTRO' : 'FECHAR PAINÉIS';
  return tau < 7.6 ? 'VEÍCULO 1 · FAIXA 1 →' : 'VEÍCULO 2 · FAIXA 2 ←';
}
