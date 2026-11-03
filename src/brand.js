// A marca XPTO inc.: as letras geométricas do logo como caminhos SVG (100 de altura), um SVG para o console e
// texturas em canvas para o reboque e as câmeras. E a placa Mercosul dos carros.
export const BRAND = {cyan: '#00d4e6', cyanInk: '#009fb3', navy: '#0a0a4a'};

// X, P, T, O: cada parte é preenchida com evenodd (os anéis do P e do O); juntas fazem a palavra
export const LETTERS = [
  'M0 0h31l89 100H89z',
  'M89 0h31L31 100H0z',
  'M134 0h24v100h-24z',
  'M134 0H203A31 31 0 0 1 203 62H134ZM158 24H203A7 7 0 0 1 203 38H158Z',
  'M246 0h104v24h-40v76h-24v-76h-40z',
  'M414 0H464A50 50 0 0 1 464 100H414A50 50 0 0 1 414 0ZM414 24H464A26 26 0 0 1 464 76H414A26 26 0 0 1 414 24Z',
];

/** O logo em SVG, largura w; light = versão clara para fundo escuro. */
export function logoSvg(w, {light = false, inc = true} = {}) {
  const h = (w * (inc ? 150 : 100)) / 514;
  const ink = light ? '#ffffff' : BRAND.navy;
  const letters = LETTERS.map((d) => `<path d="${d}" fill="${light ? '#ffffff' : BRAND.cyan}" fill-rule="evenodd"/>`).join('');
  const tail = inc
    ? `<rect x="0" y="126" width="372" height="8" rx="4" fill="${ink}"/><text x="390" y="146" font-family="Inter" font-weight="800" font-size="46" letter-spacing="1" fill="${ink}">inc.</text>`
    : '';
  return `<svg width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="0 0 514 ${inc ? 150 : 100}">${letters}${tail}</svg>`;
}

/** Placa do reboque: azul-marinho, XPTO branco com o "inc." e a linha, a frase de baixo. */
export function trailerPlate() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#16205e';
  g.fillRect(0, 0, 1024, 400);
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = 6;
  g.strokeRect(10, 10, 1004, 380);
  g.save();
  g.translate(150, 70);
  g.scale(1.42, 1.42);
  g.fillStyle = '#ffffff';
  for (const d of LETTERS) g.fill(new Path2D(d), 'evenodd');
  g.restore();
  g.fillStyle = BRAND.cyan;
  g.fillRect(150, 238, 520, 10);
  g.fillStyle = '#ffffff';
  g.font = '800 64px Inter, sans-serif';
  g.fillText('inc.', 700, 262);
  g.font = '600 34px Inter, sans-serif';
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.fillText('O FUTURO DA SEGURANÇA', 152, 330);
  return c;
}

/** Etiqueta pequena para as câmeras: logo ciano sobre branco. */
export function camBadge() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 160);
  g.save();
  g.translate(40, 30);
  g.scale(0.84, 0.84);
  g.fillStyle = BRAND.cyan;
  for (const d of LETTERS) g.fill(new Path2D(d), 'evenodd');
  g.restore();
  g.fillStyle = BRAND.navy;
  g.fillRect(40, 124, 300, 7);
  g.font = '800 40px Inter, sans-serif';
  g.fillText('inc.', 356, 140);
  return c;
}

/** Placa Mercosul 400 x 130 mm: faixa azul com BRASIL, os 7 caracteres. */
export function mercosulPlate(text) {
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 260;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f7f4';
  g.fillRect(0, 0, 800, 260);
  g.fillStyle = '#1f47a8';
  g.fillRect(0, 0, 800, 58);
  g.fillStyle = '#ffffff';
  g.font = '700 38px Inter, sans-serif';
  g.textAlign = 'center';
  g.fillText('BRASIL', 400, 43);
  // a bandeirinha e o selo do Mercosul
  g.fillStyle = '#2e9b4c';
  g.fillRect(722, 12, 54, 36);
  g.fillStyle = '#f2c230';
  g.beginPath();
  g.moveTo(749, 15);
  g.lineTo(773, 30);
  g.lineTo(749, 45);
  g.lineTo(725, 30);
  g.fill();
  g.fillStyle = '#1f47a8';
  g.beginPath();
  g.arc(749, 30, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111111';
  g.font = '700 168px "JetBrains Mono", monospace';
  g.fillText(text, 400, 232, 740);
  g.strokeStyle = '#111111';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 794, 254);
  return c;
}
