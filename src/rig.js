// A geometria: o reboque do GLB (mastro telescópico, painéis que dobram), a cabeça de câmeras feita em código a partir
// da foto do equipamento (a viga preta com 2 speed domes PTZ, a Bullet, 2 LPRs e 2 iluminadores IR, com as
// antenas 4G), os carros com placa Mercosul e as coberturas no chão. update(s) posa tudo a partir do estado de kin.js.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {camBadge, loadLogo, mercosulPlate, trailerPlate} from './brand.js';
import {CARS, LPR_HFOV, lprCam, lprLook, PERSON, SPEC} from './kin.js';
import carSeda from './carro_seda.glb';
import carSuv from './carro_suv.glb';
import glb from './reboque.glb';
import pedestre from './pedestre.glb';

const V3 = THREE.Vector3;
const D2R = Math.PI / 180;
// o GLB: o mastro em (-23.00, 22.70), o chão em y = -0.292; giramos 90° para o reboque ficar paralelo à rua
const ORIGIN = new V3(-23.0, -0.292, 22.7);
const MAST_TRAVEL = SPEC.mastHigh - SPEC.mastLow;
// as peças da cabeça original do modelo, trocadas pela cabeça feita em código
const OLD_HEAD = new Set(['Material.102', 'Material.111', 'Material.106', 'Material.112', 'Material.113', 'Material.100', 'Material.114', 'Material.115', 'Material.116']);

export const MAT = {
  white: () => new THREE.MeshStandardMaterial({color: '#f1f3f5', roughness: 0.45, metalness: 0.05}),
  grey: () => new THREE.MeshStandardMaterial({color: '#6b7280', roughness: 0.5, metalness: 0.3}),
  black: () => new THREE.MeshStandardMaterial({color: '#1b1e24', roughness: 0.55, metalness: 0.2}),
  glass: () => new THREE.MeshStandardMaterial({color: '#0d1118', roughness: 0.08, metalness: 0.6}),
  steel: () => new THREE.MeshStandardMaterial({color: '#9aa3ad', roughness: 0.45, metalness: 0.7, envMapIntensity: 0.5}),
};

async function loadTrailer() {
  const bin = Uint8Array.from(atob(glb), (c) => c.charCodeAt(0));
  const g = await new GLTFLoader().parseAsync(bin.buffer, '');
  return g.scene;
}

/** Monta tudo e devolve {root, head, update, anchors, cams}. */
export async function buildRig(renderer) {
  const root = new THREE.Group();
  const logo = await loadLogo();
  // ------------------------------------------------------------ o reboque
  const model = await loadTrailer();
  const trailer = new THREE.Group();
  trailer.rotation.y = Math.PI / 2;
  trailer.add(model);
  model.position.set(-ORIGIN.x, -ORIGIN.y, -ORIGIN.z);
  root.add(trailer);
  const mats = new Set();
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    mats.add(o.material);
    if (o.parent?.name === 'CanoParte2_Mesh' || o.name.startsWith('CanoParte2_Mesh')) if (OLD_HEAD.has(o.material.name)) o.visible = false;
  });
  for (const m of mats) {
    if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, 0.42);
    m.envMapIntensity = 0.6;
  }
  // o mastro: o tubo azul de baixo é fixo. A parte de cima sobe e desce inteira: o anel cinza vai na base dela e
  // assenta no topo do tubo azul com o mastro recolhido; abaixo do anel sai de dentro do tubo azul um tubo azul mais
  // fino, e o cinza só começa acima do anel. O que fica abaixo do topo do tubo azul é cortado (está dentro dele).
  const mastNode = model.getObjectByName('CanoParte1_Mesh');
  root.updateMatrixWorld(true);
  const blueBox = new THREE.Box3().setFromObject(model.getObjectByName('Cylinder019'));
  const blueTop = blueBox.max.y;
  const axis = blueBox.getCenter(new V3());
  const band = mastNode.getObjectByName('Cylinder071');
  const ringMesh = mastNode.getObjectByName('Cylinder071_1');
  band.visible = false;
  // a base do anel (os vértices com raio maior que 8 cm), com a parte de cima na posição do modelo
  let ringLow = Infinity;
  {
    const pos = ringMesh.geometry.attributes.position;
    const w = new V3();
    for (let i = 0; i < pos.count; i++) {
      w.fromBufferAttribute(pos, i).applyMatrix4(ringMesh.matrixWorld);
      if (Math.hypot(w.x - axis.x, w.z - axis.z) > 0.08) ringLow = Math.min(ringLow, w.y);
    }
  }
  // com o mastro em cima, o anel fica MAST_TRAVEL acima do topo do tubo azul (recolhido, assenta nele)
  const lift = blueTop + MAST_TRAVEL - ringLow + 0.002;
  const mast0 = mastNode.position.y + lift;
  const ringTop0 = ringLow + lift;
  // o tubo azul fino que sai de dentro do de baixo, do anel para baixo
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, MAST_TRAVEL + 0.3, 28), band.material.clone());
  const fillY = ringTop0 - (MAST_TRAVEL + 0.3) / 2;
  fill.position.set(axis.x, fillY, axis.z);
  fill.castShadow = true;
  fill.receiveShadow = true;
  fill.userData.trailer = true;
  root.add(fill);
  // e, em cima, os suportes da cabeça antiga do modelo saem: o tubo de cima termina 0,9 m abaixo da cabeça nova, onde
  // começa o tubo dela (o plano acompanha a altura da cabeça)
  const mastTopClip = new THREE.Plane(new V3(0, -1, 0), SPEC.mastHigh - 0.9);
  const mastClip = [new THREE.Plane(new V3(0, 1, 0), -blueTop), mastTopClip];
  for (const o of [...(() => {
    const l = [];
    mastNode.traverse((m) => m.isMesh && l.push(m));
    return l;
  })(), fill]) {
    o.material = o.material.clone();
    o.material.clippingPlanes = mastClip;
    o.material.clipShadows = true;
  }
  // os painéis: o do meio é a referência e não se mexe; as laterais giram na aresta comum, uma de cada vez, e deitam
  // por cima dele com a face para baixo, uma sobre a outra (sanduíche). Tudo no espaço do modelo.
  root.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const CELLS = 'Material.100';
  const vertsOf = (obj, cellsOnly = false) => {
    const pts = [];
    obj.traverse((o) => {
      if (!o.isMesh || (cellsOnly && o.material.name !== CELLS)) return;
      const mm = inv.clone().multiply(o.matrixWorld);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 2) pts.push(new V3().fromBufferAttribute(pos, i).applyMatrix4(mm));
    });
    return pts;
  };
  const mean = (pts) => pts.reduce((a, p) => a.add(p), new V3()).multiplyScalar(1 / pts.length);
  const center = model.getObjectByName('Plane024');
  const cPts = vertsOf(center, true);
  const cMid = mean(cPts);
  // a normal do painel do meio: a direção de menor espessura (PCA simples: o eixo local com menor extensão)
  const qOf = (o) => model.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
  const axesOf = (o) => [new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1)].map((v) => v.applyQuaternion(qOf(o)).normalize());
  const extent = (pts, d) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pts) {
      const k = p.dot(d);
      lo = Math.min(lo, k);
      hi = Math.max(hi, k);
    }
    return [lo, hi];
  };
  // a normal da face das células: a média das normais da malha, levada ao espaço do modelo, apontando para cima
  const faceNormal = (obj) => {
    const n = new V3();
    const nm = new THREE.Matrix3();
    obj.traverse((o) => {
      if (!o.isMesh || o.material.name !== CELLS) return;
      nm.getNormalMatrix(inv.clone().multiply(o.matrixWorld));
      const a = o.geometry.attributes.normal;
      const v = new V3();
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix3(nm).normalize();
        n.add(v.y < 0 ? v.negate() : v);
      }
    });
    return n.normalize();
  };
  const N = faceNormal(center);
  // a dobradiça corre ao longo do reboque (z do modelo), no plano do painel do meio
  const H = new V3(0, 0, 1).addScaledVector(N, -N.z).normalize();
  const A = new V3().crossVectors(H, N).normalize();
  const cTop = extent(cPts, N)[1];
  // a direção do lado comprido de um conjunto de pontos no plano (H, A): PCA 2D
  const longAxis = (pts, c) => {
    let xx = 0;
    let yy = 0;
    let xy = 0;
    for (const p of pts) {
      const x = p.clone().sub(c).dot(H);
      const y = p.clone().sub(c).dot(A);
      xx += x * x;
      yy += y * y;
      xy += x * y;
    }
    return 0.5 * Math.atan2(2 * xy, xx - yy);
  };
  const cLong = longAxis(cPts, cMid);
  // cada folha da pilha: a espessura do painel com moldura mais uma folga
  const LAYER = 0.07;
  const sides = ['RodaEsquerda_Mesh', 'RodaDireita_Mesh'].map((name, idx) => {
    const m = model.getObjectByName(name);
    model.attach(m);
    m.updateMatrixWorld(true);
    const pts = vertsOf(m, true);
    const mid = mean(pts);
    const dir = Math.sign(mid.clone().sub(cMid).dot(A));
    // 1) o giro de livro: na aresta interna, um pouco acima do topo do painel do meio
    const inner = extent(pts, A.clone().multiplyScalar(dir))[0];
    const pivot = mean(pts.filter((p) => p.dot(A) * dir < inner + 0.03));
    pivot.addScaledVector(N, cTop + 0.03 + idx * LAYER - pivot.dot(N));
    const n0 = faceNormal(m);
    const proj = (v) => v.clone().addScaledVector(H, -v.dot(H)).normalize();
    const a0 = proj(n0);
    const a1 = proj(N.clone().negate());
    let ang = Math.atan2(new V3().crossVectors(a0, a1).dot(H), a0.dot(a1));
    const up = mid.clone().sub(pivot).applyAxisAngle(H, ang / 2).add(pivot).dot(N) > mid.dot(N);
    if (!up) ang -= Math.sign(ang) * Math.PI * 2;
    const Rb = new THREE.Quaternion().setFromAxisAngle(H, ang);
    // 2) o ajuste fino, feito junto com o giro: deixa a face exatamente paralela, o lado comprido alinhado e o centro
    // exatamente sobre o centro do painel do meio, uma camada acima (a segunda folha, duas)
    const landC = mid.clone().sub(pivot).applyQuaternion(Rb).add(pivot);
    const Qn = new THREE.Quaternion().setFromUnitVectors(n0.clone().applyQuaternion(Rb), N.clone().negate());
    const land = pts.map((p) => p.clone().sub(pivot).applyQuaternion(Rb).add(pivot).sub(landC).applyQuaternion(Qn).add(landC));
    let d = cLong - longAxis(land, landC);
    d = Math.atan2(Math.sin(2 * d), Math.cos(2 * d)) / 2;
    // longAxis mede o ângulo de H para A, que gira em torno de -N
    const Qy = new THREE.Quaternion().setFromAxisAngle(N.clone().negate(), d);
    const Qc = Qy.multiply(Qn);
    const target = cMid.clone().addScaledVector(N, (idx + 1) * LAYER);
    const shift = target.sub(landC);
    return {m, pivot, ang, Qc, shift, mid, p0: m.position.clone(), q0: m.quaternion.clone()};
  });
  const tq = new THREE.Quaternion();
  const cq = new THREE.Quaternion();
  const I = new THREE.Quaternion();
  const c = new V3();
  // fold[i] = 1 aberto, 0 fechado
  const foldPanels = (folds) => {
    sides.forEach((s, i) => {
      const u = 1 - folds[i];
      const k = u * u * (3 - 2 * u);
      tq.setFromAxisAngle(H, s.ang * u);
      // a pose do giro de livro, e o centro da placa nela
      s.m.position.copy(s.p0).sub(s.pivot).applyQuaternion(tq).add(s.pivot);
      c.copy(s.mid).sub(s.pivot).applyQuaternion(tq).add(s.pivot);
      // o ajuste em torno do centro da placa, crescendo junto com o giro
      cq.slerpQuaternions(I, s.Qc, k);
      s.m.position.sub(c).applyQuaternion(cq).add(c).addScaledVector(s.shift, k);
      s.m.quaternion.copy(cq).multiply(tq).multiply(s.q0);
    });
  };

  // as rodas: no modelo eram cilindros lisos com a foto como textura; aqui viram rodas de reboque como as da foto,
  // pneu de borracha com banda de rodagem e cravos, aro de aço preto com furos, cubo e 6 porcas
  {
    root.updateMatrixWorld(true);
    const wm = (geo, mat, f) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      f?.(m);
      return m;
    };
    const old = ['Cylinder006', 'Cylinder009', 'Cylinder010', 'Cylinder011'].map((n) => model.getObjectByName(n));
    const rubber = new THREE.MeshStandardMaterial({color: '#141516', roughness: 0.92, metalness: 0, side: THREE.DoubleSide});
    const rimMat = new THREE.MeshStandardMaterial({color: '#111214', roughness: 0.55, metalness: 0.3, envMapIntensity: 0.35, side: THREE.DoubleSide});
    const nutMat = new THREE.MeshStandardMaterial({color: '#b9bec5', roughness: 0.3, metalness: 0.9});
    const holeMat = new THREE.MeshBasicMaterial({color: '#050506'});
    const R = 0.345;
    const W = 0.19;
    // o perfil do pneu (raio, largura) girado em torno do eixo: ombro arredondado, flanco abaulado
    const prof = [];
    const rIn = 0.205;
    prof.push(new THREE.Vector2(rIn, -W / 2 + 0.01));
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      prof.push(new THREE.Vector2(R - 0.035 + Math.sin(a) * 0.035, -W / 2 + 0.035 - Math.cos(a) * 0.035));
    }
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      prof.push(new THREE.Vector2(R - 0.035 + Math.cos(a) * 0.035, W / 2 - 0.035 + Math.sin(a) * 0.035));
    }
    prof.push(new THREE.Vector2(rIn, W / 2 - 0.01));
    const tireGeo = new THREE.LatheGeometry(prof, 64);
    tireGeo.rotateX(Math.PI / 2);
    const lugGeo = new THREE.BoxGeometry(0.018, 0.005, W * 0.3);
    const rimGeo = new THREE.LatheGeometry(
      [[0.0, 0.05], [0.07, 0.05], [0.09, 0.03], [0.15, 0.03], [0.17, 0.0], [0.205, -0.02], [0.205, -0.08], [0.19, -0.085]].map(([r, z]) => new THREE.Vector2(r, z)),
      48,
    );
    rimGeo.rotateX(Math.PI / 2);
    for (const o of old) {
      const b = new THREE.Box3().setFromObject(o);
      const c = b.getCenter(new V3());
      // o lado de fora é o de |z| maior
      const out = Math.sign(c.z);
      o.visible = false;
      const w = new THREE.Group();
      w.position.set(c.x, R, (out > 0 ? b.max.z : b.min.z) - out * (W / 2 + 0.01));
      w.add(wm(tireGeo, rubber));
      // cravos da banda de rodagem, em dois carreiros desencontrados
      for (let i = 0; i < 56; i++) {
        const a = (i / 56) * Math.PI * 2;
        for (const side of [-1, 1]) {
          w.add(wm(lugGeo, rubber, (m) => {
            m.position.set(Math.cos(a + (side > 0 ? Math.PI / 56 : 0)) * (R + 0.002), Math.sin(a + (side > 0 ? Math.PI / 56 : 0)) * (R + 0.002), side * W * 0.22);
            m.rotation.z = a + (side > 0 ? Math.PI / 56 : 0);
          }));
        }
      }
      // o aro virado para fora, os furos de ventilação, o cubo e as porcas
      const rim = new THREE.Group();
      rim.scale.z = out;
      rim.add(wm(rimGeo, rimMat));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        rim.add(wm(new THREE.CircleGeometry(0.022, 16), holeMat, (m) => m.position.set(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0.031)));
        rim.add(wm(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 6), nutMat, (m) => {
          m.rotation.x = Math.PI / 2;
          m.position.set(Math.cos(a - Math.PI / 6) * 0.062, Math.sin(a - Math.PI / 6) * 0.062, 0.058);
        }));
      }
      rim.add(wm(new THREE.CylinderGeometry(0.038, 0.042, 0.03, 24), nutMat, (m) => {
        m.rotation.x = Math.PI / 2;
        m.position.z = 0.062;
      }));
      w.add(rim);
      w.userData.trailer = true;
      root.add(w);
    }
  }

  // a placa XPTO nos dois lados da caixa do reboque, colada na lataria como adesivo, 2 mm à frente da chapa (só o
  // bastante para a textura não piscar). No lado de trás ela fica exatamente sobre a placa reservada para o logo no
  // modelo (Plane023, 0,53 x 0,21 m, que fica escondida); no lado da rua, na posição espelhada.
  {
    const tex = new THREE.CanvasTexture(trailerPlate(logo));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({map: tex, roughness: 0.4, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1});
    const slot = model.getObjectByName('Plane023');
    const sb = new THREE.Box3().setFromObject(slot);
    slot.visible = false;
    const sc = sb.getCenter(new V3());
    const PW = sb.max.x - sb.min.x;
    const PH = sb.max.y - sb.min.y;
    const SPOTS = [
      {x: sc.x, y: sc.y, z: 0.6447, s: 1},
      {x: sc.x, y: sc.y, z: sb.max.z, s: -1},
    ];
    for (const p of SPOTS) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
      m.position.set(p.x, p.y, p.z + p.s * 0.002);
      m.rotation.y = p.s > 0 ? 0 : Math.PI;
      m.receiveShadow = true;
      root.add(m);
    }
  }

  // ------------------------------------------------------------ a cabeça de câmeras
  const head = new THREE.Group();
  root.add(head);
  const parts = {};
  const white = MAT.white();
  const black = MAT.black();
  const grey = MAT.grey();
  const glass = MAT.glass();
  const steel = MAT.steel();
  const badgeTex = new THREE.CanvasTexture(camBadge(logo));
  badgeTex.colorSpace = THREE.SRGBColorSpace;
  const badgeMat = new THREE.MeshStandardMaterial({map: badgeTex, roughness: 0.5});
  const mesh = (geo, mat, f) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    f?.(m);
    return m;
  };
  // a cabeça como na foto do equipamento: uma viga preta no topo do mastro; em cima dela, a Bullet branca no centro,
  // dois iluminadores IR e as duas LPR nas pontas; pendurada em cada ponta, num braço branco, uma speed dome PTZ.
  // +z é o lado da rua, x corre ao longo dela.
  const BEAM = {w: 1.3, h: 0.22, d: 0.34, y: 0.19};
  const TOP = BEAM.y + BEAM.h / 2;
  head.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 24), steel, (m) => (m.position.y = -0.06)));
  head.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 20), steel, (m) => (m.position.y = -0.6)));
  const beam = new THREE.Group();
  beam.add(mesh(new RoundedBoxGeometry(BEAM.w, BEAM.h, BEAM.d, 2, 0.015), black, (m) => (m.position.y = BEAM.y)));
  // a faixa de baixo, mais estreita e recuada, onde entram o mastro e os braços
  beam.add(mesh(new THREE.BoxGeometry(BEAM.w - 0.08, 0.08, BEAM.d - 0.06), new THREE.MeshStandardMaterial({color: '#2b2f36', roughness: 0.6, metalness: 0.2}), (m) => (m.position.y = BEAM.y - BEAM.h / 2 - 0.04)));
  // os parafusos da tampa e a etiqueta
  for (const x of [-0.5, -0.25, 0.25, 0.5]) beam.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 10), steel, (m) => {
    m.rotation.x = Math.PI / 2;
    m.position.set(x, BEAM.y + 0.07, BEAM.d / 2 + 0.002);
  }));
  beam.add(mesh(new THREE.PlaneGeometry(0.22, 0.068), badgeMat, (m) => m.position.set(0, BEAM.y - 0.02, BEAM.d / 2 + 0.002)));
  head.add(beam);
  parts.box = beam;

  // Bullet: corpo branco arredondado, viseira, vidro escuro (frente em +x do grupo)
  const makeBullet = (L = 0.34) => {
    const g = new THREE.Group();
    g.add(mesh(new RoundedBoxGeometry(L, 0.11, 0.12, 3, 0.04), white));
    g.add(mesh(new THREE.BoxGeometry(L + 0.06, 0.012, 0.16), white, (m) => m.position.set(0.03, 0.075, 0)));
    g.add(mesh(new THREE.CircleGeometry(0.045, 24), glass, (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.x = L / 2 + 0.001;
    }));
    g.add(mesh(new THREE.PlaneGeometry(0.12, 0.037), badgeMat, (m) => m.position.set(-0.03, 0, 0.0606)));
    return g;
  };
  {
    const arm = new THREE.Group();
    arm.position.set(0, TOP, 0.02);
    arm.add(mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.14, 12), white, (m) => (m.position.y = 0.07)));
    const b = makeBullet(0.38);
    b.position.y = 0.2;
    b.rotation.set(0, -Math.PI / 2, -8 * D2R, 'YZX');
    arm.add(b);
    head.add(arm);
    parts.bullets = [{arm, cam: b}];
  }

  // os iluminadores IR: caixas pretas com o painel de LEDs para a frente
  const irMat = new THREE.MeshStandardMaterial({color: '#3a1010', emissive: '#ff3b3b', emissiveIntensity: 0.0, roughness: 0.3});
  parts.ir = [-0.28, 0.28].map((x) => {
    const g = new THREE.Group();
    g.position.set(x, TOP, 0.02);
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), black, (m) => (m.position.y = 0.025)));
    g.add(mesh(new RoundedBoxGeometry(0.18, 0.1, 0.13, 2, 0.015), black, (m) => (m.position.y = 0.1)));
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 20), grey, (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.set(-0.04, 0.17, 0.0);
    }));
    for (let i = 0; i < 12; i++)
      g.add(mesh(new THREE.CircleGeometry(0.009, 10), irMat, (m) => m.position.set(-0.06 + (i % 6) * 0.024, 0.085 + Math.floor(i / 6) * 0.03, 0.0662)));
    head.add(g);
    return g;
  });

  // PTZ: duas speed domes penduradas nas pontas da viga, num braço branco; a da direita acompanha, a da esquerda varre
  const bubbleMat = new THREE.MeshPhysicalMaterial({color: '#2a3140', roughness: 0.05, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.55, depthWrite: false});
  const makePtz = (side) => {
    const ptz = new THREE.Group();
    ptz.position.set(side * SPEC.ptz.x, SPEC.ptz.dy, 0);
    // o braço: sai da ponta da viga, vira para baixo e segura a dome
    head.add(mesh(new THREE.BoxGeometry(SPEC.ptz.x - BEAM.w / 2 + 0.06, 0.05, 0.06), white, (m) => m.position.set(side * (BEAM.w / 2 + (SPEC.ptz.x - BEAM.w / 2) / 2), BEAM.y - 0.02, 0)));
    ptz.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 14), white, (m) => (m.position.y = 0.15)));
    const housing = new THREE.Group();
    ptz.add(housing);
    housing.add(mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.15, 32), white, (m) => (m.position.y = 0.02)));
    housing.add(mesh(new THREE.TorusGeometry(0.115, 0.01, 8, 32), grey, (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.y = -0.055;
    }));
    housing.add(mesh(new THREE.PlaneGeometry(0.12, 0.037), badgeMat, (m) => m.position.set(0, 0.04, 0.1155)));
    const bubble = mesh(new THREE.SphereGeometry(0.104, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bubbleMat, (m) => (m.position.y = -0.055));
    bubble.castShadow = false;
    bubble.renderOrder = 3;
    ptz.add(bubble);
    const tiltG = new THREE.Group();
    tiltG.position.y = -0.065;
    housing.add(tiltG);
    tiltG.add(mesh(new THREE.SphereGeometry(0.058, 20, 12), black));
    tiltG.add(mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.07, 20), black, (m) => {
      m.rotation.z = -Math.PI / 2;
      m.position.x = 0.055;
    }));
    tiltG.add(mesh(new THREE.CircleGeometry(0.026, 20), glass, (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.x = 0.091;
    }));
    head.add(ptz);
    return {g: ptz, housing, tiltG, side};
  };
  parts.ptz = makePtz(1);
  parts.ptz2 = makePtz(-1);

  // LPR: câmeras de caixa cinza-escuro com viseira, nas pontas de cima da viga, cada uma mirando a sua faixa
  const lprMat = new THREE.MeshStandardMaterial({color: '#3a3f47', roughness: 0.5, metalness: 0.3});
  const makeLpr = () => {
    const g = new THREE.Group();
    g.add(mesh(new RoundedBoxGeometry(0.32, 0.12, 0.13, 3, 0.02), lprMat));
    g.add(mesh(new THREE.BoxGeometry(0.38, 0.012, 0.16), lprMat, (m) => m.position.set(0.04, 0.072, 0)));
    g.add(mesh(new THREE.BoxGeometry(0.008, 0.1, 0.115), glass, (m) => (m.position.x = 0.161)));
    g.add(mesh(new THREE.CircleGeometry(0.032, 24), new THREE.MeshStandardMaterial({color: '#05070a', roughness: 0.05, metalness: 0.8}), (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.set(0.166, 0, 0);
    }));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.add(mesh(new THREE.CircleGeometry(0.007, 10), irMat, (m) => {
        m.rotation.y = Math.PI / 2;
        m.position.set(0.166, Math.sin(a) * 0.045, Math.cos(a) * 0.045);
      }));
    }
    g.add(mesh(new THREE.PlaneGeometry(0.12, 0.037), badgeMat, (m) => m.position.set(-0.04, 0, 0.0656)));
    return g;
  };
  parts.lpr = [0, 1].map((k) => {
    const arm = new THREE.Group();
    const c = lprCam(k, SPEC.mastHigh);
    arm.position.set(c.x, SPEC.lpr.dy, c.z);
    // o eixo: da câmera até o ponto da faixa a look metros, na altura da placa (com a cabeça em cima)
    const tx = (k === 0 ? -1 : 1) * SPEC.lpr.look[k];
    const tz = SPEC.lane[k];
    const yaw = Math.atan2(-(tz - c.z), tx - c.x);
    const pitch = -Math.atan2(c.y - 0.45, Math.hypot(tx - c.x, tz - c.z));
    const cam = makeLpr();
    cam.rotation.set(0, yaw, pitch, 'YZX');
    arm.add(cam);
    // o pé do suporte, apoiado na viga
    arm.add(mesh(new THREE.BoxGeometry(0.06, SPEC.lpr.dy - TOP, 0.06), black, (m) => (m.position.y = -(SPEC.lpr.dy - TOP) / 2 - 0.06)));
    head.add(arm);
    return {arm, cam, yaw, pitch};
  });

  // ------------------------------------------------------------ os carros: sedã e SUV do pacote CC-BY de Comrade1280
  // (os mesmos do projeto Lei Seca), frente em +x, rodas soltas para girar; a placa Mercosul na frente e atrás
  const carSrc = {seda: carSeda, suv: carSuv};
  const cars = [];
  for (const c of CARS) {
    const bin = Uint8Array.from(atob(carSrc[c.model]), (ch) => ch.charCodeAt(0));
    const gl = (await new GLTFLoader().parseAsync(bin.buffer, '')).scene;
    const g = new THREE.Group();
    g.add(gl);
    const wheels = [];
    gl.traverse((o) => {
      if (o.name.startsWith('Roda_')) wheels.push(o);
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const m = o.material;
      if (/^Body/.test(m.name)) {
        o.material = m.clone();
        o.material.map = null;
        o.material.color.set(c.color);
        o.material.roughness = 0.35;
        o.material.metalness = 0.5;
      }
      o.material.envMapIntensity = 0.8;
    });
    const box = new THREE.Box3().setFromObject(gl);
    const tex = new THREE.CanvasTexture(mercosulPlate(c.plate));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const pm = new THREE.MeshStandardMaterial({map: tex, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2});
    for (const sgn of [1, -1]) {
      g.add(mesh(new THREE.PlaneGeometry(SPEC.plateW, SPEC.plateH), pm, (m) => {
        m.position.set(sgn > 0 ? box.max.x + 0.012 : box.min.x - 0.012, 0.45, 0);
        m.rotation.y = (sgn * Math.PI) / 2;
      }));
    }
    g.visible = false;
    root.add(g);
    cars.push({g, wheels});
  }

  // ------------------------------------------------------------ o pedestre (Microsoft Rocketbox, MIT, via projeto Lei Seca)
  const ped = {};
  {
    const bin = Uint8Array.from(atob(pedestre), (ch) => ch.charCodeAt(0));
    const gltf = await new GLTFLoader().parseAsync(bin.buffer, '');
    const g = new THREE.Group();
    g.add(gltf.scene);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      o.material.envMapIntensity = 0.7;
    });
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const clip = gltf.animations.find((c) => c.name === 'andando') ?? gltf.animations[0];
    // só a rotação dos ossos: o andar fica no lugar e o deslocamento vem de kin.js
    clip.tracks = clip.tracks.filter((t) => !/\.position$/.test(t.name) || !/hips|pelvis|root/i.test(t.name));
    mixer.clipAction(clip).play();
    // o anel de alerta no chão e o marcador acima da cabeça
    const ringMat = new THREE.MeshBasicMaterial({color: '#e5484d', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6});
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 48), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.renderOrder = 5;
    g.add(ring);
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4), new THREE.MeshBasicMaterial({color: '#e5484d', transparent: true, opacity: 0}));
    pin.rotation.x = Math.PI;
    pin.position.y = 2.15;
    g.add(pin);
    g.visible = false;
    root.add(g);
    Object.assign(ped, {g, mixer, clip, ring, ringMat, pin});
  }

  // ------------------------------------------------------------ coberturas: leques das Bullets, zonas de leitura das LPRs
  const coverMat = (col, a) => new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: a, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6});
  const cover = new THREE.Group();
  cover.userData.cover = true;
  root.add(cover);
  const fanMats = [];
  for (const yaw of [270]) {
    const m = coverMat('#00b8cc', 0.12);
    fanMats.push(m);
    const geo = new THREE.RingGeometry(1.2, 16, 48, 1, (-SPEC.bullet.hfov / 2) * D2R, SPEC.bullet.hfov * D2R);
    const f = new THREE.Mesh(geo, m);
    f.rotation.x = -Math.PI / 2;
    f.rotation.z = yaw * D2R;
    f.position.y = 0.012 + yaw * 0.00002;
    f.renderOrder = 2;
    cover.add(f);
  }
  // a zona de leitura de cada LPR: onde a placa fica dentro do campo com >= 130 px, amostrada ao longo da faixa
  const zones = [0, 1].map((k) => {
    const dir = k === 0 ? 1 : -1;
    let a = null;
    let b = null;
    for (let x = -40; x <= 40; x += 0.05) {
      const g = lprLook(k, {x, z: SPEC.lane[k], dir, i: k}, SPEC.mastHigh);
      if (g?.readable) {
        a = a === null ? x : Math.min(a, x);
        b = b === null ? x : Math.max(b, x);
      }
    }
    // a zona é da placa (frente do carro): desloca de meia carroceria
    const x0 = a + dir * (SPEC.carLen / 2);
    const x1 = b + dir * (SPEC.carLen / 2);
    const m = coverMat('#00d4e6', 0.22);
    const z = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0), 3.0), m);
    z.rotation.x = -Math.PI / 2;
    z.position.set((x0 + x1) / 2, 0.016, SPEC.lane[k]);
    z.renderOrder = 2;
    cover.add(z);
    return {m, x0: Math.min(x0, x1), x1: Math.max(x0, x1)};
  });
  // o raio da LPR e da PTZ: um cone fino até o alvo
  const beamMat = (col) => new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide});
  const coneGeo = new THREE.ConeGeometry(1, 1, 4, 1, true);
  coneGeo.rotateY(Math.PI / 4);
  coneGeo.translate(0, -0.5, 0);
  coneGeo.rotateX(-Math.PI / 2);
  const ptzBeam = new THREE.Mesh(coneGeo, beamMat('#00b8cc'));
  const lprBeams = [0, 1].map(() => new THREE.Mesh(coneGeo, beamMat('#1f3a8a')));
  for (const b of [ptzBeam, ...lprBeams]) {
    b.renderOrder = 4;
    b.userData.cover = true;
    root.add(b);
  }

  // ------------------------------------------------------------ a pose
  const tmp = new V3();
  const tgt = new V3();
  const ptzWorld = new V3();
  const update = (s, opt = {}) => {
    const explode = opt.explode ?? 0;
    const cov = opt.cover ?? 0;
    mastNode.position.y = mast0 - (1 - s.mast) * MAST_TRAVEL;
    fill.position.y = fillY - (1 - s.mast) * MAST_TRAVEL;
    mastTopClip.constant = s.h - 0.9;
    head.position.set(0, s.h, 0);
    foldPanels(s.folds);
    // explodida: cada câmera se afasta da viga
    for (const b of parts.bullets) b.arm.position.set(0, TOP + explode * 0.4, 0.02 + explode * 0.25);
    parts.ir.forEach((g, i) => g.position.set((i ? 0.28 : -0.28) + (i ? 1 : -1) * explode * 0.15, TOP + explode * 0.25, 0.02 + explode * 0.35));
    for (const p of [parts.ptz, parts.ptz2]) p.g.position.set(p.side * (SPEC.ptz.x + explode * 0.4), SPEC.ptz.dy - explode * 0.3, 0);
    for (const [k, l] of parts.lpr.entries()) {
      const c = lprCam(k, 0);
      l.arm.position.set(c.x + (k === 0 ? -1 : 1) * explode * 0.35, SPEC.lpr.dy + explode * 0.35, c.z);
    }
    parts.box.position.z = -explode * 0.0;
    // PTZ: pan em torno do eixo vertical (0° = +z, a rua), tilt para baixo; a segunda faz a varredura do outro lado
    parts.ptz.housing.rotation.y = (s.ptz.pan - 90) * D2R;
    parts.ptz.tiltG.rotation.z = -s.ptz.tilt * D2R;
    const scan2 = s.seq === 'patrol' ? -40 - 35 * Math.sin(s.tau * 0.4 + 1) : -30;
    parts.ptz2.housing.rotation.y = (scan2 - 90) * D2R;
    parts.ptz2.tiltG.rotation.z = -16 * D2R;
    irMat.emissiveIntensity = s.power * (0.35 + 0.65 * (opt.night ?? 0));
    // os carros
    cars.forEach((c, i) => {
      const p = s.cars[i];
      c.g.visible = !!p;
      if (!p) return;
      c.g.position.set(p.x, 0, p.z);
      c.g.rotation.y = p.dir > 0 ? 0 : Math.PI;
      const roll = (p.s * CARS[i].v) / 0.32;
      for (const w of c.wheels) w.rotation.z = -roll;
    });
    // o pedestre: anda para -x; o passo acompanha a velocidade (ciclo do clipe a 1,3 m/s)
    const pp = s.person;
    ped.g.visible = !!pp;
    if (pp) {
      ped.g.position.set(pp.x, 0, pp.z);
      ped.g.rotation.y = -Math.PI / 2;
      ped.mixer.setTime(pp.s % ped.clip.duration);
      const al = s.alert ? Math.min(1, s.alert.age / 0.3) : 0;
      const pulse = 0.6 + 0.4 * Math.sin((s.alert?.age ?? 0) * 7);
      ped.ringMat.opacity = al * pulse * 0.85;
      ped.ring.scale.setScalar(1 + 0.15 * pulse);
      ped.pin.material.opacity = al;
      ped.pin.position.y = 2.15 + 0.05 * Math.sin((s.alert?.age ?? 0) * 4);
    }
    // coberturas
    cover.visible = cov > 0.01 && s.power > 0.5;
    for (const m of fanMats) m.opacity = 0.1 * cov;
    zones.forEach((z, k) => {
      const live = s.lpr[k]?.readable ? 1 : 0;
      z.m.opacity = cov * (0.16 + 0.3 * live);
    });
    // o raio da PTZ até o ponto que ela olha
    head.updateMatrixWorld(true);
    parts.ptz.tiltG.getWorldPosition(ptzWorld);
    const pr = s.ptz.pan * D2R;
    const tr = s.ptz.tilt * D2R;
    const dirv = tmp.set(Math.sin(pr) * Math.cos(tr), -Math.sin(tr), Math.cos(pr) * Math.cos(tr));
    const reach = Math.min(40, (ptzWorld.y - 0.7) / Math.max(0.05, Math.sin(tr)));
    const hf = Math.atan(Math.tan((SPEC.ptz.hfovWide / 2) * D2R) / s.ptz.zoom);
    setBeam(ptzBeam, ptzWorld, tgt.copy(ptzWorld).addScaledVector(dirv, reach), hf, cov * s.power);
    parts.lpr.forEach((l, k) => {
      const w = l.cam.getWorldPosition(new V3());
      const look = s.lpr[k];
      const end = look && look.inView ? new V3(look.plateX, 0.45, SPEC.lane[k]) : new V3((k === 0 ? -1 : 1) * SPEC.lpr.look[k], 0.45, SPEC.lane[k]);
      setBeam(lprBeams[k], w, end, (LPR_HFOV[k] / 2) * D2R, cov * s.power * (look?.readable ? 1 : 0.5));
    });
  };
  const up = new V3(0, 1, 0);
  function setBeam(m, a, b, half, o) {
    m.visible = o > 0.01;
    m.material.opacity = 0.1 * Math.min(1, o);
    const len = a.distanceTo(b);
    m.position.copy(a);
    m.lookAt(b);
    m.scale.set(Math.tan(half) * len, Math.tan(half) * len * 0.5625, len);
    void up;
  }

  // os pontos para os rótulos e as câmeras virtuais das imagens ao vivo
  const anchors = {
    ptz: () => parts.ptz.housing.getWorldPosition(new V3()),
    bullet: () => parts.bullets[0].cam.getWorldPosition(new V3()),
    ptz2: () => parts.ptz2.housing.getWorldPosition(new V3()),
    ir: () => parts.ir[0].localToWorld(new V3(0, 0.12, 0)),
    lpr0: () => parts.lpr[0].cam.getWorldPosition(new V3()),
    lpr1: () => parts.lpr[1].cam.getWorldPosition(new V3()),
    box: () => parts.box.localToWorld(new V3(-0.12, 0.13, 0.17)),
    mast: () => new V3(0, head.position.y - 1.4, 0),
    panel: () => center.getWorldPosition(new V3()),
    battery: () => new V3(-1.9, 0.9, 0.2),
    person: () => ped.g.localToWorld(new V3(0, 1.95, 0)),
  };
  // otimização sem perda: as ~200 peças paradas do reboque viram uma malha por material (a geometria é a mesma, só
  // desenhada de uma vez). Ficam de fora as que se movem (mastro, painéis laterais) e as escondidas.
  {
    root.updateMatrixWorld(true);
    const inv = model.matrixWorld.clone().invert();
    const moving = new Set([mastNode, ...sides.map((x) => x.m)]);
    const groups = new Map();
    const victims = [];
    model.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      for (let q = o; q && q !== model; q = q.parent) if (moving.has(q) || !q.visible) return;
      if (o.material.clippingPlanes || Array.isArray(o.material)) return;
      const g = o.geometry;
      const key = [o.material.uuid, Object.keys(g.attributes).sort().join(','), g.index ? 'i' : 'n', o.castShadow, o.receiveShadow].join('|');
      const m = inv.clone().multiply(o.matrixWorld);
      const ng = g.clone().applyMatrix4(m);
      // espelhamento na transformação inverte a ordem dos vértices: desvira para a face continuar para fora
      if (m.determinant() < 0) {
        if (ng.index) {
          const a = ng.index.array;
          for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
        } else {
          for (const attr of Object.values(ng.attributes)) {
            const sz = attr.itemSize;
            const a = attr.array;
            for (let i = 0; i < attr.count; i += 3)
              for (let k = 0; k < sz; k++) [a[(i + 1) * sz + k], a[(i + 2) * sz + k]] = [a[(i + 2) * sz + k], a[(i + 1) * sz + k]];
          }
        }
      }
      if (!groups.has(key)) groups.set(key, {mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: []});
      groups.get(key).geos.push(ng);
      victims.push(o);
    });
    for (const o of victims) o.parent.remove(o);
    for (const {mat, cast, recv, geos} of groups.values()) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = cast;
      m.receiveShadow = recv;
      model.add(m);
    }
  }
  return {root, head, parts, update, anchors, cars, zones, ptzWorld, model, trailer, sides, ped};
}
