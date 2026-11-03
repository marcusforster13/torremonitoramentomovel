// O estúdio: claro e frio, uma calçada e uma rua de duas faixas desenhadas num shader, sombras suaves, GTAO fora do
// chão. frame(state, cam, opt) posa a torre e desenha um quadro; depois desenha por cima, direto no canvas, as imagens
// ao vivo da PTZ e da LPR nos retângulos que o console reserva para elas.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {LPR_HFOV, PERSON, SPEC} from './kin.js';
import {buildRig} from './rig.js';

const V3 = THREE.Vector3;
const D2R = Math.PI / 180;
export const COL = {bg: '#e9eef2', walk: '#e2e7ec', road: '#c9d0d8', mark: '#f7f9fb', curb: '#b9c2cc', shadow: '#33415a'};
const NIGHT = {bg: '#c4cbd8', walk: '#a7b0bf', road: '#7c8698', mark: '#c9cfd9', curb: '#8e98a9'};

const GROUND_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = /* glsl */ `uniform vec3 uWalk; uniform vec3 uRoad; uniform vec3 uMark; uniform vec3 uCurb; uniform vec3 uBg; uniform vec3 uC; uniform float uFar; varying vec3 vW;
  void main(){
    float z = vW.z;
    float x = vW.x;
    // a rua entre z = 4 e z = 11, guias de 0,15 m, a calçada fora
    float road = step(4.0, z) * (1.0 - step(11.0, z));
    float curb = (step(3.85, z) * (1.0 - step(4.0, z))) + (step(11.0, z) * (1.0 - step(11.15, z)));
    vec3 col = mix(uWalk, uRoad, road);
    col = mix(col, uCurb, curb);
    // a calçada em placas de 1 m
    vec2 t = abs(fract(vec2(x, z)) - 0.5);
    float joint = (1.0 - road) * (1.0 - curb) * (1.0 - step(max(t.x, t.y), 0.485));
    col = mix(col, uCurb, joint * 0.35);
    // linha central tracejada (3 m pintados, 3 m não) e as bordas contínuas
    float dash = step(abs(z - 7.5), 0.07) * step(mod(x, 6.0), 3.0);
    float edge = step(abs(z - 4.3), 0.06) + step(abs(z - 10.7), 0.06);
    col = mix(col, uMark, clamp(dash + edge, 0.0, 1.0) * 0.9);
    float n = fract(sin(dot(floor(vW.xz * 30.0), vec2(12.9898, 78.233))) * 43758.5453);
    col *= 0.988 + 0.024 * n;
    float d = length(vW.xz - uC.xz);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(uFar * 0.45, uFar, d)), 1.0);
  }`;

export async function createXptoStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 30, 80);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 200);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.75;
  gtao.updateGtaoMaterial({radius: 0.25, distanceExponent: 1.4, thickness: 1.0, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const groundVis = (v) => () => {
    ground.visible = v;
    shade.visible = v;
    // as coberturas transparentes ficam fora do GTAO: escondidas antes, devolvidas depois
    for (const c of rig.root.children) {
      if (!c.userData.cover) continue;
      if (!v) {
        c.userData.on = c.visible;
        c.visible = false;
      } else c.visible = c.userData.on;
    }
  };
  composer.addPass(new Toggle(groundVis(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(groundVis(true)));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#e3e9ef');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.97, 0.98, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(14, 14, new V3(0, 14, 2), 2.4);
    box(3, 14, new V3(-12, 4, 6), 3.0);
    box(3, 14, new V3(12, 4, -4), 2.0);
    box(18, 2, new V3(0, 2, 14), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#b9c3cf', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.9;
    pm.dispose();
  }
  const SUN_DIR = new V3(-0.45, 0.8, 0.4).normalize();
  const sun = new THREE.DirectionalLight('#fff8ee', 2.4);
  sun.castShadow = true;
  const EXT = 9;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 1, far: 50});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 8;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.position.copy(SUN_DIR).multiplyScalar(25);
  sun.target.position.set(0, 0, 2);
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#f6f9ff', '#b8c2cf', 0.7);
  scene.add(hemi);

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {
      uWalk: {value: new THREE.Color(COL.walk)},
      uRoad: {value: new THREE.Color(COL.road)},
      uMark: {value: new THREE.Color(COL.mark)},
      uCurb: {value: new THREE.Color(COL.curb)},
      uBg: {value: new THREE.Color(COL.bg)},
      uC: {value: new V3()},
      uFar: {value: 40},
    },
    toneMapped: false,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.32, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const rig = await buildRig(renderer);
  scene.add(rig.root);

  // as câmeras virtuais das imagens ao vivo
  const ptzCam = new THREE.PerspectiveCamera(SPEC.ptz.hfovWide, 16 / 9, 0.1, 120);
  const lprCam = new THREE.PerspectiveCamera(20, 16 / 9, 0.1, 120);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const cA = new THREE.Color();
  const cB = new THREE.Color();
  const mixCol = (key, k) => cA.set(COL[key]).lerp(cB.set(NIGHT[key]), k);
  const hiddenInFeeds = [];
  const v = new V3();
  const vfov = (hfov, aspect) => (2 * Math.atan(Math.tan((hfov / 2) * D2R) / aspect)) / D2R;

  // st: o estado de kin.stateAt; cam: {tx, ty, tz, az, el, d, sx, sy}; opt: {explode, cover, night, feeds: {ptz, lpr}}
  const frame = (st, cam, opt = {}) => {
    const night = opt.night ?? 0;
    rig.update(st, opt);
    scene.background.copy(mixCol('bg', night));
    scene.fog.color.copy(scene.background);
    groundMat.uniforms.uBg.value.copy(scene.background);
    for (const k of ['walk', 'road', 'mark', 'curb']) groundMat.uniforms['u' + k[0].toUpperCase() + k.slice(1)].value.copy(mixCol(k, night));
    sun.intensity = 2.4 * (1 - night * 0.7);
    hemi.intensity = 0.7 * (1 - night * 0.55);
    scene.environmentIntensity = 0.9 * (1 - night * 0.6);
    const ty = cam.ty + (cam.head ? st.h : 0);
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    groundMat.uniforms.uC.value.set(cam.tx, 0, cam.tz);
    groundMat.uniforms.uFar.value = Math.max(26, cam.d * 2.2);
    scene.fog.near = cam.d * 1.4 + 10;
    scene.fog.far = cam.d * 3 + 50;
    composer.render();
    const out = {};
    // as imagens ao vivo, por cima do quadro, nos retângulos do console
    const feeds = opt.feeds;
    if (feeds && st.power > 0.02) {
      rig.root.updateMatrixWorld(true);
      groundMat.uniforms.uC.value.set(0, 0, 6);
      groundMat.uniforms.uFar.value = 70;
      const covVis = rig.root.children.filter((c) => c.visible && c.userData.cover);
      for (const c of covVis) c.visible = false;
      // direto no canvas: o compositor pode terminar com outro alvo ligado
      renderer.setRenderTarget(null);
      renderer.setScissorTest(true);
      const draw = (c, r) => {
        renderer.setScissor(r.x, size.h - r.y - r.h, r.w, r.h);
        renderer.setViewport(r.x, size.h - r.y - r.h, r.w, r.h);
        renderer.render(scene, c);
      };
      if (feeds.ptz) {
        const p = rig.ptzWorld;
        const pr = st.ptz.pan * D2R;
        const tr = st.ptz.tilt * D2R;
        ptzCam.position.copy(p).add(v.set(Math.sin(pr), 0, Math.cos(pr)).multiplyScalar(0.12));
        ptzCam.lookAt(p.x + Math.sin(pr) * Math.cos(tr) * 10, p.y - Math.sin(tr) * 10, p.z + Math.cos(pr) * Math.cos(tr) * 10);
        const r = feeds.ptz;
        ptzCam.aspect = r.w / r.h;
        ptzCam.fov = vfov((2 * Math.atan(Math.tan((SPEC.ptz.hfovWide / 2) * D2R) / st.ptz.zoom)) / D2R, ptzCam.aspect);
        ptzCam.updateProjectionMatrix();
        draw(ptzCam, r);
        // a moldura do rosto na imagem da PTZ
        if (st.ptz.person && st.person) {
          const c0 = v.set(st.person.x, PERSON.head, st.person.z).project(ptzCam);
          const cx = r.x + (c0.x * 0.5 + 0.5) * r.w;
          const cy = r.y + (-c0.y * 0.5 + 0.5) * r.h;
          const c1 = v.set(st.person.x, PERSON.head + 0.13, st.person.z).project(ptzCam);
          const half = Math.abs(r.y + (-c1.y * 0.5 + 0.5) * r.h - cy);
          out.faceBox = [cx - half * 0.8, cy - half, half * 1.6, half * 2.1];
        }
      }
      if (feeds.lpr) {
        const k = feeds.lprK ?? 0;
        const c = rig.parts.lpr[k].cam;
        c.getWorldPosition(lprCam.position);
        const fwd = v.set(1, 0, 0).applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion()));
        lprCam.lookAt(lprCam.position.clone().add(fwd));
        lprCam.position.addScaledVector(fwd, 0.2);
        const r = feeds.lpr;
        lprCam.aspect = r.w / r.h;
        lprCam.fov = vfov(LPR_HFOV[k], lprCam.aspect);
        lprCam.updateProjectionMatrix();
        draw(lprCam, r);
        // a caixa da placa na imagem da LPR: os 4 cantos projetados pela câmera da LPR
        const look = st.lpr[k];
        if (look && look.inView) {
          let x0 = 1e9;
          let y0 = 1e9;
          let x1 = -1e9;
          let y1 = -1e9;
          for (const [dy, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            v.set(look.plateX, 0.45 + dy * SPEC.plateH * 0.5, SPEC.lane[k] + dz * SPEC.plateW * 0.5).project(lprCam);
            const px = r.x + (v.x * 0.5 + 0.5) * r.w;
            const py = r.y + (-v.y * 0.5 + 0.5) * r.h;
            x0 = Math.min(x0, px);
            x1 = Math.max(x1, px);
            y0 = Math.min(y0, py);
            y1 = Math.max(y1, py);
          }
          out.plateBox = [x0, y0, x1 - x0, y1 - y0];
        }
      }
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, size.w, size.h);
      for (const c of covVis) c.visible = true;
    }
    void hiddenInFeeds;
    return out;
  };
  const pv = new V3();
  const project = (p) => {
    pv.copy(p).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow}) => {
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  return {renderer, scene, camera, rig, composer, gtao, sun, resize, frame, project, size, setQuality};
}
