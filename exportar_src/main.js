// Exporta as peças da cena na posição em que aparecem (metros, y para cima, mastro na origem, rua ao longo de x).
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {clone as skClone} from 'three/addons/utils/SkeletonUtils.js';
import {runSim} from 'teardown-kit/runtime.js';
import {stateAt} from '../src/kin.js';
import {createXptoStage} from '../src/stage.js';

runSim({duration: 1, hud: {enabled: false}, director: {enabled: false}}, async ({canvas}) => {
  const st = await createXptoStage({canvas});
  const rig = st.rig;
  // implantada, mastro em cima, painéis abertos; carros e pedestre num instante em que todos estão perto da torre
  const s = stateAt('patrol', 9.5);
  s.cars = [{x: -9, z: 5.75, dir: 1, s: 0, i: 0}, {x: 9, z: 9.25, dir: -1, s: 0, i: 1}];
  s.person = {x: 5, z: 3.15, s: 0.4};
  s.alert = null;
  rig.update(s, {cover: 0});
  rig.root.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  const toB64 = (buf) => {
    let bin = '';
    const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const one = async (name, objs, animations = []) => {
    const scene = new THREE.Scene();
    for (const o of objs) {
      const c = skClone(o);
      o.updateMatrixWorld(true);
      o.matrixWorld.decompose(c.position, c.quaternion, c.scale);
      scene.add(c);
    }
    const buf = await exporter.parseAsync(scene, {binary: true, onlyVisible: true, animations});
    return [name, toB64(buf)];
  };
  const ped = rig.ped.g;
  const carGs = rig.cars.map((c) => c.g);
  const trailerParts = [rig.trailer, ...rig.root.children.filter((c) => c.userData.trailer || (c.isMesh && c.material?.map && c.geometry.type === 'PlaneGeometry'))];
  window.OUT = await Promise.all([
    one('reboque_xpto.glb', trailerParts),
    one('cabeca_cameras.glb', [rig.head]),
    one('carro_sedan.glb', [carGs[0]]),
    one('carro_suv.glb', [carGs[1]]),
    one('pedestre.glb', [ped], [rig.ped.clip]),
    one('cena_completa.glb', [...trailerParts, rig.head, ...carGs, ped], [rig.ped.clip]),
  ]);
  return {render() {
    return {};
  }};
});
