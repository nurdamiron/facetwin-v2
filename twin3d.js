// The 3D twin: a face mesh built from the 478 3D points the face AI finds in the front selfie,
// wrapped in the photo (with the try-on looks drawn on it). Runs on the phone with WebGL.
import * as THREE from "./vendor/three/three.module.js";
import { FaceLandmarker } from "./vendor/mediapipe/vision_bundle.mjs";

let TRIS = null; // triangle list, built once from the official tesselation edges
const HOLES = [ // eyes and mouth are open in the tesselation: close them so the face reads as one surface
  [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],
];
function triangles() {
  if (TRIS) return TRIS;
  const adj = new Map();
  const add = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
  for (const { start, end } of FaceLandmarker.FACE_LANDMARKS_TESSELATION) { add(start, end); add(end, start); }
  const seen = new Set(), out = [];
  for (const [a, ns] of adj) for (const b of ns) for (const c of ns) {
    if (b >= c || !adj.get(b)?.has(c)) continue;
    const k = [a, b, c].sort((x, y) => x - y).join(",");
    if (!seen.has(k)) { seen.add(k); out.push(a, b, c); }
  }
  for (const h of HOLES) for (let k = 1; k < h.length - 1; k++) out.push(h[0], h[k], h[k + 1]);
  return (TRIS = out);
}

export function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

// Mount an interactive 3D face into `host`. `texCanvas` = photo with looks; `lm` = [[x,y,z],...] normalized.
// Returns { update(texCanvas), dispose() }.
export function mountTwin3D(host, texCanvas, lm, { autoTurn = true } = {}) {
  const W = texCanvas.width, H = texCanvas.height;
  const w = host.clientWidth || 360, h = host.clientHeight || 480;
  const pos = new Float32Array(lm.length * 3), uv = new Float32Array(lm.length * 2);
  const nose = lm[1], faceW = Math.abs(lm[454][0] - lm[234][0]) * W, s = 2.6 / faceW;
  lm.forEach((p, i) => {
    pos[i * 3] = (p[0] - nose[0]) * W * s;
    pos[i * 3 + 1] = -(p[1] - nose[1]) * H * s;
    pos[i * 3 + 2] = -((p[2] || 0) - (nose[2] || 0)) * W * s;
    uv[i * 2] = p[0]; uv[i * 2 + 1] = p[1];
  });
  const idx = triangles().slice();
  for (let k = 0; k < idx.length; k += 3) { // wind every triangle towards the camera
    const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1];
    if (ux * vy - uy * vx < 0) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // centre the face on its own middle, not on the nose tip, so it turns in place
  geo.computeBoundingBox();
  const ctr = new THREE.Vector3(); geo.boundingBox.getCenter(ctr); geo.translate(-ctr.x, -ctr.y, 0);

  let tex = new THREE.CanvasTexture(texCanvas);
  tex.flipY = false; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -0.05;
  const scene = new THREE.Scene();
  scene.add(mesh, new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(1.5, 1.2, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9a4ff, 0.55); rim.position.set(-3, 1, -1); scene.add(rim);
  const size = geo.boundingBox.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
  const fit = Math.max(size.y, size.x * (h / w)) / 2 / Math.tan((30 * Math.PI) / 360);
  cam.position.set(0, 0.05, fit * 1.55 + 1.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.domElement.style.touchAction = "pan-y";
  renderer.domElement.setAttribute("aria-label", "Your 3D face. Drag left or right to turn it.");
  host.prepend(renderer.domElement);

  let yaw = 0, target = 0, dragging = false, lastX = 0, touched = !autoTurn, t0 = performance.now(), raf = 0, alive = true;
  const el = renderer.domElement;
  const down = (e) => { dragging = true; touched = true; lastX = e.clientX; el.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (!dragging) return; target = Math.max(-1.1, Math.min(1.1, target + (e.clientX - lastX) / 140)); lastX = e.clientX; };
  const up = () => { dragging = false; };
  el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  const loop = (t) => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (!touched) target = Math.sin((t - t0) / 1400) * 0.55; // gentle sway until she drags
    yaw += (target - yaw) * 0.12;
    mesh.rotation.y = yaw;
    renderer.render(scene, cam);
  };
  raf = requestAnimationFrame(loop);

  return {
    setYaw(rad) { touched = true; target = yaw = rad; mesh.rotation.y = rad; renderer.render(scene, cam); },
    update(canvas) { tex.dispose(); tex = new THREE.CanvasTexture(canvas); tex.flipY = false; tex.encoding = THREE.sRGBEncoding; mat.map = tex; mat.needsUpdate = true; },
    dispose() {
      alive = false; cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      geo.dispose(); mat.dispose(); tex.dispose(); renderer.dispose(); el.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// Realistic 3D twin: the whole photo (face, hair, ears, neck) lifted into 3D with the depth AI,
// scaled to true face proportions with the 478 face points. Looks like a real photo that turns.
import { sampleDepth } from "./depth3d.js";

export function mountRelief(host, photo, depIn, lm, { autoTurn = true, cols = 230 } = {}) {
  const W = photo.width, H = photo.height;
  const L = (i) => lm[i];
  const cx = (L(234)[0] + L(454)[0]) / 2, fw = Math.abs(L(454)[0] - L(234)[0]);
  const top = L(10)[1], chin = L(152)[1], fh = chin - top;
  // crop: head, hair and a little neck/shoulders (normalized image coords)
  const x0 = Math.max(0, cx - fw * 1.25), x1 = Math.min(1, cx + fw * 1.25);
  const y0 = Math.max(0, top - fh * 0.75), y1 = Math.min(1, chin + fh * 0.7);
  const pxW = (x1 - x0) * W, pxH = (y1 - y0) * H;
  const rows = Math.round(cols * pxH / pxW);
  const ring = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

  // smooth the depth outside the face so turning stretches hair/neck gently instead of tearing holes
  const dep = smoothOutsideFace(depIn, lm, ring);
  const dAt = (i) => sampleDepth(dep, L(i)[0], L(i)[1]);
  const dNose = dAt(1), ringD = ring.map(dAt), dRing = ringD.reduce((a, b) => a + b, 0) / ringD.length, dRingMin = Math.min(...ringD);
  // true relief from the face points: nose tip vs. face outline, in pixels (clamped to human proportions)
  const lmRel = Math.abs(ring.reduce((a, i) => a + (L(i)[2] || 0), 0) / ring.length - (L(1)[2] || 0)) * W;
  const relPix = Math.min(fw * W * 0.42, Math.max(fw * W * 0.22, lmRel || 0));
  const k = relPix / Math.max(0.03, dNose - dRing);
  const q = [...ringD].sort((p, r) => p - r)[Math.floor(ringD.length * 0.25)]; // robust: ignore outline points that fall on the background
  const cut = q - Math.max(0.06, (dNose - q) * 1.1);
  const s = 2.6 / (fw * W);
  const ccx = cx * W, ccy = ((top + chin) / 2) * H;
  console.info("[facetwin] relief", { dNose: +dNose.toFixed(3), dRing: +dRing.toFixed(3), cut: +cut.toFixed(3), relPix: Math.round(relPix), lmRel: Math.round(lmRel) });
  const n = (cols + 1) * (rows + 1);
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 4);
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    const i = r * (cols + 1) + c, u = x0 + (x1 - x0) * c / cols, v = y0 + (y1 - y0) * r / rows;
    const d = sampleDepth(dep, u, v);
    const zPix = Math.max(-relPix * 2.2, (d - dNose) * k);
    pos[i * 3] = (u * W - ccx) * s; pos[i * 3 + 1] = -(v * H - ccy) * s; pos[i * 3 + 2] = zPix * s;
    uv[i * 2] = u; uv[i * 2 + 1] = v;
    // soft cut-out: background fades away, and the bottom fades into the dark
    const a1 = Math.min(1, Math.max(0, (d - cut) / 0.04));
    const a2 = Math.min(1, Math.max(0, (y1 - v) / (fh * 0.4)));
    // head prior: an oval around head + hair, and a neck column below the chin
    const hx = (u - cx) / (fw * 1.0), hy = (v - (top + chin) / 2 + fh * 0.12) / (fh * 0.95);
    const head = 1 - Math.sqrt(hx * hx + hy * hy), neck = v > chin - fh * 0.1 ? 1 - Math.abs(u - cx) / (fw * 0.62) : -1;
    const a3 = Math.min(1, Math.max(0, Math.max(head, neck) / 0.12));
    col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = 1; col[i * 4 + 3] = a1 * a2 * a3;
  }
  const idx = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
    for (const [p, q, t] of [[a, d, b], [b, d, e]]) {
      const z1 = pos[p * 3 + 2], z2 = pos[q * 3 + 2], z3 = pos[t * 3 + 2];
      if (col[p * 4 + 3] + col[q * 4 + 3] + col[t * 4 + 3] < 0.05) continue;
      idx.push(p, q, t);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // pivot in the middle of the head, a bit behind the face
  geo.translate(0, 0, relPix * s * 1.2);

  const tex = new THREE.CanvasTexture(photo); tex.flipY = false; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: true, alphaTest: 0.02 });
  const mesh = new THREE.Mesh(geo, mat);
  const scene = new THREE.Scene();
  scene.add(mesh, new THREE.AmbientLight(0xffffff, 0.78));
  const key = new THREE.DirectionalLight(0xffffff, 0.32); key.position.set(0.4, 0.3, 1); scene.add(key);

  const w = host.clientWidth || 360, h = host.clientHeight || 480;
  const cam = new THREE.PerspectiveCamera(26, w / h, 0.1, 100);
  const viewH = pxH * s, viewW = pxW * s;
  const dist = Math.max(viewH, viewW * (h / w)) / 2 / Math.tan((26 * Math.PI) / 360) * 1.06;
  cam.position.set(0, -((y0 + y1) / 2 * H - ccy) * s, dist + relPix * s * 1.2);
  cam.lookAt(0, cam.position.y, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h);
  renderer.outputEncoding = THREE.sRGBEncoding;
  const el = renderer.domElement;
  el.style.touchAction = "pan-y";
  el.setAttribute("aria-label", "Your 3D twin. Drag to turn it.");
  host.prepend(el);

  let yaw = 0, pitch = 0, tYaw = 0, tPitch = 0, drag = false, lx = 0, ly = 0, touched = !autoTurn, t0 = performance.now(), raf = 0, alive = true;
  const down = (e) => { drag = true; touched = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (!drag) return; tYaw = Math.max(-0.5, Math.min(0.5, tYaw + (e.clientX - lx) / 180)); tPitch = Math.max(-0.25, Math.min(0.25, tPitch + (e.clientY - ly) / 300)); lx = e.clientX; ly = e.clientY; };
  const up = () => { drag = false; };
  el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  const loop = (t) => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (!touched) { tYaw = Math.sin((t - t0) / 1600) * 0.38; tPitch = Math.sin((t - t0) / 2300) * 0.06; }
    yaw += (tYaw - yaw) * 0.1; pitch += (tPitch - pitch) * 0.1;
    mesh.rotation.y = yaw; mesh.rotation.x = pitch;
    renderer.render(scene, cam);
  };
  raf = requestAnimationFrame(loop);
  return {
    setView(y, p = 0) { touched = true; tYaw = yaw = y; tPitch = pitch = p; mesh.rotation.set(p, y, 0); renderer.render(scene, cam); },
    dispose() {
      alive = false; cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      geo.dispose(); mat.dispose(); tex.dispose(); renderer.dispose(); el.remove();
    },
  };
}

// Blur the depth map, then put the sharp depth back inside the face outline.
function smoothOutsideFace(dep, lm, ring) {
  const { w, h, data } = dep, r = Math.max(2, Math.round(w * 0.018));
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { let acc = 0; const row = y * w;
    for (let x = -r; x < w; x++) { if (x + r < w) acc += data[row + x + r]; if (x - r - 1 >= 0) acc -= data[row + x - r - 1]; if (x >= 0) tmp[row + x] = acc / (Math.min(w - 1, x + r) - Math.max(0, x - r) + 1); } }
  for (let x = 0; x < w; x++) { let acc = 0;
    for (let y = -r; y < h; y++) { if (y + r < h) acc += tmp[(y + r) * w + x]; if (y - r - 1 >= 0) acc -= tmp[(y - r - 1) * w + x]; if (y >= 0) out[y * w + x] = acc / (Math.min(h - 1, y + r) - Math.max(0, y - r) + 1); } }
  // face mask (slightly shrunk outline), feathered
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  const cx = ring.reduce((a, i) => a + lm[i][0], 0) / ring.length, cy = ring.reduce((a, i) => a + lm[i][1], 0) / ring.length;
  x.filter = `blur(${r}px)`; x.fillStyle = "#fff"; x.beginPath();
  ring.forEach((i, k) => { const px = (cx + (lm[i][0] - cx) * 0.94) * w, py = (cy + (lm[i][1] - cy) * 0.94) * h; k ? x.lineTo(px, py) : x.moveTo(px, py); });
  x.closePath(); x.fill();
  const m = x.getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) { const a = m[i * 4 + 3] / 255; out[i] = data[i] * a + out[i] * (1 - a); }
  return { w, h, data: out };
}
