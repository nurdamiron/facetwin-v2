// 180° twin test: front + two side photos → fused head, rendered at fixed angles, next to the one-photo twin.
// Open tests/head.html?set=tests/heads/lee&sides=35,-35 and read window.results.
import * as V from "../vision.js";
import * as D from "../depth3d.js";
import { mountRelief } from "../twin3d.js";
import { buildHead, mountHead } from "../head3d.js";
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const toCanvas = (img) => { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0); return c; };
const ANG = [-90, -60, -35, 0, 35, 60, 90];
async function run() {
  const q = new URLSearchParams(location.search), set = q.get("set"), names = (q.get("files") || "0,35,-35").split(",");
  await V.loadFace(); await D.loadDepth();
  const views = [];
  for (const n of names) {
    const img = await loadImg(`${set}_${n}.jpg`), lm = V.detect(img);
    if (!lm) { views.push(null); continue; }
    views.push({ photo: toCanvas(img), lm, dep: await D.estimateDepth(img) });
  }
  const out = { found: views.map((v) => !!v) };
  const host = document.getElementById("host"), grab = () => host.querySelector("canvas").toDataURL("image/png");
  const t = performance.now(); const B = buildHead(views.filter(Boolean)); out.msBuild = Math.round(performance.now() - t); out.info = B.info; out.off = B.off;
  let tw = mountHead(host, null, { autoTurn: false, built: B });
  out.head = ANG.map((a) => { tw.setView(-a * Math.PI / 180, 0.03); return grab(); }); tw.dispose();
  tw = mountRelief(host, views[0].photo, views[0].dep, views[0].lm, { autoTurn: false });
  out.single = ANG.map((a) => { tw.setView(-a * Math.PI / 180, 0.03); return grab(); }); tw.dispose();
  window.results = out;
}
run().catch((e) => { console.error(e); window.results = { error: String(e.stack || e) }; });
