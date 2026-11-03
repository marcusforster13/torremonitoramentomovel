// Rewrites carro2.glb with smaller textures (jpg via ffmpeg) -> reboque.glb. The unused photo texture stays out.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const [src, dst] = process.argv.slice(2);
const b = fs.readFileSync(src);
const n = b.readUInt32LE(12);
const j = JSON.parse(b.slice(20, 20 + n));
const binStart = 20 + n + 8;
const bin = b.slice(binStart, binStart + b.readUInt32LE(20 + n));
const SIZE = {0: 8, 1: 512, 2: 512, 3: 512, 4: 8};
const tmp = 'tools/tmp';
fs.mkdirSync(tmp, {recursive: true});
const imgData = j.images.map((im, i) => {
  const bv = j.bufferViews[im.bufferView];
  const f = `${tmp}/i${i}.${im.mimeType.endsWith('png') ? 'png' : 'jpg'}`;
  fs.writeFileSync(f, bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `scale=${SIZE[i]}:${SIZE[i]}`, '-q:v', '4', `${tmp}/o${i}.jpg`]);
  im.mimeType = 'image/jpeg';
  return fs.readFileSync(`${tmp}/o${i}.jpg`);
});
const imgViews = new Set(j.images.map((im) => im.bufferView));
const parts = [];
let off = 0;
const pushBuf = (buf) => {
  const o = off;
  parts.push(buf);
  off += buf.length;
  const padN = (4 - (off % 4)) % 4;
  if (padN) {
    parts.push(Buffer.alloc(padN));
    off += padN;
  }
  return o;
};
j.bufferViews.forEach((bv, i) => {
  if (imgViews.has(i)) return;
  const data = bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  bv.byteOffset = pushBuf(data);
});
j.images.forEach((im, i) => {
  const bv = j.bufferViews[im.bufferView];
  bv.byteOffset = pushBuf(imgData[i]);
  bv.byteLength = imgData[i].length;
});
const newBin = Buffer.concat(parts);
j.buffers[0].byteLength = newBin.length;
let js = Buffer.from(JSON.stringify(j));
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(12 + 8 + js.length + 8 + newBin.length, 8);
const ch = (len, type) => {
  const c = Buffer.alloc(8);
  c.writeUInt32LE(len, 0);
  c.writeUInt32LE(type, 4);
  return c;
};
fs.writeFileSync(dst, Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(newBin.length, 0x004e4942), newBin]));
console.log(dst, (fs.statSync(dst).size / 1e6).toFixed(2), 'MB');
