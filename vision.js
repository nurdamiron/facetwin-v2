// On-device face AI: landmarks, photo quality checks, face shape + skin guide, and 2D try-on.
// Everything runs in the browser. No photo is uploaded anywhere.
import { FilesetResolver, FaceLandmarker, ImageSegmenter } from "./vendor/mediapipe/vision_bundle.mjs";
import { CONFIG } from "./config.js";

let fileset = null, landmarker = null, hairSeg = null, hairTried = false;

async function getFileset() {
  if (!fileset) fileset = await FilesetResolver.forVisionTasks(new URL("./vendor/mediapipe/wasm", import.meta.url).href);
  return fileset;
}

export async function loadFace() {
  if (landmarker) return landmarker;
  const fs = await getFileset();
  for (const path of [CONFIG.FACE_MODEL_URL, CONFIG.FACE_MODEL_FALLBACK]) {
    for (const delegate of ["GPU", "CPU"]) {
      try {
        landmarker = await FaceLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: path, delegate }, runningMode: "IMAGE", numFaces: 2,
        });
        return landmarker;
      } catch (e) { console.warn("[facetwin] face model", path, delegate, e); }
    }
  }
  throw new Error("Face model could not load");
}

// Live tracker for the exercise coach: video mode + 52 facial muscle scores (blendshapes).
let coach = null, coachLoading = null, lastTs = 0;
export function loadCoach() {
  if (coach) return Promise.resolve(coach);
  if (coachLoading) return coachLoading;
  coachLoading = (async () => {
    const fs = await getFileset();
    for (const path of [CONFIG.FACE_MODEL_URL, CONFIG.FACE_MODEL_FALLBACK]) {
      for (const delegate of ["GPU", "CPU"]) {
        try {
          coach = await FaceLandmarker.createFromOptions(fs, {
            baseOptions: { modelAssetPath: path, delegate }, runningMode: "VIDEO", numFaces: 1,
            outputFaceBlendshapes: true,
          });
          return coach;
        } catch (e) { console.warn("[facetwin] coach model", path, delegate, e); }
      }
    }
    throw new Error("Face model could not load");
  })().finally(() => { coachLoading = null; });
  return coachLoading;
}
// Returns { lm, bs: {jawOpen: 0..1, ...} } or null when no face is in view.
export function trackFace(video, ts = performance.now()) {
  if (!coach) return null;
  if (ts <= lastTs) ts = lastTs + 1;
  lastTs = ts;
  try {
    const r = coach.detectForVideo(video, ts);
    const lm = r.faceLandmarks?.[0];
    if (!lm) return null;
    const bs = {};
    for (const c of r.faceBlendshapes?.[0]?.categories || []) bs[c.categoryName] = c.score;
    return { lm: lm.map((p) => [p.x, p.y, p.z]), bs };
  } catch (e) { console.warn(e); return null; }
}

export async function loadHair() {
  if (hairSeg || hairTried) return hairLoading || hairSeg;
  hairTried = true;
  hairLoading = loadHairInner().finally(() => { hairLoading = null; });
  return hairLoading;
}
let hairLoading = null;
async function loadHairInner() {
  const fs = await getFileset();
  for (const delegate of ["GPU", "CPU"]) {
    try {
      hairSeg = await ImageSegmenter.createFromOptions(fs, {
        baseOptions: { modelAssetPath: CONFIG.HAIR_MODEL_URL, delegate }, runningMode: "IMAGE",
        outputCategoryMask: true, outputConfidenceMasks: false,
      });
      return hairSeg;
    } catch (e) { console.warn("[facetwin] hair model", delegate, e); }
  }
  return null;
}
export const hairReady = () => !!hairSeg;
export const hairFailed = () => hairTried && !hairSeg && !hairLoading;

export let lastFaceCount = 0; // faces found by the last detect() call (2 means "two or more")
export function detect(source) {
  if (!landmarker) return null;
  try {
    const r = landmarker.detect(source);
    lastFaceCount = r.faceLandmarks ? r.faceLandmarks.length : 0;
    return r.faceLandmarks && r.faceLandmarks[0] ? r.faceLandmarks[0].map((p) => [p.x, p.y, p.z]) : null;
  } catch (e) { console.warn(e); return null; }
}

// ---------- photo quality ----------
const qc = document.createElement("canvas");
qc.width = 96; qc.height = 128;
const qx = qc.getContext("2d", { willReadFrequently: true });

export function quality(source, lm) {
  qx.drawImage(source, 0, 0, 96, 128);
  const d = qx.getImageData(0, 0, 96, 128).data;
  let sum = 0;
  const g = new Float32Array(96 * 128);
  for (let i = 0; i < g.length; i++) { g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; sum += g[i]; }
  const brightness = sum / g.length;
  // sharpness: variance of the Laplacian
  let lsum = 0, lsq = 0, n = 0;
  for (let y = 1; y < 127; y++) for (let x = 1; x < 95; x++) {
    const i = y * 96 + x;
    const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - 96] - g[i + 96];
    lsum += l; lsq += l * l; n++;
  }
  const sharp = lsq / n - (lsum / n) ** 2;
  let yaw = 0, size = 0;
  if (lm) {
    const L = lm[234], R = lm[454], N = lm[1];
    yaw = (N[0] - L[0]) / (R[0] - L[0]) - 0.5; // ~0 front, +/- when turned
    size = Math.abs(R[0] - L[0]);
  }
  return { brightness, sharp, yaw, size, face: !!lm };
}

// ---------- analysis ----------
const P = (lm, i, W, H) => [lm[i][0] * W, lm[i][1] * H];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function analyze(canvas, lm) {
  const W = canvas.width, H = canvas.height, p = (i) => P(lm, i, W, H);
  const width = dist(p(234), p(454)), length = dist(p(10), p(152));
  const jaw = dist(p(172), p(397)), forehead = dist(p(71), p(301));
  const L = length / width, J = jaw / width, F = forehead / width;
  let shape = "Oval";
  if (L >= 1.42) shape = "Long";
  else if (L < 1.18) shape = J > 0.8 ? "Square" : "Round";
  else if (F - J > 0.1) shape = "Heart";
  else if (J > 0.84) shape = "Square";

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const r = Math.max(6, Math.round(width * 0.055));
  const patch = (i, dy = 0) => {
    const [cx, cy] = p(i);
    const x0 = Math.round(cx - r), y0 = Math.round(cy - r + dy * r);
    const img = ctx.getImageData(Math.max(0, x0), Math.max(0, y0), r * 2, r * 2).data;
    const n = img.length / 4, lum = new Float32Array(n);
    let R = 0, G = 0, B = 0, s = 0;
    for (let k = 0; k < n; k++) {
      R += img[k * 4]; G += img[k * 4 + 1]; B += img[k * 4 + 2];
      lum[k] = 0.299 * img[k * 4] + 0.587 * img[k * 4 + 1] + 0.114 * img[k * 4 + 2]; s += lum[k];
    }
    const m = s / n, side = r * 2;
    let hf = 0, c = 0;
    for (let y = 1; y < side - 1; y++) for (let x = 1; x < side - 1; x++) {
      const k = y * side + x;
      const blur = (lum[k - 1] + lum[k + 1] + lum[k - side] + lum[k + side]) / 4;
      hf += Math.abs(lum[k] - blur); c++;
    }
    return { lum: m, hf: hf / c / Math.max(m, 1), red: (R - G) / Math.max(R + G + B, 1) };
  };
  const cheekL = patch(205), cheekR = patch(425), fore = patch(151), chin = patch(199);
  const underL = patch(119, 0.6), underR = patch(348, 0.6);
  const skin = [cheekL, cheekR, fore, chin];
  const hfAvg = skin.reduce((a, b) => a + b.hf, 0) / skin.length;
  const lumAvg = skin.reduce((a, b) => a + b.lum, 0) / skin.length;
  const toneSpread = Math.sqrt(skin.reduce((a, b) => a + (b.lum - lumAvg) ** 2, 0) / skin.length) / Math.max(lumAvg, 1);
  const redAvg = (cheekL.red + cheekR.red) / 2;
  const underRatio = ((underL.lum + underR.lum) / 2) / Math.max((cheekL.lum + cheekR.lum) / 2, 1);

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const texture = clamp((hfAvg - 0.012) / 0.03);         // 0 smooth ... 1 lots of fine detail
  const redness = clamp((redAvg - 0.08) / 0.12);
  const darkCircles = clamp((0.97 - underRatio) / 0.15);
  const evenness = clamp(1 - toneSpread / 0.12);
  const score = Math.round(100 - (texture * 18 + redness * 10 + darkCircles * 8 + (1 - evenness) * 10));

  const notes = [];
  if (texture >= 0.55) notes.push("Texture focus");
  if (redness >= 0.6) notes.push("Some redness");
  if (darkCircles >= 0.6) notes.push("Tired under-eyes");
  if (!notes.length) notes.push("Calm, even skin");

  const eyeBox = [33, 133, 362, 263, 159, 145, 386, 374].map((i) => lm[i]);
  return {
    shape, ratios: { L: +L.toFixed(3), J: +J.toFixed(3), F: +F.toFixed(3) },
    texture: +texture.toFixed(2), redness: +redness.toFixed(2), darkCircles: +darkCircles.toFixed(2),
    evenness: +evenness.toFixed(2), score: Math.max(40, Math.min(99, score)), notes,
    eyes: { x0: Math.min(...eyeBox.map((e) => e[0])), x1: Math.max(...eyeBox.map((e) => e[0])),
            y0: Math.min(...eyeBox.map((e) => e[1])), y1: Math.max(...eyeBox.map((e) => e[1])) },
  };
}

export const SHAPE_TIPS = {
  Oval: { frames: "Almost any frame. Round and cat-eye feel softest.", hair: "Curtain bangs, a long bob and layers all work." },
  Round: { frames: "Angular or cat-eye frames add definition.", hair: "Long layers and side parts lengthen the face." },
  Square: { frames: "Round frames soften a strong jaw.", hair: "Soft waves and curtain bangs around the jaw." },
  Heart: { frames: "Light, bottom-heavy or round frames.", hair: "Chin-length bobs balance the forehead." },
  Long: { frames: "Wide, deep frames shorten the face.", hair: "Bangs and volume at the sides." },
};

// ---------- try-on ----------
// k = default strength 0..1; the user can change strength per category with a slider.
export const LOOKS = [
  { id: "copper", cat: "Hair", name: "Copper", hair: "#B4532A", sw: "#B4532A" },
  { id: "espresso", cat: "Hair", name: "Espresso", hair: "#3A2318", sw: "#3A2318" },
  { id: "honey", cat: "Hair", name: "Honey blonde", hair: "#C9974F", sw: "#C9974F" },
  { id: "rosewood", cat: "Hair", name: "Rosewood", hair: "#8E3B46", sw: "#8E3B46" },
  { id: "platinum", cat: "Hair", name: "Platinum", hair: "#E6DCC8", sw: "#E6DCC8" },
  { id: "jet", cat: "Hair", name: "Jet black", hair: "#16110F", sw: "#16110F" },
  { id: "ombre", cat: "Hair", name: "Honey ombré", hair: "#D8A464", ombre: 1, sw: "#D8A464" },
  { id: "custom", cat: "Hair", name: "Any color", hair: "#7C4DFF", custom: 1, sw: "#7C4DFF" },
  { id: "glow", cat: "Skin", name: "Glow (smooth)", skin: "glow", sw: "#FFD9C9" },
  { id: "even", cat: "Skin", name: "Even tone", skin: "even", sw: "#F1CDB3" },
  { id: "goal", cat: "Skin", name: "Week-12 goal", skin: "goal", sw: "#FFE3D6" },
  { id: "bronze", cat: "Skin", name: "Sun-kissed", skin: "bronze", sw: "#C98B5E" },
  { id: "blush", cat: "Skin", name: "Soft blush", skin: "blush", sw: "#F2A1A8" },
  { id: "rested", cat: "Skin", name: "Rested eyes", skin: "rested", sw: "#FFF1B8" },
  { id: "round", cat: "Glasses", name: "Round frames", glasses: "round", sw: "#1A1412" },
  { id: "cateye", cat: "Glasses", name: "Cat-eye", glasses: "cateye", sw: "#5A2D1A" },
  { id: "square", cat: "Glasses", name: "Soft square", glasses: "square", sw: "#2B2B33" },
  { id: "gold", cat: "Glasses", name: "Thin gold", glasses: "round", thin: 1, sw: "#B8925A" },
  { id: "brows", cat: "Brows", name: "Fuller brows", brows: "#3C241A", sw: "#4A2C20" },
  { id: "softbrows", cat: "Brows", name: "Soft brown", brows: "#7A5440", sw: "#7A5440" },
  { id: "rose", cat: "Lips", name: "Rose", lips: "#C0505F", sw: "#C0505F" },
  { id: "berry", cat: "Lips", name: "Berry", lips: "#7E2A4A", sw: "#7E2A4A" },
  { id: "nude", cat: "Lips", name: "Warm nude", lips: "#B9786A", sw: "#B9786A" },
  { id: "red", cat: "Lips", name: "Classic red", lips: "#B0182A", sw: "#B0182A" },
];
export const CATS = ["Hair", "Skin", "Glasses", "Brows", "Lips"];
export const lookById = (id) => LOOKS.find((l) => l.id === id);

const maskCache = new Map(); // key -> {w: Float32Array (0..1), approx: bool}
const P2 = (lm, i, W, H) => [lm[i][0] * W, lm[i][1] * H];
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const EYE_L = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_R = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

function canvasMaskToWeights(c, blurPx) {
  const bc = document.createElement("canvas"); bc.width = c.width; bc.height = c.height;
  const bx = bc.getContext("2d", { willReadFrequently: true });
  bx.filter = `blur(${blurPx}px)`; bx.drawImage(c, 0, 0);
  const a = bx.getImageData(0, 0, bc.width, bc.height).data, w = new Float32Array(bc.width * bc.height);
  for (let i = 0; i < w.length; i++) w[i] = a[i * 4 + 3] / 255;
  return w;
}

// Fallback when the hair AI model can't download: hair = pixels around the head that match
// the color sampled just above the forehead. Rougher edges, but the color change still reads.
function approxHairMask(canvas, lm) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d", { willReadFrequently: true });
  const top = P2(lm, 10, W, H), chin = P2(lm, 152, W, H), L = P2(lm, 234, W, H), R = P2(lm, 454, W, H);
  const fw = Math.abs(R[0] - L[0]), fh = Math.abs(chin[1] - top[1]), cx = (L[0] + R[0]) / 2;
  const img = ctx.getImageData(0, 0, W, H).data;
  const samp = [];
  for (const [dx, dy] of [[0, -0.12], [-0.18, -0.08], [0.18, -0.08], [-0.42, 0.15], [0.42, 0.15]]) {
    const x = Math.round(cx + dx * fw * 1.2), y = Math.round(top[1] + dy * fh);
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
    let r = 0, g = 0, b = 0;
    for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) { const k = ((y + yy) * W + x + xx) * 4; r += img[k]; g += img[k + 1]; b += img[k + 2]; }
    samp.push([r / 25, g / 25, b / 25]);
  }
  if (!samp.length) return null;
  const skin = [];
  for (const i of [205, 425, 151, 199]) {
    const [x, y] = P2(lm, i, W, H).map(Math.round); let r = 0, g = 0, b = 0;
    for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) { const k = ((y + yy) * W + x + xx) * 4; r += img[k]; g += img[k + 1]; b += img[k + 2]; }
    skin.push([r / 25, g / 25, b / 25]);
  }
  // drop "hair" samples that are really skin (pulled-back hair, high forehead)
  const near = (s, set, t) => set.some((q) => (s[0] - q[0]) ** 2 + (s[1] - q[1]) ** 2 + (s[2] - q[2]) ** 2 < t * t);
  for (let i = samp.length - 1; i >= 0; i--) if (near(samp[i], skin, 45)) samp.splice(i, 1);
  if (!samp.length) return null;
  const mc = document.createElement("canvas"); mc.width = W; mc.height = H;
  const mx = mc.getContext("2d");
  const id = mx.createImageData(W, H);
  const ex = fw * 1.05, ey0 = top[1] - fh * 0.55, ey1 = chin[1] + fh * 0.9;
  const ecy = (ey0 + ey1) / 2, ery = (ey1 - ey0) / 2;
  for (let y = Math.max(0, Math.floor(ey0)); y < Math.min(H, ey1); y++) for (let x = 0; x < W; x++) {
    const nx = (x - cx) / ex, ny = (y - ecy) / ery;
    if (nx * nx + ny * ny > 1) continue;
    const k = (y * W + x) * 4;
    if (y > chin[1] - fh * 0.05 && Math.abs(x - cx) < fw * 0.42) continue; // neck
    let best = 1e9, bestSkin = 1e9;
    for (const s of samp) { const d = (img[k] - s[0]) ** 2 + (img[k + 1] - s[1]) ** 2 + (img[k + 2] - s[2]) ** 2; if (d < best) best = d; }
    for (const s of skin) { const d = (img[k] - s[0]) ** 2 + (img[k + 1] - s[1]) ** 2 + (img[k + 2] - s[2]) ** 2; if (d < bestSkin) bestSkin = d; }
    if (best < 42 * 42 && best < bestSkin * 0.55) id.data[k + 3] = 255;
  }
  mx.putImageData(id, 0, 0);
  // never colour the face itself
  mx.globalCompositeOperation = "destination-out";
  mx.beginPath(); poly(mx, FACE_OVAL.map((i) => { const p = P2(lm, i, W, H); return [cx + (p[0] - cx) * 0.97, p[1] + (p[1] < top[1] + fh * 0.2 ? fh * 0.03 : 0)]; })); mx.fill();
  const w = canvasMaskToWeights(mc, Math.max(2, W / 180));
  let sum = 0; for (let i = 0; i < w.length; i++) sum += w[i];
  return sum > fw * fh * 0.15 ? w : null; // too little found: better no colour than a wrong one
}

export async function hairMask(key, canvas, lm) {
  if (maskCache.has(key)) return maskCache.get(key);
  const seg = await loadHair();
  if (seg) {
    try {
      const res = seg.segment(canvas);
      const m = res.categoryMask, raw = m.getAsUint8Array();
      const mc = document.createElement("canvas"); mc.width = m.width; mc.height = m.height;
      const mx = mc.getContext("2d");
      const id = mx.createImageData(m.width, m.height);
      for (let i = 0; i < raw.length; i++) id.data[i * 4 + 3] = raw[i] > 0 ? 255 : 0;
      mx.putImageData(id, 0, 0);
      const full = document.createElement("canvas"); full.width = canvas.width; full.height = canvas.height;
      full.getContext("2d").drawImage(mc, 0, 0, full.width, full.height);
      res.close && res.close();
      const out = { w: canvasMaskToWeights(full, Math.max(1, Math.round(canvas.width / 260))), approx: false };
      maskCache.set(key, out); return out;
    } catch (e) { console.warn("[facetwin] hair segment", e); }
  }
  if (!lm) return null;
  const w = approxHairMask(canvas, lm);
  const out = w ? { w, approx: true } : null;
  if (out) maskCache.set(key, out);
  return out;
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function recolorHair(ctx, W, H, mask, color, k = 0.8, ombre = false) {
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  const [tr, tg, tb] = hex(color);
  const tl = 0.299 * tr + 0.587 * tg + 0.114 * tb;
  let y0 = H, y1 = 0;
  if (ombre) for (let i = 0; i < mask.length; i++) if (mask[i] > 0.3) { const y = (i / W) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  for (let i = 0; i < mask.length; i++) {
    let a = mask[i];
    if (a < 0.02) continue;
    if (ombre) { const t = ((((i / W) | 0) - y0) / Math.max(1, y1 - y0) - 0.3) / 0.45; a *= Math.max(0, Math.min(1, t)); if (a < 0.02) continue; }
    const q = i * 4, l = 0.299 * d[q] + 0.587 * d[q + 1] + 0.114 * d[q + 2];
    const f = Math.min(2.4, (l + 18) / (tl + 18)); // keep shine and shadows of the real hair
    const lift = tl > 170 ? 0.55 : 0; // very light shades: lift dark hair towards the target
    const w = a * Math.min(0.95, k);
    for (let c = 0; c < 3; c++) {
      const t = [tr, tg, tb][c], v = Math.min(255, t * f * (1 - lift) + t * lift);
      d[q + c] = d[q + c] * (1 - w) + v * w;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const BROW_L = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const BROW_R = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
const LIP_OUT = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LIP_IN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

function poly(ctx, pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); }

function drawBrows(ctx, lm, W, H, color = "#3C241A", k = 0.75) {
  const [r, g, b] = hex(color);
  for (const idx of [BROW_L, BROW_R]) {
    const pts = idx.map((i) => P(lm, i, W, H));
    const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    const big = pts.map(([x, y]) => [cx + (x - cx) * 1.04, cy + (y - cy) * 1.45]);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.filter = `blur(${Math.max(1, W / 300)}px)`;
    ctx.fillStyle = `rgba(${r},${g},${b},${0.78 * k})`;
    ctx.beginPath(); poly(ctx, big); ctx.fill();
    ctx.restore();
  }
}

function drawLips(ctx, lm, W, H, color, k = 0.75) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.filter = `blur(${Math.max(0.6, W / 600)}px)`;
  const [r, g, b] = hex(color);
  ctx.fillStyle = `rgba(${r},${g},${b},${0.75 * k})`;
  ctx.beginPath(); poly(ctx, LIP_OUT.map((i) => P(lm, i, W, H))); poly(ctx, LIP_IN.map((i) => P(lm, i, W, H)).reverse());
  ctx.fill("evenodd");
  ctx.restore();
}

// Skin: work only inside the face oval, never on eyes, brows or lips.
function skinMaskCanvas(lm, W, H) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#000"; x.beginPath(); poly(x, FACE_OVAL.map((i) => P(lm, i, W, H))); x.fill();
  x.globalCompositeOperation = "destination-out";
  const grow = (idx, sx, sy) => { const pts = idx.map((i) => P(lm, i, W, H)); const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length; return pts.map(([px, py]) => [cx + (px - cx) * sx, cy + (py - cy) * sy]); };
  for (const [idx, sx, sy] of [[EYE_L, 1.35, 1.9], [EYE_R, 1.35, 1.9], [BROW_L, 1.15, 1.9], [BROW_R, 1.15, 1.9], [LIP_OUT, 1.12, 1.25]]) { x.beginPath(); poly(x, grow(idx, sx, sy)); x.fill(); }
  const feather = document.createElement("canvas"); feather.width = W; feather.height = H;
  const f = feather.getContext("2d"); f.filter = `blur(${Math.max(2, W / 90)}px)`; f.drawImage(c, 0, 0);
  return feather;
}
function layerThroughMask(ctx, layer, mask, alpha, op = "source-over") {
  const L = layer.getContext("2d");
  L.globalCompositeOperation = "destination-in"; L.drawImage(mask, 0, 0); L.globalCompositeOperation = "source-over";
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op; ctx.drawImage(layer, 0, 0); ctx.restore();
}
function drawSkin(ctx, lm, W, H, kind, k = 0.7) {
  const mask = skinMaskCanvas(lm, W, H);
  const faceW = dist(P(lm, 234, W, H), P(lm, 454, W, H));
  const copy = (filter) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.filter = filter; x.drawImage(ctx.canvas, 0, 0); return c; };
  const smooth = (amount, blurDiv) => layerThroughMask(ctx, copy(`blur(${Math.max(1.5, faceW / blurDiv)}px) brightness(1.04) saturate(0.96)`), mask, amount);
  const tint = (color, amount, op) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, W, H); layerThroughMask(ctx, c, mask, amount, op); };
  const cheeks = (color, amount) => {
    ctx.save(); ctx.globalCompositeOperation = "multiply";
    for (const i of [50, 280]) {
      const [x, y] = P(lm, i, W, H), r = faceW * 0.17;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const [cr, cg, cb] = hex(color); g.addColorStop(0, `rgba(${cr},${cg},${cb},${amount})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  const underEyes = (amount) => {
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.filter = `blur(${Math.max(2, faceW / 30)}px)`;
    for (const i of [119, 348]) { const [x, y] = P(lm, i, W, H); ctx.fillStyle = `rgba(255,236,220,${amount})`; ctx.beginPath(); ctx.ellipse(x, y - faceW * 0.02, faceW * 0.11, faceW * 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  if (kind === "glow") { smooth(0.85 * k, 38); tint("#FFE9DC", 0.18 * k, "soft-light"); }
  if (kind === "even") { smooth(0.55 * k, 30); tint("#F2D2BE", 0.22 * k, "color"); }
  if (kind === "goal") { smooth(0.8 * k, 34); tint("#F2D2BE", 0.15 * k, "color"); underEyes(0.35 * k); tint("#FFE9DC", 0.15 * k, "soft-light"); }
  if (kind === "bronze") { tint("#B8733F", 0.6 * k, "soft-light"); cheeks("#C9824F", 0.25 * k); }
  if (kind === "blush") cheeks("#E86F7E", 0.45 * k);
  if (kind === "rested") underEyes(0.6 * k);
}

function drawGlasses(ctx, lm, W, H, style, color, thin = false) {
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const e1 = mid(P(lm, 33, W, H), P(lm, 133, W, H)), e2 = mid(P(lm, 362, W, H), P(lm, 263, W, H));
  const d = dist(e1, e2), ang = Math.atan2(e2[1] - e1[1], e2[0] - e1[0]), c = mid(e1, e2);
  const faceW = dist(P(lm, 234, W, H), P(lm, 454, W, H));
  ctx.save();
  ctx.translate(c[0], c[1]); ctx.rotate(ang);
  const lw = Math.max(thin ? 1.2 : 2, d * (thin ? 0.03 : 0.075)), half = d / 2;
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.lineJoin = "round";
  const lens = (sx) => {
    ctx.beginPath();
    if (style === "round") ctx.arc(sx, d * 0.03, d * 0.42, 0, Math.PI * 2);
    else if (style === "square") ctx.roundRect(sx - d * 0.46, -d * 0.3, d * 0.92, d * 0.66, d * 0.16);
    else { // cat-eye: lifted outer corner
      const o = Math.sign(sx);
      ctx.moveTo(sx - o * d * 0.42, -d * 0.12);
      ctx.quadraticCurveTo(sx, -d * 0.36, sx + o * d * 0.52, -d * 0.34);
      ctx.quadraticCurveTo(sx + o * d * 0.5, d * 0.32, sx, d * 0.32);
      ctx.quadraticCurveTo(sx - o * d * 0.44, d * 0.3, sx - o * d * 0.42, -d * 0.12);
    }
    ctx.fill(); ctx.stroke();
  };
  lens(-half); lens(half);
  ctx.beginPath(); ctx.moveTo(-half + d * 0.38, -d * 0.06); ctx.quadraticCurveTo(0, -d * 0.2, half - d * 0.38, -d * 0.06); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-half - d * 0.44, -d * 0.12); ctx.lineTo(-faceW / 2, -d * 0.08);
  ctx.moveTo(half + d * 0.44, -d * 0.12); ctx.lineTo(faceW / 2, -d * 0.08); ctx.stroke();
  ctx.restore();
}

// Draw a photo with a set of looks applied.
// look = {hair, ombre, glasses, gcolor, thin, brows, lips, skin, k: {Hair, Skin, Brows, Lips}}
export async function render(target, img, lm, look = {}, key = "photo") {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  target.width = W; target.height = H;
  const ctx = target.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  if (!lm) return { hair: false };
  const k = look.k || {};
  let hairOk = true, approx = false;
  if (look.skin) drawSkin(ctx, lm, W, H, look.skin, k.Skin ?? 0.7);
  if (look.hair) {
    const base = document.createElement("canvas"); base.width = W; base.height = H;
    base.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0, W, H);
    const m = await hairMask(key, base, lm);
    if (m) { recolorHair(ctx, W, H, m.w, look.hair, k.Hair ?? 0.8, look.ombre); approx = m.approx; } else hairOk = false;
  }
  if (look.brows) drawBrows(ctx, lm, W, H, look.brows === 1 ? "#3C241A" : look.brows, k.Brows ?? 0.75);
  if (look.lips) drawLips(ctx, lm, W, H, look.lips, k.Lips ?? 0.75);
  if (look.glasses) drawGlasses(ctx, lm, W, H, look.glasses, look.gcolor || "#1A1412", look.thin);
  return { hair: hairOk, approx };
}

export function combine(ids, opts = {}) {
  const out = { k: opts.k || {} };
  for (const id of ids) {
    const l = lookById(id); if (!l) continue;
    if (l.hair) { out.hair = l.custom && opts.customHair ? opts.customHair : l.hair; out.ombre = !!l.ombre; }
    if (l.glasses) { out.glasses = l.glasses; out.gcolor = l.sw; out.thin = !!l.thin; }
    if (l.brows) out.brows = l.brows;
    if (l.lips) out.lips = l.lips;
    if (l.skin) out.skin = l.skin;
  }
  return out;
}
