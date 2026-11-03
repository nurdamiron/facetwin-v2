// Depth AI: estimates how far every pixel of a selfie is from the camera (face, hair, neck),
// using Depth Anything V2 Small (Apache-2.0) with ONNX Runtime Web. Runs on the device.
import * as ort from "./vendor/ort/ort.min.mjs";
import { CONFIG } from "./config.js";

ort.env.wasm.wasmPaths = new URL("./vendor/ort/", import.meta.url).href;
ort.env.wasm.numThreads = 1; // no cross-origin isolation needed
const SIZE = 518;
let session = null, loading = null;

let progressCb = null;
export function onDepthProgress(cb) { progressCb = cb; }
async function fetchModel(url) {
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error("model download failed " + r.status);
  const total = +r.headers.get("content-length") || 0, reader = r.body.getReader(), parts = [];
  let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; progressCb?.(total ? got / total : 0); }
  const buf = new Uint8Array(got); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
  return buf;
}
export function loadDepth() {
  if (session) return Promise.resolve(session);
  if (loading) return loading;
  loading = (async () => {
    const bytes = await fetchModel(CONFIG.DEPTH_MODEL_URL);
    const tries = navigator.gpu ? [["webgpu"], ["wasm"]] : [["wasm"]];
    for (const executionProviders of tries) {
      try {
        session = await ort.InferenceSession.create(bytes, { executionProviders, graphOptimizationLevel: "all" });
        console.info("[facetwin] depth AI ready on", executionProviders[0]);
        return session;
      } catch (e) { console.warn("[facetwin] depth AI", executionProviders[0], e); }
    }
    loading = null;
    throw new Error("The 3D model could not load");
  })().catch((e) => { loading = null; throw e; });
  return loading;
}

// Returns {w, h, data: Float32Array} with 0 = far … 1 = near, over the whole image.
export async function estimateDepth(img) {
  const s = await loadDepth();
  const c = document.createElement("canvas"); c.width = SIZE; c.height = SIZE;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0, SIZE, SIZE);
  const px = x.getImageData(0, 0, SIZE, SIZE).data, n = SIZE * SIZE, arr = new Float32Array(3 * n);
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) arr[ch * n + i] = (px[i * 4 + ch] / 255 - mean[ch]) / std[ch];
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", arr, [1, 3, SIZE, SIZE]) });
  const raw = out[s.outputNames[0]].data;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const v = raw[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const data = new Float32Array(n), r = hi - lo || 1;
  for (let i = 0; i < n; i++) data[i] = (raw[i] - lo) / r;
  return { w: SIZE, h: SIZE, data };
}

// Depth saved with the twin as a small 16-bit PNG (high byte in red, low byte in green).
export function depthToDataURL(dep, size = 320) {
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const x = c.getContext("2d"), im = x.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) {
    const v = Math.round(sampleDepth(dep, (xx + 0.5) / size, (y + 0.5) / size) * 65535), k = (y * size + xx) * 4;
    im.data[k] = v >> 8; im.data[k + 1] = v & 255; im.data[k + 2] = 0; im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  return c.toDataURL("image/png");
}
export async function depthFromDataURL(url) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const px = x.getImageData(0, 0, c.width, c.height).data, data = new Float32Array(c.width * c.height);
  for (let i = 0; i < data.length; i++) data[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 65535;
  return { w: c.width, h: c.height, data };
}
// Bilinear sample at normalized image coordinates (u, v in 0..1).
export function sampleDepth(dep, u, v) {
  const fx = Math.min(dep.w - 1.001, Math.max(0, u * dep.w - 0.5)), fy = Math.min(dep.h - 1.001, Math.max(0, v * dep.h - 0.5));
  const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, w = dep.w, d = dep.data;
  const a = d[y0 * w + x0], b = d[y0 * w + x0 + 1], c = d[(y0 + 1) * w + x0], e = d[(y0 + 1) * w + x0 + 1];
  return a * (1 - ax) * (1 - ay) + b * ax * (1 - ay) + c * (1 - ax) * ay + e * ax * ay;
}
