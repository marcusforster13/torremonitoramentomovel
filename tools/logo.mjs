// Gera src/logo.js com o logo original (assets/logo.png, fundo branco removido) como data URL.
import fs from 'node:fs';
const b64 = fs.readFileSync('assets/logo.png').toString('base64');
fs.writeFileSync('src/logo.js', `// Gerado por tools/logo.mjs a partir de assets/logo.png (o logo original da XPTO inc.). Não editar.\nexport const LOGO_URL = 'data:image/png;base64,${b64}';\nexport const LOGO_ASPECT = 788 / 208;\n`);
