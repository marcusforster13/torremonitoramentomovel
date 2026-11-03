// A marca XPTO inc.: o logo original (src/logo.js) no console, na placa do reboque e nas etiquetas das câmeras. E a
// placa Mercosul dos carros.
import {LOGO_ASPECT, LOGO_URL} from './logo.js';

/** O logo original carregado como imagem, para desenhar em canvas. */
export async function loadLogo() {
  const img = new Image();
  img.src = LOGO_URL;
  await img.decode();
  return img;
}
/** O logo original como <img> para o HTML, largura w. */
export const logoImg = (w) => `<img src="${LOGO_URL}" width="${w}" height="${(w / LOGO_ASPECT).toFixed(1)}" alt="XPTO inc." style="display:block">`;
export const BRAND = {cyan: '#00d4e6', cyanInk: '#009fb3', navy: '#0a0a4a'};

/** Placa do reboque: branca com o logo original e a frase, moldura azul-marinho. */
export function trailerPlate(logo) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 1024, 400);
  g.strokeStyle = BRAND.navy;
  g.lineWidth = 10;
  g.strokeRect(5, 5, 1014, 390);
  const w = 820;
  g.drawImage(logo, (1024 - w) / 2, 52, w, w / LOGO_ASPECT);
  g.fillStyle = BRAND.navy;
  g.font = '700 38px Inter, sans-serif';
  g.textAlign = 'center';
  g.fillText('O FUTURO DA SEGURANÇA', 512, 340);
  return c;
}

/** Etiqueta pequena para as câmeras: o logo original sobre branco. */
export function camBadge(logo) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 160);
  const w = 460;
  g.drawImage(logo, 26, (160 - w / LOGO_ASPECT) / 2, w, w / LOGO_ASPECT);
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
