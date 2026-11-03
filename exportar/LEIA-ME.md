# GLBs da cena da Torre XPTO, na posição em que aparecem no simulador

Todos em **metros**, com o mesmo ponto de origem: o **pé do mastro** é a origem (0, 0, 0) e o chão é a altura 0.
No glTF o eixo y aponta para cima; o Blender importa com z para cima.

- A rua corre ao longo de **x**. Faixa 1 em z = 5,75 m (carros indo para +x) e faixa 2 em z = 9,25 m (indo para -x).
  No Blender isso vira y = -5,75 e y = -9,25.
- A calçada fica entre o reboque e a guia (z de 0 a 3,85 m); o pedestre anda em z = 3,15 m.

| Arquivo | O que é | Pose |
|---|---|---|
| `reboque_xpto.glb` | Reboque com painéis, mastro e placas XPTO | Implantado: mastro em cima, painéis abertos |
| `cabeca_cameras.glb` | Cabeça de câmeras: PTZ, 4 Bullets, 2 LPR, caixa e antenas | No topo do mastro (5,45 m) |
| `carro_sedan.glb` / `carro_suv.glb` | Os dois carros com placa Mercosul | Na faixa de cada um, perto da torre |
| `pedestre.glb` | Pedestre Rocketbox com a animação de andar | Na calçada, andando para -x |
| `cena_completa.glb` | Tudo junto | Como acima |

Quando me mandar de volta, mantenha a origem e a escala: assim cada peça entra no simulador no mesmo lugar.
Se mexer nas peças que se movem (painéis laterais, mastro de cima, PTZ, rodas), mantenha os nomes dos objetos ou
me diga quais mudaram.
