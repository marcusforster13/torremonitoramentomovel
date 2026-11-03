# Torre de Monitoramento Móvel · XPTO inc.

Simulador 3D interativo do reboque de monitoramento da XPTO inc.: painéis solares dobráveis, mastro telescópico e a
cabeça de câmeras com **PTZ** (speed dome 32×), **4 Bullets** (360°) e **2 LPR** (leitura de placas Mercosul com IR).

- `public/index.html`: a página pronta, offline, um arquivo só (é o que a Vercel publica).
- Sem mexer, a página faz um passeio automático; um clique devolve o controle.
- **Sequências:** IMPLANTAR, MONITORAR, RECOLHER. **Vistas:** teclas 1–7. Arraste para girar, roda para zoom.
- **Exibição:** rótulos, cobertura (leques das Bullets, zonas de leitura das LPRs), explodida, noite IR, órbita.

Os painéis ao vivo vêm do mesmo modelo que move as peças (`src/kin.js`): ângulos de pan e tilt da PTZ pelo
rastreio do carro, pixels na placa pela distância e pela lente de cada LPR (mínimo de 130 px para o OCR), consumo e
autonomia pelo que está ligado. Especificações representativas, não de um produto específico.

## Estrutura

| Arquivo | Função |
|---|---|
| `src/kin.js` | A matemática: especificações, carros, PTZ, LPR, energia. Sem three.js. |
| `src/rig.js` | O reboque (`src/reboque.glb`), a cabeça de câmeras e os carros em código. |
| `src/stage.js` | Estúdio, rua, sombras e as imagens ao vivo da PTZ e da LPR. |
| `src/console.js` | O console em vidro (estilo Liquid Glass do `GlassView` do expo-glass-effect, em CSS). |
| `src/film.js` / `src/live.js` | O filme (função pura do tempo) e a página interativa. |
| `src/brand.js` | Logo XPTO e placa Mercosul desenhados em código. |

## Build

Feito com a skill *teardown* (three.js + esbuild):

```
node <teardown>/sims/build.mjs ./live    # → teardown-out/dist/live.html → copiar para public/index.html
node <teardown>/sims/build.mjs ./film    # filme; capture.mjs grava o vídeo
```
