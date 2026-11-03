// A geometria: o reboque do GLB (mastro telescópico, painéis que dobram), a cabeça de câmeras feita em código a partir
// da foto do equipamento (4 Bullets, a speed dome PTZ, 2 LPRs com iluminador IR, a caixa de equipamentos com as
// antenas 4G), os carros com placa Mercosul e as coberturas no chão. update(s) posa tudo a partir do estado de kin.js.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {camBadge, mercosulPlate, trailerPlate} from './brand.js';
import {CARS, LPR_HFOV, lprCam, lprLook, SPEC} from './kin.js';
import glb from './reboque.glb';

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
  const mastNode = model.getObjectByName('CanoParte1_Mesh');
  const mast0 = mastNode.position.y;
  // os painéis: o central fica, os laterais dobram por cima dele girando em torno da aresta comum
  root.updateMatrixWorld(true);
  const center = model.getObjectByName('Plane024');
  // a orientação do painel central no espaço do modelo
  const qc = model.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(center.getWorldQuaternion(new THREE.Quaternion()));
  const axes = [new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1)].map((a) => a.applyQuaternion(qc));
  const hingeDir = axes.reduce((a, b) => (Math.abs(b.z) > Math.abs(a.z) ? b : a)).clone().normalize();
  const sides = ['RodaDireita_Mesh', 'RodaEsquerda_Mesh'].map((n) => {
    const m = model.getObjectByName(n);
    model.attach(m);
    m.updateMatrixWorld(true);
    // a aresta mais próxima do centro: os vértices de menor |x| relativo ao mastro, no espaço do modelo
    const inv = model.matrixWorld.clone().invert();
    const pts = [];
    m.traverse((o) => {
      if (!o.isMesh) return;
      const mm = inv.clone().multiply(o.matrixWorld);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) pts.push(new V3().fromBufferAttribute(pos, i).applyMatrix4(mm));
    });
    const side = Math.sign(pts.reduce((s, p) => s + p.x - ORIGIN.x, 0));
    const inner = pts.map((p) => (p.x - ORIGIN.x) * side);
    const mn = Math.min(...inner);
    const edge = pts.filter((p, i) => inner[i] < mn + 0.02);
    const pivot = edge.reduce((a, p) => a.add(p), new V3()).multiplyScalar(1 / edge.length);
    // sobe primeiro: o sinal que leva o centro do painel para cima
    const c = pts.reduce((a, p) => a.add(p), new V3()).multiplyScalar(1 / pts.length);
    const q = new THREE.Quaternion().setFromAxisAngle(hingeDir, Math.PI / 2);
    const up = c.clone().sub(pivot).applyQuaternion(q).y > 0 ? 1 : -1;
    return {m, pivot, p0: m.position.clone(), q0: m.quaternion.clone(), sign: up, reach: n === "RodaDireita_Mesh" ? 0.992 : 0.958};
  });
  const tq = new THREE.Quaternion();
  const foldPanels = (fold) => {
    for (const s of sides) {
      const ang = (1 - fold) * Math.PI * s.reach * s.sign;
      tq.setFromAxisAngle(hingeDir, ang);
      s.m.position.copy(s.p0).sub(s.pivot).applyQuaternion(tq).add(s.pivot);
      s.m.quaternion.copy(tq).multiply(s.q0);
    }
  };

  // a placa XPTO nos dois lados da caixa do reboque
  {
    const body = model.getObjectByName('Cube051');
    root.updateMatrixWorld(true);
    const wb = new THREE.Box3().setFromObject(body);
    const tex = new THREE.CanvasTexture(trailerPlate());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({map: tex, roughness: 0.4, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2});
    for (const s of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.32), mat);
      p.position.set((wb.min.x + wb.max.x) / 2 - 0.25, wb.min.y + (wb.max.y - wb.min.y) * 0.62, s > 0 ? wb.max.z + 0.004 : wb.min.z - 0.004);
      p.rotation.y = s > 0 ? 0 : Math.PI;
      root.add(p);
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
  const badgeTex = new THREE.CanvasTexture(camBadge());
  badgeTex.colorSpace = THREE.SRGBColorSpace;
  const badgeMat = new THREE.MeshStandardMaterial({map: badgeTex, roughness: 0.5});
  const mesh = (geo, mat, f) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    f?.(m);
    return m;
  };
  // o colar no topo do mastro e a cruzeta
  head.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 24), steel, (m) => (m.position.y = -0.02)));
  head.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 20), steel, (m) => (m.position.y = -0.5)));
  head.add(mesh(new THREE.BoxGeometry(0.62, 0.04, 0.05), steel, (m) => (m.position.y = 0.06)));
  head.add(mesh(new THREE.BoxGeometry(0.05, 0.04, 0.62), steel, (m) => (m.position.y = 0.06)));

  // Bullet: corpo branco arredondado, viseira, vidro escuro, suporte
  const bulletGeo = new RoundedBoxGeometry(0.3, 0.1, 0.11, 3, 0.04);
  const hoodGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.36, 24, 1, true, -Math.PI / 2.6, (Math.PI * 2) / 2.6);
  const makeBullet = () => {
    const g = new THREE.Group();
    g.add(mesh(bulletGeo, white));
    g.add(mesh(hoodGeo, white, (m) => {
      m.rotation.z = Math.PI / 2;
      m.position.set(0.03, 0.005, 0);
      m.material = white.clone();
      m.material.side = THREE.DoubleSide;
    }));
    g.add(mesh(new THREE.CircleGeometry(0.042, 24), glass, (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.x = 0.151;
    }));
    g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 12), white, (m) => m.position.set(-0.05, -0.08, 0)));
    g.add(mesh(new THREE.PlaneGeometry(0.11, 0.034), badgeMat, (m) => m.position.set(0, 0, 0.0556)));
    return g;
  };
  parts.bullets = [0, 90, 180, 270].map((yaw) => {
    const arm = new THREE.Group();
    arm.rotation.y = yaw * D2R;
    const b = makeBullet();
    b.position.set(0.3, SPEC.bullet.dy + 0.04, 0);
    b.rotation.z = -14 * D2R;
    arm.add(b);
    head.add(arm);
    return {arm, cam: b};
  });

  // a caixa de equipamentos (NVR, roteador 4G, controlador) e as antenas
  const box = new THREE.Group();
  box.add(mesh(new RoundedBoxGeometry(0.3, 0.42, 0.2, 2, 0.02), black));
  box.add(mesh(new THREE.PlaneGeometry(0.2, 0.062), badgeMat, (m) => {
    m.position.set(0, 0.12, -0.1011);
    m.rotation.y = Math.PI;
  }));
  for (const x of [-0.09, 0.09]) box.add(mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.32, 10), black, (m) => m.position.set(x, 0.37, -0.03)));
  box.add(mesh(new THREE.BoxGeometry(0.05, 0.03, 0.01), new THREE.MeshBasicMaterial({color: '#28d17c'}), (m) => m.position.set(0.1, -0.16, -0.101)));
  box.position.set(0, -0.36, -0.17);
  head.add(box);
  parts.box = box;

  // PTZ: braço até a frente (lado da rua), carcaça branca, bolha fumê, a câmera dentro gira em pan e tilt
  const ptz = new THREE.Group();
  ptz.position.set(0, SPEC.ptz.dy, SPEC.ptz.arm);
  head.add(mesh(new THREE.BoxGeometry(0.05, 0.05, SPEC.ptz.arm), white, (m) => m.position.set(0, SPEC.ptz.dy + 0.2, SPEC.ptz.arm / 2)));
  ptz.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 12), white, (m) => (m.position.y = 0.15)));
  const housing = new THREE.Group();
  ptz.add(housing);
  housing.add(mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.16, 32), white, (m) => (m.position.y = 0.02)));
  housing.add(mesh(new THREE.TorusGeometry(0.125, 0.012, 8, 32), grey, (m) => {
    m.rotation.x = Math.PI / 2;
    m.position.y = -0.06;
  }));
  housing.add(mesh(new THREE.PlaneGeometry(0.13, 0.04), badgeMat, (m) => m.position.set(0, 0.04, 0.1255)));
  const bubbleMat = new THREE.MeshPhysicalMaterial({color: '#2a3140', roughness: 0.05, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.55, depthWrite: false});
  const bubble = mesh(new THREE.SphereGeometry(0.112, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bubbleMat, (m) => (m.position.y = -0.06));
  bubble.castShadow = false;
  bubble.renderOrder = 3;
  ptz.add(bubble);
  const tiltG = new THREE.Group();
  tiltG.position.y = -0.07;
  housing.add(tiltG);
  tiltG.add(mesh(new THREE.SphereGeometry(0.06, 20, 12), black));
  tiltG.add(mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.07, 20), black, (m) => {
    m.rotation.z = -Math.PI / 2;
    m.position.x = 0.06;
  }));
  tiltG.add(mesh(new THREE.CircleGeometry(0.026, 20), glass, (m) => {
    m.rotation.y = Math.PI / 2;
    m.position.x = 0.096;
  }));
  head.add(ptz);
  parts.ptz = {g: ptz, housing, tiltG};

  // LPR: carcaça cinza escura mais longa, lente e um anel de LEDs IR 850 nm
  const irMat = new THREE.MeshStandardMaterial({color: '#3a1010', emissive: '#ff3b3b', emissiveIntensity: 0.0, roughness: 0.3});
  const makeLpr = () => {
    const g = new THREE.Group();
    g.add(mesh(new RoundedBoxGeometry(0.36, 0.11, 0.13, 3, 0.025), grey));
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.012, 0.15), grey, (m) => m.position.set(0.03, 0.062, 0)));
    g.add(mesh(new THREE.BoxGeometry(0.008, 0.095, 0.115), glass, (m) => m.position.x = 0.181));
    g.add(mesh(new THREE.CircleGeometry(0.03, 24), new THREE.MeshStandardMaterial({color: '#05070a', roughness: 0.05, metalness: 0.8}), (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.set(0.186, 0, 0);
    }));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.add(mesh(new THREE.CircleGeometry(0.008, 10), irMat, (m) => {
        m.rotation.y = Math.PI / 2;
        m.position.set(0.186, Math.sin(a) * 0.043, Math.cos(a) * 0.043);
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
    arm.add(mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), grey, (m) => (m.position.y = 0.11)));
    head.add(arm);
    return {arm, cam, yaw, pitch};
  });
  head.add(mesh(new THREE.BoxGeometry(0.4, 0.04, 0.05), steel, (m) => (m.position.y = SPEC.lpr.dy + 0.17)));

  // ------------------------------------------------------------ os carros
  const plates = [];
  const cars = CARS.map((c) => {
    const g = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({color: c.color, roughness: 0.32, metalness: 0.55, clearcoat: 0.6, envMapIntensity: 0.7});
    const side = new THREE.Shape();
    const P = [[-2.2, 0.28], [2.1, 0.28], [2.24, 0.42], [2.22, 0.7], [1.95, 0.84], [0.95, 0.94], [-1.75, 0.98], [-2.18, 0.9], [-2.24, 0.55]];
    side.moveTo(...P[0]);
    for (const p of P.slice(1)) side.lineTo(...p);
    const body = new THREE.ExtrudeGeometry(side, {depth: 1.62, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3});
    body.translate(0, 0, -0.81);
    g.add(mesh(body, paint));
    const cab = new THREE.Shape();
    const Q = [[1.02, 0.92], [0.18, 1.4], [-1.0, 1.42], [-1.72, 0.97]];
    cab.moveTo(...Q[0]);
    for (const p of Q.slice(1)) cab.lineTo(...p);
    const cabin = new THREE.ExtrudeGeometry(cab, {depth: 1.42, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2});
    cabin.translate(0, 0, -0.71);
    g.add(mesh(cabin, glass));
    g.add(mesh(new THREE.BoxGeometry(1.0, 0.04, 1.36), paint, (m) => m.position.set(-0.38, 1.42, 0)));
    const tire = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 24);
    tire.rotateX(Math.PI / 2);
    const wheels = [];
    for (const x of [1.38, -1.32])
      for (const z of [0.78, -0.78]) {
        const w = new THREE.Group();
        w.position.set(x, 0.32, z);
        w.add(mesh(tire, black));
        w.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.23, 8).rotateX(Math.PI / 2), steel));
        g.add(w);
        wheels.push(w);
      }
    const lamp = new THREE.MeshStandardMaterial({color: '#fff6dc', emissive: '#fff1c8', emissiveIntensity: 0.5});
    const tail = new THREE.MeshStandardMaterial({color: '#a3151b', emissive: '#d81d22', emissiveIntensity: 0.4});
    for (const z of [0.58, -0.58]) {
      g.add(mesh(new THREE.BoxGeometry(0.06, 0.1, 0.32), lamp, (m) => m.position.set(2.22, 0.66, z)));
      g.add(mesh(new THREE.BoxGeometry(0.06, 0.1, 0.3), tail, (m) => m.position.set(-2.23, 0.78, z)));
    }
    const tex = new THREE.CanvasTexture(mercosulPlate(c.plate));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const pm = new THREE.MeshStandardMaterial({map: tex, roughness: 0.35});
    for (const s of [1, -1]) {
      const pl = mesh(new THREE.PlaneGeometry(SPEC.plateW, SPEC.plateH), pm, (m) => {
        m.position.set(s * 2.3, 0.45, 0);
        m.rotation.y = (s * Math.PI) / 2;
      });
      g.add(pl);
      plates.push(pl);
    }
    g.visible = false;
    root.add(g);
    return {g, wheels};
  });

  // ------------------------------------------------------------ coberturas: leques das Bullets, zonas de leitura das LPRs
  const coverMat = (col, a) => new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: a, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6});
  const cover = new THREE.Group();
  cover.userData.cover = true;
  root.add(cover);
  const fanMats = [];
  for (const yaw of [0, 90, 180, 270]) {
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
    head.position.set(0, s.h, 0);
    foldPanels(s.fold);
    // explodida: cada câmera se afasta ao longo do próprio eixo
    for (const b of parts.bullets) b.cam.position.x = 0.3 + explode * 0.45;
    parts.box.position.z = -0.17 - explode * 0.4;
    parts.ptz.g.position.set(0, SPEC.ptz.dy - explode * 0.25, SPEC.ptz.arm + explode * 0.35);
    for (const [k, l] of parts.lpr.entries()) l.arm.position.set((k === 0 ? -0.18 : 0.18) + (k === 0 ? -1 : 1) * explode * 0.45, SPEC.lpr.dy - explode * 0.3, 0.05);
    // PTZ: pan em torno do eixo vertical (0° = +z, a rua), tilt para baixo
    parts.ptz.housing.rotation.y = (s.ptz.pan - 90) * D2R;
    parts.ptz.tiltG.rotation.z = -s.ptz.tilt * D2R;
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
    bullet2: () => parts.bullets[1].cam.getWorldPosition(new V3()),
    lpr0: () => parts.lpr[0].cam.getWorldPosition(new V3()),
    lpr1: () => parts.lpr[1].cam.getWorldPosition(new V3()),
    box: () => parts.box.getWorldPosition(new V3()),
    antenna: () => parts.box.localToWorld(new V3(0.09, 0.5, -0.03)),
    mast: () => new V3(0, head.position.y - 1.4, 0),
    panel: () => center.getWorldPosition(new V3()),
    battery: () => new V3(-1.9, 0.9, 0.2),
  };
  return {root, head, parts, update, anchors, cars, zones, ptzWorld, model, trailer, sides};
}
