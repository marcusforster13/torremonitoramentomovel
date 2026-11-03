// Monta a página publicada a partir do build da página ao vivo: título, descrição, capa e ícone para o link (WhatsApp,
// redes), e uma tela de abertura com o logo escrita direto no HTML, que aparece no primeiro instante, enquanto o
// resto do arquivo ainda está baixando. Saída: public/index.html e teardown-out/dist/xpto-torre.html.
//   node tools/site.mjs
import fs from 'node:fs';

const SITE = 'https://torremonitoramentomovel.vercel.app';
const TITLE = 'XPTO inc. · Torre de Monitoramento Móvel';
const DESC = 'Showroom 3D interativo: reboque solar com mastro telescópico, câmeras PTZ, Bullet e LPR, leitura de placas e reconhecimento facial.';
const logo = fs.readFileSync('assets/logo.png').toString('base64');
let html = fs.readFileSync('teardown-out/dist/live.html', 'utf8');

const head = `<title>${TITLE}</title>
<meta name="description" content="${DESC}">
<meta name="theme-color" content="#e9eef2">
<link rel="icon" type="image/png" href="/icone.png">
<link rel="apple-touch-icon" href="/icone.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="XPTO inc.">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESC}">
<meta property="og:url" content="${SITE}/">
<meta property="og:image" content="${SITE}/capa.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${DESC}">
<meta name="twitter:image" content="${SITE}/capa.jpg">`;

// a tela de abertura: fundo da cena, o logo, a frase e uma barra que corre enquanto o arquivo chega
const splash = `<div id="splash" style="position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#e9eef2;transition:opacity .6s">
<style>@keyframes sp{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}</style>
<img src="data:image/png;base64,${logo}" alt="XPTO inc." style="width:min(260px,60vw);height:auto">
<div style="font:600 15px/1.3 system-ui,sans-serif;color:#0a0a4a;letter-spacing:.2px;text-align:center">Torre de Monitoramento Móvel</div>
<div style="width:min(260px,60vw);height:4px;border-radius:2px;background:rgba(10,10,74,.1);overflow:hidden"><div style="width:40%;height:100%;border-radius:2px;background:#00d4e6;animation:sp 1.1s ease-in-out infinite"></div></div>
<div style="font:500 11px system-ui,sans-serif;letter-spacing:1.6px;color:#7d8696;text-transform:uppercase">Carregando o showroom 3D</div>
</div>`;

html = html.replace('<html lang="en">', '<html lang="pt-BR">');
html = html.replace(/<title>[^<]*<\/title>/, head);
html = html.replace('<body>', `<body>\n${splash}`);
fs.writeFileSync('public/index.html', html);
fs.writeFileSync('teardown-out/dist/xpto-torre.html', html);
console.log('public/index.html', (html.length / 1e6).toFixed(2), 'MB');
