# Torre de Monitoramento Móvel · XPTO inc.

Simulador 3D interativo do reboque de monitoramento da XPTO inc.: painéis solares dobráveis, mastro telescópico e a
cabeça de câmeras como a do equipamento real: uma viga preta com **2 PTZ** (speed domes 32×, uma rastreia e outra varre),
uma **Bullet** de visão geral, **2 LPR** (leitura de placas Mercosul) e **2 iluminadores IR**.

- `public/index.html`: a página pronta, offline, um arquivo só (é o que a Vercel publica).
- Sem mexer, a página faz um passeio automático; um clique devolve o controle.
- **Sequências:** IMPLANTAR, MONITORAR, RECOLHER. **Vistas:** teclas 1–7. Arraste para girar, roda para zoom.
- **Exibição:** rótulos, cobertura (leques das Bullets, zonas de leitura das LPRs), explodida, noite IR, órbita.
- **Painéis solares:** o do meio fica fixo; as laterais fecham como páginas de livro, uma de cada vez, e ficam
  empilhadas exatamente sobre ele. O mastro sobe antes de os painéis abrirem.
- **Reconhecimento facial:** um pedestre anda pela calçada; a PTZ dá zoom no rosto e, com pixels suficientes, a
  consulta acusa **mandado de prisão em aberto** (dados fictícios).

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
| `src/brand.js` / `src/logo.js` | O logo original da XPTO inc. (de `assets/logo.png`) e a placa Mercosul. |

## Créditos

- Carros (sedã e SUV): "Generic passenger car pack" de [Comrade1280](https://sketchfab.com/comrade1280), licença
  [CC-BY 4.0](http://creativecommons.org/licenses/by/4.0/), modificados (repintados, texturas reduzidas).
- Pedestre: Microsoft Rocketbox, licença MIT.
- Reboque: `carro2.glb` fornecido pela XPTO inc.

## Build

Feito com a skill *teardown* (three.js + esbuild):

```
node <teardown>/sims/build.mjs ./live    # → teardown-out/dist/live.html → copiar para public/index.html
node <teardown>/sims/build.mjs ./film    # filme; capture.mjs grava o vídeo
```
