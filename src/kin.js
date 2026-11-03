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
  mastLow: 4.25, // altura da cabeça de câmeras recolhida (m)
  mastHigh: 5.65, // estendida (o conjunto cinza assenta no topo do tubo azul)
  lane: [5.75, 9.25], // centro das faixas (z)
  curb: 4.0,
  plateW: 0.4, // placa Mercosul 400 x 130 mm
  plateH: 0.13,
  carLen: 4.4,
  lpr: {px: 1920, sensorW: 5.6, f: [12, 18], shutter: 1 / 1000, minPx: 130, dy: 0.42, look: [11, 14]},
  ptz: {zoom: 32, hfovWide: 59, panMax: 240, tiltMin: -15, tiltMax: 90, dy: -0.02, x: 0.84, n: 2},
  bullet: {hfov: 103, range: 30, n: 1},
  solar: {n: 3, wp: 600},
  battery: {n: 4, ah: 200, v: 12},
  load: {ptz: 24, ptzMotor: 12, bullet: 6, lpr: 9, lprIr: 7, ir: 10, core: 22},
};
export const LPR_HFOV = SPEC.lpr.f.map((f) => (2 * Math.atan(SPEC.lpr.sensorW / (2 * f))) / D2R); // 26,3° e 17,7°
export const BATT_WH = SPEC.battery.n * SPEC.battery.ah * SPEC.battery.v; // 9600 Wh

// ------------------------------------------------------------ os carros: placa, faixa, velocidade, quando passam
// cada carro: entra em x0 no instante t0 da sequência MONITORAR e anda a v m/s ao longo de dir
export const CARS = [
  {plate: 'XPT4A23', model: 'seda', len: 4.36, color: '#c9ced6', lane: 0, dir: 1, v: 40 / 3.6, t0: 1.0, x0: -80},
  {plate: 'BRA2E19', model: 'suv', len: 4.62, color: '#2b3f6b', lane: 1, dir: -1, v: 50 / 3.6, t0: 28.3, x0: 44},
];

// ------------------------------------------------------------ o pedestre: anda pela calçada na direção da torre
// A PTZ trava nele entre lock e release, dá zoom no rosto e, com pixels suficientes no rosto, consulta o banco de
// mandados (BNMP). Os dados do alerta são fictícios.
export const PERSON = {t0: 18.5, x0: 13, z: 3.15, v: 1.3, head: 1.62, lock: 20.3, release: 27.9, faceW: 0.16, frame: 1.1, minFacePx: 90, maxD: 11.5, lookup: 0.8};
export const WARRANT = {sim: 0.94, ref: 'Nº 0001234-56.2026 (FICTÍCIO)', base: 'BNMP · CNJ'};
export function personAt(tau) {
  const s = tau - PERSON.t0;
  if (s < 0) return null;
  const x = PERSON.x0 - PERSON.v * s;
  if (x < -14) return null;
  return {x, z: PERSON.z, s};
}

// ------------------------------------------------------------ sequências
export const SEQ = {
  deploy: {dur: 13, from: 'TRANSPORTE', to: 'EM OPERAÇÃO'},
  patrol: {dur: 46, from: 'VIGILÂNCIA', to: 'FIM DO CICLO'},
  stow: {dur: 11, from: 'EM OPERAÇÃO', to: 'TRANSPORTE'},
};
// a implantação: o mastro sobe primeiro (a cabeça sai do caminho), depois os painéis abrem um de cada vez, o de cima
// da pilha primeiro; por fim as câmeras ligam. Recolher é o inverso. folds[0] é o painel que deita direto sobre o do
// meio, folds[1] o que fica por cima dele.
const DEPLOY_T = {mast: [0.6, 6.4], top: [6.6, 9.0], low: [9.2, 11.6], power: [11.8, 12.6]};
const STOW_T = {power: [0.2, 0.9], low: [1.0, 3.4], top: [3.6, 6.0], mast: [6.2, 10.6]};
const withFold = (o) => ({...o, fold: (o.folds[0] + o.folds[1]) / 2});
const deployState = (tau) => withFold({mast: ss(...DEPLOY_T.mast, tau), folds: [ss(...DEPLOY_T.low, tau), ss(...DEPLOY_T.top, tau)], power: ss(...DEPLOY_T.power, tau)});
const stowState = (tau) => withFold({power: 1 - ss(...STOW_T.power, tau), folds: [1 - ss(...STOW_T.low, tau), 1 - ss(...STOW_T.top, tau)], mast: 1 - ss(...STOW_T.mast, tau)});

/** Posição de um carro no instante tau da patrulha; null antes de entrar e depois de sair. */
export function carAt(c, tau) {
  const s = tau - c.t0;
  if (s < 0) return null;
  const x = c.x0 + c.dir * c.v * s;
  if (Math.abs(x) > 90) return null;
  return {x, z: SPEC.lane[c.lane], dir: c.dir, s};
}

const H = (mast) => SPEC.mastLow + (SPEC.mastHigh - SPEC.mastLow) * mast;
/** A altura da cabeça de câmeras numa sequência, sem calcular o resto do estado (para a câmera do filme). */
export const headAt = (seq, tau) => H((seq === 'deploy' ? deployState(tau) : seq === 'stow' ? stowState(tau) : {mast: 1}).mast);

/** Geometria da LPR para um carro: distância à placa, pixels na placa, ângulo vertical, borrão de movimento. */
export function lprGeom(car, cam, k = 0) {
  // a placa que a câmera vê: a dianteira do carro que se aproxima
  const px = car.x + car.dir * ((CARS[car.i ?? 0].len ?? SPEC.carLen) / 2 + 0.012);
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

export const lprCam = (k, h) => ({x: k === 0 ? -0.55 : 0.55, y: h + SPEC.lpr.dy, z: 0.02});
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

// ------------------------------------------------------------ PTZ: alvos e mira
const ptzPosAt = (h) => ({x: SPEC.ptz.x, y: h + SPEC.ptz.dy, z: 0});
/** A mira (pan, tilt, zoom, distância) para um alvo: 'scan', 'c0', 'c1' (carros) ou 'p' (o rosto do pedestre). */
function aimOf(id, tau, P) {
  if (id === 'scan') return {pan: 35 + 40 * Math.sin(tau * 0.5), tilt: 14, zoom: 1, d: 20};
  let x;
  let z;
  let y;
  let frame;
  if (id === 'p') {
    const p = personAt(tau) ?? personAt(PERSON.t0);
    [x, z, y, frame] = [p.x, p.z, PERSON.head, PERSON.frame];
  } else {
    const c = CARS[+id[1]];
    const p = carAt(c, tau) ?? {x: c.x0, z: SPEC.lane[c.lane]};
    // o zoom que deixa o carro com ~55% da largura do quadro
    [x, z, y, frame] = [p.x, p.z, 0.7, c.len / 0.55];
  }
  const dx = x - P.x;
  const dz = z - P.z;
  const g = Math.hypot(dx, dz);
  const d = Math.hypot(g, P.y - y);
  const want = 2 * Math.atan(frame / 2 / d);
  const zoom = clamp(Math.tan((SPEC.ptz.hfovWide / 2) * D2R) / Math.tan(want / 2), 1, SPEC.ptz.zoom);
  return {pan: Math.atan2(dx, dz) / D2R, tilt: Math.atan2(P.y - y, g) / D2R, zoom, d};
}
// quem a PTZ segue: o pedestre na janela dele, senão o carro mais recente em cena, senão a varredura
const targetRaw = (tau) => {
  if (personAt(tau) && tau >= PERSON.lock && tau < PERSON.release) return 'p';
  for (let i = CARS.length - 1; i >= 0; i--) {
    const c = carAt(CARS[i], tau);
    if (c && Math.abs(c.x) < 70) return 'c' + i;
  }
  return 'scan';
};
const TT = [];
{
  let since = 0;
  let prev = 'scan';
  let cur = targetRaw(0);
  for (let i = 0; i <= 60 * 30; i++) {
    const t = i / 60;
    const id = targetRaw(t);
    if (id !== cur) {
      prev = cur;
      cur = id;
      since = t;
    }
    TT.push({id, since, prev});
  }
}
const ptzTarget = (tau) => TT[Math.max(0, Math.min(TT.length - 1, Math.floor(tau * 60)))];
// o instante do alerta: a PTZ assentada no rosto, a pessoa a até maxD m e o rosto com pixels suficientes, mais o
// tempo da consulta. Tabelado por altura de cabeça.
const matchCache = new Map();
function matchInfo(h) {
  const key = h.toFixed(3);
  if (matchCache.has(key)) return matchCache.get(key);
  let r = null;
  const P = ptzPosAt(h);
  for (let tau = PERSON.lock; tau < PERSON.release; tau += 1 / 60) {
    const {id, since} = ptzTarget(tau);
    if (id !== 'p' || tau < since + 0.9) continue;
    const a = aimOf('p', tau, P);
    const hf = 2 * Math.atan(Math.tan((SPEC.ptz.hfovWide / 2) * D2R) / a.zoom);
    const px = (PERSON.faceW / (2 * a.d * Math.tan(hf / 2))) * SPEC.lpr.px;
    if (a.d <= PERSON.maxD && px >= PERSON.minFacePx) {
      r = tau + PERSON.lookup;
      break;
    }
  }
  matchCache.set(key, r);
  return r;
}

/** O estado completo de uma sequência no instante tau: tudo que move e tudo que os painéis mostram. */
export function stateAt(seq, tau) {
  const base = seq === 'deploy' ? deployState(tau) : seq === 'stow' ? stowState(tau) : {fold: 1, folds: [1, 1], mast: 1, power: 1};
  const h = H(base.mast);
  const out = {seq, tau, ...base, h, cars: [], ptz: {pan: 35, tilt: 18, zoom: 1, track: -1}, lpr: [null, null], reads: []};
  // a patrulha: carros, rastreio da PTZ, leituras das LPRs
  if (seq === 'patrol') {
    const ptzPos = ptzPosAt(h);
    CARS.forEach((c, i) => {
      const p = carAt(c, tau);
      out.cars.push(p ? {...p, i} : null);
    });
    out.person = personAt(tau);
    // a PTZ: o alvo do momento (tabelado), e a transição suave a partir do alvo anterior
    const {id, since, prev} = ptzTarget(tau);
    const cur = aimOf(id, tau, ptzPos);
    const k = ss(since, since + 0.9, tau);
    const was = k < 1 ? aimOf(prev, tau, ptzPos) : cur;
    const lerpA = (u, v) => u + ((((v - u + 540) % 360) - 180) * k);
    out.ptz = {pan: lerpA(was.pan, cur.pan), tilt: was.tilt + (cur.tilt - was.tilt) * k, zoom: Math.exp(Math.log(was.zoom) + (Math.log(cur.zoom) - Math.log(was.zoom)) * k), track: id[0] === 'c' ? +id[1] : -1, person: id === 'p', d: cur.d, settled: k >= 1};
    // o rosto: pixels na imagem da PTZ, e a consulta ao banco de mandados
    if (id === 'p' && out.person) {
      const hf = 2 * Math.atan(Math.tan((SPEC.ptz.hfovWide / 2) * D2R) / out.ptz.zoom);
      out.face = {px: (PERSON.faceW / (2 * cur.d * Math.tan(hf / 2))) * SPEC.lpr.px, d: cur.d};
    }
    const m = matchInfo(h);
    if (m !== null && tau >= m) out.alert = {t: m, age: tau - m, sim: WARRANT.sim};
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
  const moving = seq === 'patrol' && (out.ptz.track >= 0 || out.ptz.person) ? 1 : 0;
  out.watts = base.power * (L.core + SPEC.ptz.n * L.ptz + L.ptzMotor * moving + SPEC.bullet.n * L.bullet + 2 * (L.lpr + L.lprIr * 0.25) + 2 * L.ir * 0.25);
  out.solar = SPEC.solar.wp * (1 + base.folds[0] + base.folds[1]) * 0.62;
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
  const h = `CABEÇA A ${s.h.toFixed(2).replace('.', ',')} m`;
  const moving = (f) => f > 0.001 && f < 0.999;
  if (s.seq === 'deploy') {
    if (s.power > 0.5) return ['Em operação', 'CÂMERAS ONLINE · 4G OK', 'ok'];
    if (moving(s.folds[1])) return ['Abrindo painel 1 de 2', 'O DE CIMA DA PILHA', 'move'];
    if (moving(s.folds[0])) return ['Abrindo painel 2 de 2', 'O DE BAIXO DA PILHA', 'move'];
    if (moving(s.mast)) return ['Elevando mastro', h, 'move'];
    if (s.mast >= 0.99 && s.folds[0] >= 0.99 && s.folds[1] >= 0.99) return ['Ligando câmeras', 'PTZ · BULLETS · LPR', 'move'];
    if (s.mast >= 0.99) return [s.folds[1] < 0.99 ? 'Abrindo painel 1 de 2' : 'Abrindo painel 2 de 2', 'UM DE CADA VEZ', 'move'];
    return ['Modo transporte', 'PAINÉIS EMPILHADOS', 'off'];
  }
  if (s.seq === 'stow') {
    if (s.mast <= 0.01) return ['Modo transporte', 'PRONTO PARA REBOQUE', 'off'];
    if (moving(s.mast)) return ['Recolhendo mastro', h, 'move'];
    if (moving(s.folds[0])) return ['Fechando painel 1 de 2', 'SOBRE O PAINEL DO MEIO', 'move'];
    if (moving(s.folds[1])) return ['Fechando painel 2 de 2', 'POR CIMA DO PRIMEIRO', 'move'];
    return ['Desligando câmeras', 'GRAVAÇÃO ENCERRADA', 'move'];
  }
  if (s.alert && s.alert.age < 6) return ['Alerta: mandado em aberto', `ROSTO ${Math.round(s.alert.sim * 100)}% · CENTRAL AVISADA`, 'alert'];
  if (s.ptz.person) return ['Reconhecimento facial', `PTZ ${s.ptz.zoom.toFixed(1).replace('.', ',')}× · ${Math.round(s.face?.px ?? 0)} px NO ROSTO`, 'ok'];
  const live = s.lpr.find((l) => l && l.readable);
  if (live) return ['Leitura de placa', `LPR ${s.lpr.indexOf(live) + 1} · ${Math.round(live.pixels)} px NA PLACA`, 'ok'];
  if (s.ptz.track >= 0) return ['Rastreando veículo', `PTZ ${s.ptz.zoom.toFixed(1).replace('.', ',')}× · ${Math.round(s.ptz.d ?? 0)} m`, 'ok'];
  return ['Vigilância', '2 PTZ EM VARREDURA', 'ok'];
}

/** A fase escrita na barra de operação. */
export function phaseOf(seq, tau) {
  const at = (T, order, names) => names[Math.max(0, order.findLastIndex((k) => tau >= T[k][0] - 0.2))];
  if (seq === 'deploy') return at(DEPLOY_T, ['mast', 'top', 'low', 'power'], ['ELEVAR MASTRO TELESCÓPICO', 'ABRIR PAINEL 1 (O DE CIMA)', 'ABRIR PAINEL 2', 'LIGAR CÂMERAS']);
  if (seq === 'stow') return at(STOW_T, ['power', 'low', 'top', 'mast'], ['DESLIGAR CÂMERAS', 'FECHAR PAINEL 1 SOBRE O DO MEIO', 'FECHAR PAINEL 2 POR CIMA', 'RECOLHER MASTRO']);
  return tau < PERSON.lock ? 'VEÍCULO 1 · FAIXA 1 →' : tau < PERSON.release ? 'PEDESTRE · RECONHECIMENTO FACIAL' : 'VEÍCULO 2 · FAIXA 2 ←';
}
