// Exports a built 180° head as compact arrays (for the interactive demo page).
import * as V from "../vision.js";
import * as D from "../depth3d.js";
import { buildHead } from "../head3d.js";
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const toCanvas = (img, w) => { const s = Math.min(1, (w || 1e9) / img.naturalWidth), c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c; };
const b64 = (ta) => { const u = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength); let s = ""; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
async function run() {
  const set = new URLSearchParams(location.search).get("set");
  await V.loadFace(); await D.loadDepth();
  const views = [], photos = [];
  for (const n of ["0", "35", "-35"]) {
    const img = await loadImg(`${set}_${n}.jpg`), lm = V.detect(img);
    photos.push(toCanvas(img, 560).toDataURL("image/jpeg", 0.82));
    if (lm) views.push({ photo: toCanvas(img), lm, dep: await D.estimateDepth(img), name: n });
  }
  const B = buildHead(views, { NT: 140, NH: 160 }), { NT, NH, pos, uvs, wts, alpha } = B, s3 = 2.6 / B.fw;
  const keep = new Int32Array(NT * NH).fill(-1), idx = [], order = [];
  for (let h = 0; h < NH - 1; h++) for (let t = 0; t < NT - 1; t++) {
    const a = h * NT + t, b = a + 1, c = a + NT, d = c + 1;
    for (const tri of [[a, c, b], [b, c, d]]) {
      if (Math.min(...tri.map((i) => alpha[i])) < 0.01) continue;
      const rr = tri.map((i) => Math.hypot(pos[i * 3], pos[i * 3 + 2])); if (Math.max(...rr) - Math.min(...rr) > B.fw * 0.18) continue;
      for (const i of tri) { if (keep[i] < 0) { keep[i] = order.length; order.push(i); } idx.push(keep[i]); }
    }
  }
  const n = order.length, P = new Float32Array(n * 3);
  order.forEach((i, k) => { P[k * 3] = pos[i * 3] * s3; P[k * 3 + 1] = -pos[i * 3 + 1] * s3; P[k * 3 + 2] = pos[i * 3 + 2] * s3; });
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let k = 0; k < n; k++) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], P[k * 3 + j]); mx[j] = Math.max(mx[j], P[k * 3 + j]); }
  const Q = new Uint16Array(n * 3); for (let k = 0; k < n * 3; k++) { const j = k % 3; Q[k] = Math.round((P[k] - mn[j]) / (mx[j] - mn[j]) * 65535); }
  const UV = [0, 1, 2].map((v) => { const a = new Uint16Array(n * 2), src = uvs[v] || uvs[0]; order.forEach((i, k) => { a[k * 2] = Math.round(Math.min(1, Math.max(0, src[i * 2])) * 65535); a[k * 2 + 1] = Math.round(Math.min(1, Math.max(0, src[i * 2 + 1])) * 65535); }); return b64(a); });
  const Wq = new Uint8Array(n * 4); order.forEach((i, k) => { for (let j = 0; j < 3; j++) Wq[k * 4 + j] = Math.round(wts[i * 3 + j] * 255); Wq[k * 4 + 3] = Math.round(alpha[i] * 255); });
  // which photo each texture slot uses (a mirrored side reuses its photo)
  const slot = B.views.map((v) => ["0", "35", "-35"].indexOf(v.name));
  window.results = { n, tris: idx.length / 3, mn, mx, pos: b64(Q), idx: b64(new Uint16Array(idx)), uv: UV, w: b64(Wq), gains: B.gains, slot, photos, info: B.info, h0: -B.h1 * s3, h1: -B.h0 * s3 };
}
run().catch((e) => { console.error(e); window.results = { error: String(e.stack || e) }; });
