// Batch test: runs the app's face AI, measurements, depth AI and 3D twin on a list of photos.
// Open tests/batch.html?faces=tests/faces/a.jpg,... (paths from the app folder) and read window.results.
import * as V from "../vision.js";
import * as D from "../depth3d.js";
import { mountRelief } from "../twin3d.js";

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
function measures(lm, W, H) { // same as app.js
  const p = (i) => [lm[i][0] * W, lm[i][1] * H, (lm[i][2] || 0) * W];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const mid = d(p(9), p(2)), low = d(p(2), p(152)), faceW = d(p(234), p(454));
  const eyeW = (d(p(33), p(133)) + d(p(362), p(263))) / 2, gap = d(p(133), p(362));
  const pairs = [[33, 263], [133, 362], [61, 291], [234, 454], [172, 397], [105, 334], [50, 280], [58, 288]];
  const ref = [p(1), p(9), p(152)];
  let asym = 0;
  for (const [l, r] of pairs) for (const c of ref) asym += Math.abs(d(p(l), c) - d(p(r), c));
  asym /= pairs.length * ref.length * faceW;
  return { thirds: +(low / mid).toFixed(2), spacing: +(gap / eyeW).toFixed(2), symmetry: Math.max(75, Math.min(99, Math.round(100 - asym * 180))) };
}
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
function overlay(img, lm) {
  const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0); x.fillStyle = "rgba(14,14,20,.3)"; x.fillRect(0, 0, W, H);
  const p = (i) => [lm[i][0] * W, lm[i][1] * H], lw = Math.max(1.5, W / 320);
  x.strokeStyle = "rgba(185,164,255,.95)"; x.lineWidth = lw; x.setLineDash([lw * 4, lw * 3]);
  x.beginPath(); OVAL.forEach((i, k) => { const [a, b] = p(i); k ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); x.stroke(); x.setLineDash([]);
  for (const i of [9, 2, 152]) { const [, y] = p(i); x.strokeStyle = "rgba(245,243,247,.8)"; x.beginPath(); x.moveTo(p(234)[0] - W * 0.04, y); x.lineTo(p(454)[0] + W * 0.04, y); x.stroke(); }
  x.fillStyle = "#7C4DFF"; for (let i = 0; i < lm.length; i++) { const [a, b] = p(i); x.beginPath(); x.arc(a, b, lw * 0.9, 0, 7); x.fill(); }
  return c.toDataURL("image/jpeg", 0.85);
}
async function run() {
  const faces = new URLSearchParams(location.search).get("faces").split(",");
  await V.loadFace(); await V.loadCoach(); await D.loadDepth();
  const out = [];
  for (const f of faces) {
    const r = { file: f };
    try {
      const img = await loadImg(f);
      let t = performance.now(); const lm = V.detect(img); r.msLandmarks = Math.round(performance.now() - t);
      if (!lm) { r.error = "no face found"; out.push(r); continue; }
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0);
      const a = V.analyze(c, lm);
      r.shape = a.shape; r.skin = a.score; r.skinNote = a.notes[0];
      Object.assign(r, measures(lm, img.naturalWidth, img.naturalHeight));
      r.yaw = +((lm[1][0] - lm[234][0]) / (lm[454][0] - lm[234][0]) - 0.5).toFixed(3);
      const tf = V.trackFace(img, performance.now());
      r.bs = tf ? Object.fromEntries(["jawOpen", "mouthSmileLeft", "mouthSmileRight", "mouthPucker", "cheekPuff", "browInnerUp"].map((k) => [k, +(tf.bs[k] || 0).toFixed(3)])) : null;
      r.overlay = overlay(img, lm);
      t = performance.now(); const dep = await D.estimateDepth(img); r.msDepth = Math.round(performance.now() - t);
      const host = document.getElementById("host"); host.innerHTML = "";
      t = performance.now(); const tw = mountRelief(host, c, dep, lm, { autoTurn: false }); r.msMesh = Math.round(performance.now() - t);
      r.views = [];
      for (const y of [-0.45, 0, 0.45]) { tw.setView(y, 0.04); r.views.push(host.querySelector("canvas").toDataURL("image/png")); }
      tw.dispose();
    } catch (e) { r.error = String(e.message || e); }
    out.push(r);
    window.progress = out.length;
  }
  window.results = out;
}
run().catch((e) => { window.results = [{ error: String(e) }]; });
