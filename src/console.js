// O console da torre XPTO em 1600 x 900: o logo e o título, o estado com as barras do mastro e dos painéis, a imagem
// ao vivo da PTZ com o mostrador de pan, a energia, a imagem da LPR com a placa lida, as sequências, as vistas, a
// exibição, a linha de operação e os rótulos com linhas até as peças. update(s) redesenha tudo a partir do quadro.
import {BRAND, logoImg, mercosulPlate} from './brand.js';
import {BATT_WH, CARS, LPR_HFOV, SPEC, WARRANT} from './kin.js';

export const C = {ink: BRAND.navy, mute: '#7d8696', faint: '#cdd4de', line: '#dfe5ec', panel: 'rgba(250,252,254,.95)', ac: BRAND.cyan, acInk: BRAND.cyanInk, ok: '#1fa971', warn: '#e8792b', rec: '#e5484d'};
export const SEQS = ['deploy', 'patrol', 'stow'];
export const SEQ_LABEL = {deploy: 'IMPLANTAR', patrol: 'MONITORAR', stow: 'RECOLHER'};
export const VIEWS = ['hero', 'lateral', 'rua', 'calcada', 'cabeca', 'ptz', 'lpr', 'lpr2', 'planta'];
export const VIEW_LABEL = {hero: 'GERAL', lateral: 'LATERAL', rua: 'RUA', calcada: 'CALÇADA', cabeca: 'CABEÇA', ptz: 'PTZ', lpr: 'LPR 1', lpr2: 'LPR 2', planta: 'PLANTA'};
export const DISPLAY = ['labels', 'cover', 'exploded', 'night', 'orbit'];
export const DISPLAY_LABEL = {labels: 'RÓTULOS', cover: 'COBERTURA', exploded: 'EXPLODIDA', night: 'NOITE IR', orbit: 'ÓRBITA'};
// os retângulos das imagens ao vivo (o palco desenha nelas, o console desenha a moldura e o texto por cima)
export const FEED = {ptz: {x: 42, y: 382, w: 254, h: 143}, lpr: {x: 1327, y: 160, w: 230, h: 129}};

const fmtN = (v, d = 0) => v.toFixed(d).replace('.', ',');
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
/* vidro no estilo do GlassView do expo-glass-effect (Liquid Glass): translúcido, desfoque e saturação do fundo,
   brilho especular na borda de cima, sombra macia; botões em pílula, o ativo com tinta azul-marinho */
.cp{position:absolute;background:linear-gradient(160deg,rgba(255,255,255,.62),rgba(255,255,255,.34));-webkit-backdrop-filter:blur(18px) saturate(180%);backdrop-filter:blur(18px) saturate(180%);border:1px solid rgba(255,255,255,.75);border-radius:18px;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.3),inset 0 0 0 .5px rgba(10,10,74,.06),0 10px 30px rgba(20,40,90,.12),0 1px 3px rgba(20,40,90,.08)}
.lite .cp{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(248,250,253,.9)}
.glass{background:linear-gradient(180deg,rgba(255,255,255,.7),rgba(255,255,255,.38));border:1px solid rgba(255,255,255,.85);box-shadow:inset 0 1px 0 rgba(255,255,255,1),inset 0 -1px 1px rgba(10,10,74,.06),0 2px 6px rgba(20,40,90,.1)}
.well{background:rgba(10,10,74,.06);box-shadow:inset 0 1px 2px rgba(10,10,74,.1),inset 0 -1px 0 rgba(255,255,255,.6)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.ac}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.5px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.ui .bt.on{background:linear-gradient(180deg,rgba(40,44,120,.92),rgba(10,10,74,.86));color:#fff;border-color:rgba(255,255,255,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),inset 0 -1px 2px rgba(0,0,0,.25),0 4px 12px rgba(10,10,74,.28)}
.ui .bt.flat{background:transparent;border-color:transparent;box-shadow:none}
.bt{position:absolute;height:21px;padding:0 8px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.85);border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.36));box-shadow:inset 0 1px 0 #fff,inset 0 -1px 1px rgba(10,10,74,.07),0 2px 6px rgba(20,40,90,.1);transition:transform .12s;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap;box-sizing:border-box}
.fd{position:absolute;border:1px solid rgba(255,255,255,.9);border-radius:4px;box-sizing:border-box;box-shadow:0 0 0 1px rgba(10,10,74,.25)}
.fdt{position:absolute;font:700 8.6px 'JetBrains Mono',monospace;letter-spacing:1.1px;color:#fff;background:rgba(10,10,74,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.25);padding:2px 6px;border-radius:999px;white-space:nowrap}
.alert{position:absolute;left:505px;top:112px;width:330px;transform:translateX(-50%);padding:12px 16px 12px;border-radius:18px;background:linear-gradient(160deg,rgba(255,236,236,.82),rgba(255,214,214,.55));-webkit-backdrop-filter:blur(18px) saturate(180%);backdrop-filter:blur(18px) saturate(180%);border:1px solid rgba(255,255,255,.8);box-shadow:inset 0 1px 0 #fff,0 0 0 1.5px rgba(229,72,77,.55),0 12px 32px rgba(229,72,77,.25);opacity:0;pointer-events:none}
.alert b{display:block;font:800 13px Inter,sans-serif;letter-spacing:.4px;color:#b4232a}
.alert span{display:block;font:600 8.6px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:#c4555a;margin:3px 0 8px}
.alert .ar{display:flex;justify-content:space-between;gap:10px;font:500 9px 'JetBrains Mono',monospace;letter-spacing:.8px;padding:3px 0;border-top:1px solid rgba(180,35,42,.12)}
.alert .ar i{font-style:normal;color:#9a6a6c}
.alert .ar em{font-style:normal;font-weight:700;color:${C.ink}}
.night{position:absolute;background:#808080;mix-blend-mode:saturation;opacity:0}
.call{position:absolute;white-space:nowrap}
.call b{display:flex;align-items:center;gap:6px;font:700 9.6px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.ac}}
.call span{display:block;font:500 8px 'JetBrains Mono',monospace;letter-spacing:1.1px;color:${C.mute};margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.acInk};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  // hole: um retângulo da imagem ao vivo que o fundo do painel deixa vazado (o canvas aparece por baixo)
  const panel = (x, y, w, h, title, n, hole) => {
    const clip = hole ? `;clip-path:path(evenodd,'M-20 -20H${w + 20}V${h + 20}H-20Z M${hole.x - x} ${hole.y - y}h${hole.w}v${hole.h}h${-hole.w}Z');overflow:visible` : '';
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px${clip}"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 15}px">${n}</div>`);
  };
  const bar = (x, y, w, label) => {
    add(`<div class="sm" style="position:absolute;left:${x}px;top:${y}px">${label}</div>`);
    add(`<div style="position:absolute;left:${x + 68}px;top:${y + 4}px;width:${w}px;height:4px;background:rgba(10,10,74,.09);border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:${x + 68}px;top:${y + 4}px;height:4px;background:${C.ac};border-radius:2px"></div>`);
    const v = add(`<div class="mo" style="position:absolute;left:${x + 74 + w}px;top:${y - 2}px;font-size:11px;font-weight:600"></div>`);
    return {set: (k, txt, col = C.ac) => {
      f.style.width = `${(Math.max(0, Math.min(1, k)) * w).toFixed(1)}px`;
      f.style.background = col;
      v.textContent = txt;
    }};
  };

  // ------------------------------------------------------------ cabeçalho: o logo, o título
  add(`<div style="position:absolute;left:28px;top:26px">${logoImg(158)}</div>`);
  add(`<div style="position:absolute;left:204px;top:22px;width:1px;height:58px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="position:absolute;left:224px;top:22px;letter-spacing:2.4px">SEGURANÇA ELETRÔNICA · MONITORAMENTO</div>`);
  add(`<div style="position:absolute;left:223px;top:37px;font-size:33px;font-weight:700;letter-spacing:-.6px;line-height:1">Torre de Monitoramento Móvel <span style="color:${C.ac};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:224px;top:77px;font-size:11.2px;letter-spacing:2.2px;color:#55607a">PTZ · BULLET · LPR · ENERGIA SOLAR · 4G</div>`);
  add(`<div class="sm" style="position:absolute;left:1124px;top:49px;letter-spacing:2.6px;font-size:9.6px">REBOQUE AUTÔNOMO</div>`);
  add(`<div class="mo" style="position:absolute;left:1260px;top:47px;color:${C.ac};font-size:12px;letter-spacing:-1px">//////</div>`);
  add(`<div style="position:absolute;left:1322px;top:34px;color:${C.acInk};font-size:39px;font-weight:700;letter-spacing:-.8px;line-height:1">24/7</div>`);
  add(`<div style="position:absolute;left:1430px;top:33px;width:1px;height:44px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1446px;top:34px;line-height:14px;letter-spacing:2.2px">O FUTURO<br>DA<br>SEGURANÇA</div>`);

  // ------------------------------------------------------------ 01 estado
  panel(28, 112, 282, 204, 'ESTADO', '01');
  const chip = add(`<div style="position:absolute;left:42px;top:150px;width:13px;height:24px;border-radius:2px"></div>`);
  const stTitle = add(`<div style="position:absolute;left:66px;top:148px;width:230px;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>`);
  const stSub = add(`<div class="sm" style="position:absolute;left:67px;top:167px;width:229px;overflow:hidden;text-overflow:ellipsis;letter-spacing:1px"></div>`);
  add(`<div style="position:absolute;left:42px;top:188px;width:254px;height:1px;background:${C.line}"></div>`);
  const bMast = bar(42, 202, 120, 'MASTRO');
  const bPanel = bar(42, 226, 120, 'PAINÉIS');
  const bCams = bar(42, 250, 120, 'CÂMERAS');
  const bLink = bar(42, 274, 120, 'LINK 4G');
  add(`<div class="sm" style="position:absolute;left:42px;top:296px;font-size:8.2px">CABEÇA ${fmtN(SPEC.mastLow, 2)} → ${fmtN(SPEC.mastHigh, 2)} m DO CHÃO</div>`);

  // ------------------------------------------------------------ 02 PTZ ao vivo
  const F = FEED.ptz;
  panel(28, 330, 282, 312, 'CÂMERA PTZ · AO VIVO', '02', F);
  add(`<div class="fd" style="left:${F.x - 1}px;top:${F.y - 1}px;width:${F.w + 2}px;height:${F.h + 2}px"></div>`);
  const ptzNight = add(`<div class="night" style="left:${F.x}px;top:${F.y}px;width:${F.w}px;height:${F.h}px"></div>`);
  const ptzOff = add(`<div class="mo" style="position:absolute;left:${F.x}px;top:${F.y}px;width:${F.w}px;height:${F.h}px;background:#0e1430;color:#7d8bb3;font-size:10px;letter-spacing:2px;display:flex;align-items:center;justify-content:center">SEM SINAL</div>`);
  const ptzTag = add(`<div class="fdt" style="left:${F.x + 6}px;top:${F.y + 6}px"></div>`);
  const ptzRec = add(`<div class="fdt" style="right:${1600 - F.x - F.w + 6}px;top:${F.y + 6}px"></div>`);
  add(`<svg style="position:absolute;left:${F.x + F.w / 2 - 14}px;top:${F.y + F.h / 2 - 14}px" width="28" height="28"><path d="M0 14h9M19 14h9M14 0v9M14 19v9" stroke="#fff" stroke-width="1.3" opacity=".8"/></svg>`);
  const dial = add(`<svg style="position:absolute;left:42px;top:540px" width="88" height="88"></svg>`);
  const ptzVals = ['PAN', 'TILT', 'ZOOM', 'VEL. PAN'].map((n, i) => {
    const y = 544 + i * 22;
    add(`<div class="sm" style="position:absolute;left:146px;top:${y}px">${n}</div>`);
    return add(`<div class="mo" style="position:absolute;right:${1600 - 296}px;top:${y - 2}px;font-size:11.5px;font-weight:700"></div>`);
  });

  // ------------------------------------------------------------ 03 energia
  panel(28, 656, 282, 204, 'ENERGIA', '03');
  const bSun = bar(42, 694, 120, 'SOLAR');
  const bLoad = bar(42, 718, 120, 'CONSUMO');
  const bBatt = bar(42, 742, 120, 'BATERIA');
  add(`<div style="position:absolute;left:42px;top:766px;width:254px;height:1px;background:${C.line}"></div>`);
  const auton = add(`<div style="position:absolute;left:42px;top:776px;font-size:24px;font-weight:700;letter-spacing:-.5px"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:806px">AUTONOMIA SEM SOL (ATÉ 80% DA CARGA)</div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:826px;font-size:8.2px">${SPEC.solar.n} × ${SPEC.solar.wp} Wp &nbsp;·&nbsp; ${SPEC.battery.n} × ${SPEC.battery.ah} Ah &nbsp;·&nbsp; ${fmtN(BATT_WH / 1000, 1)} kWh</div>`);

  // ------------------------------------------------------------ 04 LPR
  const L = FEED.lpr;
  panel(1313, 112, 258, 330, 'LPR · LEITURA DE PLACAS', '04', L);
  add(`<div class="fd" style="left:${L.x - 1}px;top:${L.y - 1}px;width:${L.w + 2}px;height:${L.h + 2}px"></div>`);
  const lprNight = add(`<div class="night" style="left:${L.x}px;top:${L.y}px;width:${L.w}px;height:${L.h}px"></div>`);
  const lprOff = add(`<div class="mo" style="position:absolute;left:${L.x}px;top:${L.y}px;width:${L.w}px;height:${L.h}px;background:#0e1430;color:#7d8bb3;font-size:10px;letter-spacing:2px;display:flex;align-items:center;justify-content:center">SEM SINAL</div>`);
  const lprTag = add(`<div class="fdt" style="left:${L.x + 6}px;top:${L.y + 6}px"></div>`);
  const lprBox = add(`<div style="position:absolute;border:1.5px solid ${C.ok};box-shadow:0 0 0 1px rgba(255,255,255,.6);display:none"></div>`);
  const lprBoxTag = add(`<div class="fdt" style="background:${C.ok};display:none"></div>`);
  const faceBox = add(`<div style="position:absolute;border:1.5px solid ${C.rec};box-shadow:0 0 0 1px rgba(255,255,255,.6);display:none"></div>`);
  const faceTag = add(`<div class="fdt" style="background:${C.rec};display:none"></div>`);
  const toast = add(`<div class="alert"><b>⚠ MANDADO DE PRISÃO EM ABERTO</b><span>RECONHECIMENTO FACIAL · PTZ</span><div class="ar"><i>SIMILARIDADE</i><em>${Math.round(WARRANT.sim * 100)}%</em></div><div class="ar"><i>BASE</i><em>${WARRANT.base}</em></div><div class="ar"><i>MANDADO</i><em>${WARRANT.ref}</em></div><div class="ar"><i>AÇÃO</i><em>CENTRAL E VIATURA AVISADAS</em></div></div>`);
  add(`<div class="sm" style="position:absolute;left:1327px;top:300px">PIXELS NA PLACA</div>`);
  add(`<div style="position:absolute;left:1327px;top:316px;width:230px;height:5px;background:rgba(10,10,74,.09);border-radius:2px"></div>`);
  const pxFill = add(`<div style="position:absolute;left:1327px;top:316px;height:5px;border-radius:2px"></div>`);
  const PXMAX = 260;
  add(`<div style="position:absolute;left:${1327 + (SPEC.lpr.minPx / PXMAX) * 230}px;top:311px;width:1.5px;height:15px;background:${C.ink}"></div>`);
  add(`<div class="sm" style="position:absolute;left:${1327 + (SPEC.lpr.minPx / PXMAX) * 230 + 4}px;top:325px;font-size:7.6px">MÍN. OCR ${SPEC.lpr.minPx}</div>`);
  const pxVal = add(`<div class="mo" style="position:absolute;right:${1600 - 1557}px;top:298px;font-size:11px;font-weight:700"></div>`);
  add(`<div style="position:absolute;left:1327px;top:342px;width:230px;height:1px;background:${C.line}"></div>`);
  const plateImgs = CARS.map((c) => mercosulPlate(c.plate).toDataURL());
  const reads = [0, 1].map((i) => {
    const y = 352 + i * 42;
    const img = add(`<img style="position:absolute;left:1327px;top:${y}px;width:92px;height:30px;border-radius:2px;box-shadow:0 0 0 1px ${C.faint}">`);
    const a = add(`<div class="mo" style="position:absolute;left:1428px;top:${y}px;font-size:12.5px;font-weight:700;letter-spacing:1px"></div>`);
    const b = add(`<div class="sm" style="position:absolute;left:1428px;top:${y + 17}px;font-size:8px;letter-spacing:.6px"></div>`);
    return {img, a, b, shown: null};
  });

  // ------------------------------------------------------------ 05 sequência, 06 vistas, 07 exibição
  const btn = {};
  panel(1313, 456, 258, 76, 'SEQUÊNCIA', '05');
  add(`<div class="well" style="position:absolute;left:1327px;top:491px;width:230px;height:28px;border-radius:999px"></div>`);
  SEQS.forEach((k, i) => (btn[k] = add(`<div class="bt flat" style="left:${1329 + i * 76}px;top:493px;width:74px;height:24px">${SEQ_LABEL[k]}</div>`)));
  const btnRow = (keys, labels, x0, y, wmax = 230) => {
    let x = x0;
    let yy = y;
    for (const k of keys) {
      const w = Math.round(labels[k].length * 7 + 18);
      if (x + w > x0 + wmax) {
        x = x0;
        yy += 30;
      }
      btn[k] = add(`<div class="bt" style="left:${x}px;top:${yy}px;width:${w}px;height:23px">${labels[k]}</div>`);
      x += w + 6;
    }
  };
  panel(1313, 546, 258, 136, 'VISTAS', '06');
  btnRow(VIEWS, VIEW_LABEL, 1327, 582);
  panel(1313, 696, 258, 106, 'EXIBIÇÃO', '07');
  btnRow(DISPLAY, DISPLAY_LABEL, 1327, 732);
  add(`<div class="sm" style="position:absolute;left:1314px;top:818px;line-height:15px;font-size:8.2px">ARRASTE PARA GIRAR · RODA PARA ZOOM<br>TECLAS 1–9 VISTAS · ESPAÇO PAUSA</div>`);

  // ------------------------------------------------------------ 08 operação
  panel(430, 752, 740, 108, 'OPERAÇÃO', '08');
  btn.play = add(`<div class="bt on" style="left:445px;top:795px;width:44px;height:44px;font-size:15px"></div>`);
  // a legenda: uma frase por cena, no lugar do texto técnico; de onde a sequência sai e aonde chega, pequeno embaixo
  const opPhase = add(`<div style="position:absolute;left:506px;width:506px;top:781px;text-align:center;font:600 14px/1.2 Inter,sans-serif;letter-spacing:-.1px;color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>`);
  const opFrom = add(`<div class="sm" style="position:absolute;left:506px;top:804px;font-size:7.8px"></div>`);
  const opTo = add(`<div class="sm" style="position:absolute;right:${1600 - 1012}px;top:804px;font-size:7.8px"></div>`);
  const TL = {x: 508, w: 504};
  add(`<div style="position:absolute;left:${TL.x}px;top:820px;width:${TL.w}px;height:3px;background:rgba(10,10,74,.09);border-radius:2px"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:820px;height:3px;background:${C.ac};border-radius:2px"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:814px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:linear-gradient(180deg,#fff,rgba(255,255,255,.75));border:1.5px solid rgba(255,255,255,.95);box-shadow:0 0 0 1.5px ${C.acInk},0 2px 6px rgba(20,40,90,.25);box-sizing:border-box"></div>`);
  const tlTime = add(`<div class="mo" style="position:absolute;left:506px;top:834px;font-size:9.6px;color:${C.mute};letter-spacing:1px"></div>`);
  add(`<div class="sm" style="position:absolute;left:1029px;top:805px">VELOCIDADE</div>`);
  const SP = {x: 1031, w: 92};
  add(`<div style="position:absolute;left:${SP.x}px;top:823px;width:${SP.w}px;height:3px;background:rgba(10,10,74,.09);border-radius:2px"></div>`);
  const spFill = add(`<div style="position:absolute;left:${SP.x}px;top:823px;height:3px;background:${C.ac};border-radius:2px"></div>`);
  const spKnob = add(`<div style="position:absolute;top:817px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:linear-gradient(180deg,#fff,rgba(255,255,255,.75));border:1.5px solid rgba(255,255,255,.95);box-shadow:0 0 0 1.5px ${C.acInk},0 2px 6px rgba(20,40,90,.25);box-sizing:border-box"></div>`);
  const spVal = add(`<div class="mo" style="position:absolute;left:1128px;top:818px;font-size:10px;font-weight:700"></div>`);

  // rodapé
  add(`<div class="sm" style="position:absolute;left:27px;top:878px;letter-spacing:2.2px">XPTO INC. &nbsp;·&nbsp; MODELO REPRESENTATIVO &nbsp;·&nbsp; DADOS DO ALERTA FICTÍCIOS &nbsp;·&nbsp; CARROS: COMRADE1280 (CC-BY 4.0) &nbsp;·&nbsp; PEDESTRE: MICROSOFT ROCKETBOX (MIT)</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:878px;letter-spacing:2.2px"><span style="color:${C.ac}">//////</span></div>`);

  // ------------------------------------------------------------ rótulos e o ponteiro
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const k = a.width / 1600 || 1;
    return [(r.left - a.left + r.width / 2) / k, (r.top - a.top + r.height / 2) / k];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const clock = (s) => `00:${String(Math.floor(s)).padStart(2, '0')}`;
  const onBtn = (k, on) => btn[k].classList.toggle('on', on);

  return {
    spots,
    btn,
    root: ui,
    TL,
    SP,
    update(s) {
      const m = s.m;
      // estado
      const [title, sub, kind] = s.status;
      chip.style.background = kind === 'alert' ? C.rec : kind === 'ok' ? C.ok : kind === 'move' ? C.ac : C.mute;
      stTitle.style.color = kind === 'alert' ? '#b4232a' : '';
      stTitle.textContent = title;
      stSub.textContent = sub;
      bMast.set(m.mast, `${fmtN(m.h, 2)} m`);
      bPanel.set(m.fold, `${Math.round(m.fold * 100)}%`);
      bCams.set(m.power, `${Math.round(m.power * 7)}/7`, m.power > 0.99 ? C.ok : C.ac);
      bLink.set(m.power * 0.86, m.power > 0.5 ? 'LTE · −71' : '—', m.power > 0.99 ? C.ok : C.ac);
      // PTZ
      const on = m.power > 0.02;
      ptzOff.style.display = on ? 'none' : 'flex';
      lprOff.style.display = on ? 'none' : 'flex';
      ptzNight.style.opacity = lprNight.style.opacity = String(s.night);
      const p = m.ptz;
      ptzTag.textContent = `PTZ · ${fmtN(p.zoom, 1)}× · ${p.person ? 'ROSTO · ' + Math.round(m.face?.px ?? 0) + ' px' : p.track >= 0 ? 'RASTREANDO ' + CARS[p.track].plate : 'VARREDURA'}`;
      ptzRec.innerHTML = `<span style="color:${C.rec}">●</span> REC${s.night > 0.5 ? ' · IR' : ''}`;
      ptzTag.style.display = ptzRec.style.display = on ? 'block' : 'none';
      {
        const R = 36;
        const a = (p.pan * Math.PI) / 180;
        const half = Math.atan(Math.tan((SPEC.ptz.hfovWide / 2) * (Math.PI / 180)) / p.zoom);
        // planta: o mastro no centro, a rua para baixo (+z), o leque do campo de visão
        const X = (ang, r) => (44 + Math.sin(ang) * r).toFixed(1);
        const Y = (ang, r) => (44 + Math.cos(ang) * r).toFixed(1);
        let h = `<circle cx="44" cy="44" r="${R}" fill="#f4f7fa" stroke="${C.faint}"/>`;
        for (let i = 0; i < 12; i++) h += `<line x1="${X((i * Math.PI) / 6, R - 4)}" y1="${Y((i * Math.PI) / 6, R - 4)}" x2="${X((i * Math.PI) / 6, R)}" y2="${Y((i * Math.PI) / 6, R)}" stroke="${C.mute}" stroke-width="1"/>`;
        h += `<rect x="6" y="64" width="76" height="14" fill="#e3e8ee"/><text x="44" y="74" text-anchor="middle" font-size="7" font-family="JetBrains Mono" fill="${C.mute}" letter-spacing="1">RUA</text>`;
        h += `<path d="M44 44L${X(a - half, R)} ${Y(a - half, R)}A${R} ${R} 0 0 0 ${X(a + half, R)} ${Y(a + half, R)}Z" fill="${C.ac}" opacity=".35"/>`;
        h += `<line x1="44" y1="44" x2="${X(a, R)}" y2="${Y(a, R)}" stroke="${C.ink}" stroke-width="1.6"/><circle cx="44" cy="44" r="3.5" fill="${C.ink}"/>`;
        dial.innerHTML = h;
        ptzVals[0].textContent = `${fmtN(((p.pan % 360) + 360) % 360, 1)}°`;
        ptzVals[1].textContent = `${fmtN(p.tilt, 1)}°`;
        ptzVals[2].textContent = `${fmtN(p.zoom, 1)}× / ${SPEC.ptz.zoom}×`;
        ptzVals[3].textContent = `${fmtN(Math.abs(s.panRate ?? 0), 0)}°/s`;
      }
      // energia
      bSun.set(m.solar / (SPEC.solar.n * SPEC.solar.wp), `${Math.round(m.solar * (1 - s.night))} W`, C.warn);
      bLoad.set(m.watts / 150, `${Math.round(m.watts)} W`);
      bBatt.set(0.86, '86%', C.ok);
      auton.textContent = Number.isFinite(m.autonomy) ? `${fmtN(m.autonomy, 0)} h · ${fmtN(m.autonomy / 24, 1)} dias` : '— em espera';
      // LPR
      const lk = s.lprK;
      const look = m.lpr[lk];
      lprTag.textContent = `LPR ${lk + 1} · f ${SPEC.lpr.f[lk]} mm · ${fmtN(LPR_HFOV[lk], 1)}° · FAIXA ${lk + 1}`;
      lprTag.style.display = on ? 'block' : 'none';
      const px = look && look.inView ? look.pixels : 0;
      pxFill.style.width = `${(Math.min(1, px / PXMAX) * 230).toFixed(1)}px`;
      pxFill.style.background = px >= SPEC.lpr.minPx ? C.ok : C.ac;
      pxVal.textContent = px ? `${Math.round(px)} px` : '—';
      if (s.plateBox && on) {
        const [x, y, w, h] = s.plateBox;
        const pad = 3;
        const inside = x > L.x && x + w < L.x + L.w && y > L.y && y + h < L.y + L.h;
        lprBox.style.display = inside ? 'block' : 'none';
        Object.assign(lprBox.style, {left: `${x - pad}px`, top: `${y - pad}px`, width: `${w + 2 * pad}px`, height: `${h + 2 * pad}px`, borderColor: look?.readable ? C.ok : C.warn});
        lprBoxTag.style.display = inside && look?.readable ? 'block' : 'none';
        Object.assign(lprBoxTag.style, {left: `${Math.min(L.x + L.w - 70, x - pad)}px`, top: `${Math.max(L.y + 2, y - pad - 16)}px`});
        lprBoxTag.textContent = 'LENDO…';
      } else {
        lprBox.style.display = 'none';
        lprBoxTag.style.display = 'none';
      }
      // o rosto na imagem da PTZ e o alerta
      if (s.faceBox && on) {
        const [x, y, w, h] = s.faceBox;
        const inside = x > F.x && x + w < F.x + F.w && y > F.y && y + h < F.y + F.h;
        const hit = !!m.alert;
        faceBox.style.display = inside ? 'block' : 'none';
        Object.assign(faceBox.style, {left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, borderColor: hit ? C.rec : C.ok});
        faceTag.style.display = inside ? 'block' : 'none';
        faceTag.style.background = hit ? C.rec : C.ok;
        Object.assign(faceTag.style, {left: `${Math.min(F.x + F.w - 96, x)}px`, top: `${Math.min(F.y + F.h - 16, y + h + 3)}px`});
        faceTag.textContent = hit ? `MANDADO · ${Math.round(m.alert.sim * 100)}%` : 'ANALISANDO…';
      } else {
        faceBox.style.display = 'none';
        faceTag.style.display = 'none';
      }
      {
        const a = m.alert;
        const o = a ? Math.min(1, a.age / 0.35) * (1 - Math.max(0, Math.min(1, (a.age - 5.4) / 0.6))) : 0;
        toast.style.opacity = o.toFixed(3);
        toast.style.transform = `translateX(-50%) translateY(${((1 - Math.min(1, (a?.age ?? 0) / 0.35)) * -10).toFixed(1)}px)`;
      }
      // as últimas leituras, a mais recente em cima
      const list = [...m.reads].reverse();
      reads.forEach((r, i) => {
        const e = list[i];
        const key = e ? e.car : null;
        r.img.style.display = e ? 'block' : 'none';
        if (e && r.shown !== key) {
          r.img.src = plateImgs[e.car];
          r.shown = key;
        }
        const fresh = e ? Math.max(0, 1 - e.age / 0.6) : 0;
        r.img.style.boxShadow = `0 0 0 ${1 + fresh * 2}px ${fresh > 0 ? C.ok : C.faint}`;
        r.a.innerHTML = e ? `${CARS[e.car].plate.slice(0, 3)}${CARS[e.car].plate.slice(3)} <span style="color:${C.ok};font-size:10px">${Math.round(e.conf * 100)}%</span>` : '';
        r.b.textContent = e ? `LPR ${e.lpr + 1} · ${Math.round(e.kmh)} km/h · ${fmtN(e.d, 1)} m` : '';
      });
      // botões
      for (const k of SEQS) {
        const on2 = s.seq === k;
        btn[k].classList.toggle('on', on2);
        btn[k].classList.toggle('flat', !on2);
        btn[k].style.color = on2 ? '' : '#6f7a8c';
      }
      for (const k of VIEWS) onBtn(k, s.view === k);
      for (const k of DISPLAY) onBtn(k, !!s.display[k]);
      // operação
      btn.play.innerHTML = s.paused ? '▶' : '❚❚';
      opFrom.textContent = s.from;
      opTo.textContent = s.to;
      if (opPhase.textContent !== s.caption) opPhase.textContent = s.caption;
      // entra suave: sobe 4 px e aparece em 0,5 s a cada frase nova
      const ck = Math.max(0, Math.min(1, s.captionAge / 0.5));
      opPhase.style.opacity = (ck * ck * (3 - 2 * ck)).toFixed(3);
      opPhase.style.transform = `translateY(${((1 - ck) * 4).toFixed(1)}px)`;
      const kx = TL.x + s.prog * TL.w;
      tlFill.style.width = `${(s.prog * TL.w).toFixed(1)}px`;
      tlKnob.style.left = `${kx.toFixed(1)}px`;
      tlTime.textContent = `${clock(s.tau)} / ${clock(s.dur)}`;
      const sk = SP.x + s.speedK * SP.w;
      spFill.style.width = `${(s.speedK * SP.w).toFixed(1)}px`;
      spKnob.style.left = `${sk.toFixed(1)}px`;
      spVal.textContent = `${fmtN(s.speed, 1)}×`;
      // rótulos
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 6).toFixed(1)}" fill="none" stroke="${C.acInk}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${C.acInk}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i></i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
