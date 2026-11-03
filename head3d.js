// 180° twin: fuses the front selfie and the two side selfies into one 3D head.
// 1. The 478 face points in each photo tell how far the head was turned (we align the three point sets).
// 2. The depth AI gives a surface per photo; the surfaces are merged around the head (cylinder map).
// 3. Each part of the head is coloured from the photo that saw it best (view-dependent blending).
// Runs on the phone with WebGL. No photo leaves the device.
import * as THREE from "./vendor/three/three.module.js";
import { sampleDepth } from "./depth3d.js";

const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const SKIN = [9, 8, 168, 6, 197, 195, 5, 151, 108, 337, 4]; // forehead + nose bridge: visible in every view

// ---------- small linear algebra ----------
function jacobiEig4(A) { // symmetric 4x4 → eigenvector of the largest eigenvalue
  const a = A.map((r) => [...r]), v = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += a[p][q] * a[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
      if (Math.abs(a[p][q]) < 1e-20) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 4; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 4; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 4; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
    }
  }
  let best = 0; for (let i = 1; i < 4; i++) if (a[i][i] > a[best][best]) best = i;
  return [v[0][best], v[1][best], v[2][best], v[3][best]];
}
// Similarity transform (Horn): B ≈ s·R·A + t
function similarity(A, B) {
  const n = A.length, ca = [0, 0, 0], cb = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { ca[k] += A[i][k] / n; cb[k] += B[i][k] / n; }
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; let na = 0, nb = 0;
  for (let i = 0; i < n; i++) {
    const a = [A[i][0] - ca[0], A[i][1] - ca[1], A[i][2] - ca[2]], b = [B[i][0] - cb[0], B[i][1] - cb[1], B[i][2] - cb[2]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += a[r] * b[c];
    na += a[0] * a[0] + a[1] * a[1] + a[2] * a[2]; nb += b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
  }
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const [w, x, y, z] = jacobiEig4([
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz]]);
  const R = [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]];
  const s = Math.sqrt(nb / na), t = [0, 1, 2].map((k) => cb[k] - s * (R[k][0] * ca[0] + R[k][1] * ca[1] + R[k][2] * ca[2]));
  return { s, R, t };
}
const mul = (R, p) => [R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2], R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2], R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2]];
const mulT = (R, p) => [R[0][0] * p[0] + R[1][0] * p[1] + R[2][0] * p[2], R[0][1] * p[0] + R[1][1] * p[1] + R[2][1] * p[2], R[0][2] * p[0] + R[1][2] * p[1] + R[2][2] * p[2]];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

// ---------- one photo: points in pixels, depth calibrated to the face points, person mask ----------
function prepView(v) {
  const W = v.photo.width, H = v.photo.height, lm = v.lm;
  const P = lm.slice(0, 468).map((p) => [p[0] * W, p[1] * H, -(p[2] || 0) * W]); // Z toward the camera
  const d = lm.slice(0, 468).map((p) => sampleDepth(v.dep, p[0], p[1]));
  // robust line fit Z = a·depth + b (points hidden by the head itself fall out as outliers)
  let use = P.map((_, i) => i), a = 1, b = 0;
  for (let it = 0; it < 4; it++) {
    let sx = 0, sy = 0, sxx = 0, sxy = 0; const n = use.length;
    for (const i of use) { sx += d[i]; sy += P[i][2]; sxx += d[i] * d[i]; sxy += d[i] * P[i][2]; }
    a = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx); b = (sy - a * sx) / n;
    const res = P.map((p, i) => Math.abs(a * d[i] + b - p[2])), m = median(use.map((i) => res[i])) || 1;
    use = P.map((_, i) => i).filter((i) => res[i] < 2.5 * m);
  }
  const fw = Math.hypot(P[454][0] - P[234][0], P[454][1] - P[234][1], P[454][2] - P[234][2]);
  if (!(a > 0)) a = fw * 0.35 / 0.2; // fallback: typical face relief
  const Zat = (u, vv) => a * sampleDepth(v.dep, u, vv) + b;
  // person mask from depth, using the face outline points this photo really sees
  const vis = OVAL.filter((i) => Math.abs(a * d[i] + b - P[i][2]) < fw * 0.12);
  const ringD = (vis.length > 6 ? vis : OVAL).map((i) => d[i]).sort((x, y) => x - y);
  const q = ringD[Math.floor(ringD.length * 0.25)], dNose = d[1];
  let cut = q - Math.max(0.06, (dNose - q) * 1.1);
  // person vs. background: split the depth values around the head in two groups (Otsu); more forgiving
  // for parts that recede from the face (crown, ears, hair at the back)
  const cxn = (lm[234][0] + lm[454][0]) / 2, fwn = Math.abs(lm[454][0] - lm[234][0]), fhn = Math.abs(lm[152][1] - lm[10][1]);
  const hist = new Float32Array(64); let tot = 0;
  for (let y = 0; y < 60; y++) for (let x = 0; x < 50; x++) {
    const u = cxn + (x / 49 - 0.5) * fwn * 3, vv = lm[10][1] - fhn * 0.9 + (y / 59) * fhn * 2.4;
    if (u < 0 || u > 1 || vv < 0 || vv > 1) continue;
    hist[Math.min(63, Math.floor(sampleDepth(v.dep, u, vv) * 64))]++; tot++;
  }
  let best = -1, otsu = cut, sumAll = 0; for (let i = 0; i < 64; i++) sumAll += i * hist[i];
  for (let t = 1, wB = 0, sB = 0; t < 64; t++) {
    wB += hist[t - 1]; sB += (t - 1) * hist[t - 1]; const wF = tot - wB; if (!wB || !wF) continue;
    const mB = sB / wB, mF = (sumAll - sB) / wF, bv = wB * wF * (mB - mF) ** 2;
    if (bv > best) { best = bv; otsu = t / 64; }
  }
  if (otsu < q - 0.03 && otsu > q - 0.6) cut = Math.min(cut, otsu + 0.02);
  const maskAt = (u, vv) => smooth(cut, cut + 0.04, sampleDepth(v.dep, u, vv));
  // depth edges (silhouettes) mix person and background: trust them less
  const e = 1.5 / v.dep.w;
  const edgeAt = (u, vv) => { const g = Math.abs(sampleDepth(v.dep, u + e, vv) - sampleDepth(v.dep, u - e, vv)) + Math.abs(sampleDepth(v.dep, u, vv + e) - sampleDepth(v.dep, u, vv - e)); return 1 - smooth(0.025, 0.09, g); };
  return { ...v, W, H, P, a, b, fw, Zat, maskAt, edgeAt };
}

function meanColor(view, idx) {
  const c = document.createElement("canvas"); c.width = view.W; c.height = view.H;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(view.photo, 0, 0);
  const acc = [0, 0, 0]; let n = 0; const r = Math.max(2, Math.round(view.fw * 0.015));
  for (const i of idx) {
    const px = Math.round(view.lm[i][0] * view.W), py = Math.round(view.lm[i][1] * view.H);
    const d = x.getImageData(Math.max(0, px - r), Math.max(0, py - r), 2 * r + 1, 2 * r + 1).data;
    for (let k = 0; k < d.length; k += 4) { acc[0] += d[k]; acc[1] += d[k + 1]; acc[2] += d[k + 2]; n++; }
  }
  return acc.map((v) => v / Math.max(1, n));
}

// ---------- fusion ----------
export function buildHead(viewsIn, { NT = 200, NH = 230 } = {}) {
  const views = viewsIn.map(prepView), F = views[0], fw = F.fw;
  // align every photo to the front one with the face points
  const info = [];
  views.forEach((v, i) => {
    if (i === 0) { v.T = { s: 1, R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] }; v.ok = true; return; }
    v.T = similarity(v.P, F.P);
    let err = 0; for (let k = 0; k < 468; k++) { const q = mul(v.T.R, v.P[k]); err += Math.hypot(v.T.s * q[0] + v.T.t[0] - F.P[k][0], v.T.s * q[1] + v.T.t[1] - F.P[k][1], v.T.s * q[2] + v.T.t[2] - F.P[k][2]); }
    err /= 468 * fw;
    const yawDeg = Math.round(Math.atan2(v.T.R[0][2], v.T.R[2][2]) * 180 / Math.PI);
    v.ok = err < 0.08 && Math.abs(yawDeg) >= 12;
    info.push({ view: i, yawDeg, err: +err.toFixed(3), used: v.ok });
  });
  const used = views.filter((v) => v.ok);
  // only one side photo: use it mirrored for the other side (faces are close to symmetric)
  if (used.length === 2) used.push({ ...used[1], mirror: true });
  // head frame: level the eyes, centre the axis behind the nose
  const roll = Math.atan2(F.P[263][1] - F.P[33][1], F.P[263][0] - F.P[33][0]);
  const cr = Math.cos(-roll), sr = Math.sin(-roll), Rh = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]];
  const C = [(F.P[234][0] + F.P[454][0]) / 2, (F.P[234][1] + F.P[454][1]) / 2, F.P[1][2] - fw * 0.72];
  const toHead = (v, p) => { const q = mul(v.T.R, p); const r = mul(Rh, [v.T.s * q[0] + v.T.t[0] - C[0], v.T.s * q[1] + v.T.t[1] - C[1], v.T.s * q[2] + v.T.t[2] - C[2]]); if (v.mirror) r[0] = -r[0]; return r; };
  const toView = (v, h0) => { const h = v.mirror ? [-h0[0], h0[1], h0[2]] : h0; const f = mulT(Rh, h); const q = [(f[0] + C[0] - v.T.t[0]) / v.T.s, (f[1] + C[1] - v.T.t[1]) / v.T.s, (f[2] + C[2] - v.T.t[2]) / v.T.s]; return mulT(v.T.R, q); };
  const camDir = (v) => { const d = mul(Rh, mul(v.T.R, [0, 0, 1])); if (v.mirror) d[0] = -d[0]; return d; };
  // height range from the front photo: hair top to a little neck
  const topY = toHead(F, F.P[10])[1], chinY = toHead(F, F.P[152])[1], fh = chinY - topY;
  const h0 = topY - fh * 0.8, h1 = chinY + fh * 0.5;
  const TMAX = 1.95;
  const cellT = (th) => ((th + TMAX) / (2 * TMAX)) * (NT - 1), cellH = (h) => ((h - h0) / (h1 - h0)) * (NH - 1);
  const N = NT * NH, Wv = used.map(() => new Float32Array(N)), Rv = used.map(() => new Float32Array(N));
  // splat each photo's surface into the cylinder map
  used.forEach((v, vi) => {
    const L = v.lm, cx = (L[234][0] + L[454][0]) / 2, fwn = Math.abs(L[454][0] - L[234][0]) || 0.3;
    const ys = Math.min(...[10, 152].map((i) => L[i][1])), yb = Math.max(...[10, 152].map((i) => L[i][1])), fhn = yb - ys;
    const u0 = clamp(cx - fwn * 1.6, 0, 1), u1 = clamp(cx + fwn * 1.6, 0, 1), v0 = clamp(ys - fhn * 0.85, 0, 1), v1 = clamp(yb + fhn * 0.7, 0, 1);
    const NX = 220, NY = Math.round(NX * ((v1 - v0) * v.H) / ((u1 - u0) * v.W));
    const pts = new Array((NX + 1) * (NY + 1)), msk = new Float32Array((NX + 1) * (NY + 1));
    for (let r = 0; r <= NY; r++) for (let c = 0; c <= NX; c++) {
      const u = u0 + (u1 - u0) * c / NX, vv = v0 + (v1 - v0) * r / NY, k = r * (NX + 1) + c;
      msk[k] = v.maskAt(u, vv) * v.edgeAt(u, vv);
      pts[k] = toHead(v, [u * v.W, vv * v.H, v.Zat(u, vv)]);
    }
    const dir = camDir(v), bonus = vi === 0 ? 1.4 : 1;
    for (let r = 1; r < NY; r++) for (let c = 1; c < NX; c++) {
      const k = r * (NX + 1) + c; if (msk[k] < 0.3) continue;
      const p = pts[k], a = pts[k + 1], b = pts[k - 1], d1 = pts[k + NX + 1], d2 = pts[k - NX - 1];
      const ex = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], ey = [d1[0] - d2[0], d1[1] - d2[1], d1[2] - d2[2]];
      let n = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
      const nl = Math.hypot(...n) || 1; n = n.map((x) => x / nl);
      let conf = n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2]; conf = Math.abs(conf);
      const th = Math.atan2(p[0], p[2]), rr = Math.hypot(p[0], p[2]);
      // trust each photo most for the part of the head it faced (a front photo flattens the ears and sides)
      const dl = Math.hypot(dir[0], dir[2]) || 1, cosA = (p[0] * dir[0] + p[2] * dir[2]) / (Math.max(rr, 1e-6) * dl);
      const w = msk[k] * Math.max(0, conf - 0.12) ** 2 * bonus * smooth(0.3, 0.8, cosA); if (w < 0.004) continue;
      if (Math.abs(th) > TMAX || rr < fw * 0.15 || rr > fw * 1.6) continue;
      const ft = cellT(th), fhh = cellH(p[1]); const it = Math.floor(ft), ih = Math.floor(fhh);
      for (const [dt, dh] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const ti = it + dt, hi = ih + dh; if (ti < 0 || ti >= NT || hi < 0 || hi >= NH) continue;
        const bw = (1 - Math.abs(ft - ti)) * (1 - Math.abs(fhh - hi)) * w;
        Wv[vi][hi * NT + ti] += bw; Rv[vi][hi * NT + ti] += bw * rr;
      }
    }
  });
  // side photos: shift their radius to agree with the front where both see the same skin
  const off = used.map((_, vi) => {
    if (vi === 0) return 0;
    const diffs = []; for (let i = 0; i < N; i++) if (Wv[0][i] > 0.15 && Wv[vi][i] > 0.15) diffs.push(Rv[0][i] / Wv[0][i] - Rv[vi][i] / Wv[vi][i]);
    return diffs.length > 30 ? clamp(median(diffs), -fw * 0.25, fw * 0.25) : 0;
  });
  let R = new Float32Array(N), Wt = new Float32Array(N);
  for (let i = 0; i < N; i++) { let ws = 0, rs = 0; used.forEach((_, vi) => { ws += Wv[vi][i]; rs += Rv[vi][i] + off[vi] * Wv[vi][i]; }); Wt[i] = ws; R[i] = ws > 0 ? rs / ws : 0; }
  // head-shape prior: per height, the best-fitting ellipse around the head (fit to the merged surface).
  // It fills holes, rounds the crown and calms noisy hair depth, while the face keeps its own detail.
  const dhCell = (h1 - h0) / (NH - 1), thOf = (t) => -TMAX + (2 * TMAX) * t / (NT - 1);
  const AW = new Float32Array(NH), AD = new Float32Array(NH), cov = new Float32Array(NH), okRow = new Uint8Array(NH);
  for (let h = 0; h < NH; h++) {
    let s11 = 0, s12 = 0, s22 = 0, b1 = 0, b2 = 0, side = 0, front = 0, mx = 0;
    for (let t = 0; t < NT; t++) {
      const i = h * NT + t; if (Wt[i] < 0.08 || R[i] <= 0) continue;
      const th = thOf(t), sn = Math.sin(th) ** 2, cs = Math.cos(th) ** 2, y = 1 / (R[i] * R[i]), w = Math.min(1, Wt[i]);
      s11 += w * sn * sn; s12 += w * sn * cs; s22 += w * cs * cs; b1 += w * sn * y; b2 += w * cs * y;
      if (Math.abs(th) > 1.0) side++; if (Math.abs(th) < 0.4) front++; mx = Math.max(mx, Math.abs(th));
    }
    cov[h] = mx;
    const det = s11 * s22 - s12 * s12;
    if (side > 3 && front > 3 && det > 1e-12) {
      const A = (b1 * s22 - b2 * s12) / det, Bq = (s11 * b2 - s12 * b1) / det;
      if (A > 0 && Bq > 0) { AW[h] = 1 / Math.sqrt(A); AD[h] = 1 / Math.sqrt(Bq); okRow[h] = 1; }
    }
  }
  const rowsOk = [...okRow.keys()].filter((h) => okRow[h]);
  if (rowsOk.length > 5) {
    // fill rows in between, smooth along the height, keep proportions human
    const fillRow = (arr) => { for (let h = 0; h < NH; h++) if (!okRow[h]) { let lo = h, hi = h; while (lo >= 0 && !okRow[lo]) lo--; while (hi < NH && !okRow[hi]) hi++; arr[h] = lo < 0 ? arr[hi] : hi >= NH ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (h - lo) / (hi - lo); } };
    fillRow(AW); fillRow(AD);
    for (let pass = 0; pass < 6; pass++) for (const arr of [AW, AD]) { const c = arr.slice(); for (let h = 1; h < NH - 1; h++) arr[h] = (c[h - 1] + 2 * c[h] + c[h + 1]) / 4; }
    for (let h = 0; h < NH; h++) { AW[h] = clamp(AW[h], fw * 0.35, fw * 0.75); AD[h] = clamp(AD[h], fw * 0.45, fw * 0.95); }
    // crown: above the highest well-seen row, the ellipse shrinks like the top of a skull
    const top = rowsOk[0], capH = Math.max(AW[top], AD[top]) * 0.75;
    for (let h = top - 1; h >= 0; h--) { const k = Math.max(0, 1 - ((top - h) * dhCell / capH) ** 2); AW[h] = AW[top] * Math.sqrt(k); AD[h] = AD[top] * Math.sqrt(k); cov[h] = cov[top]; }
    const prior = (t, h) => { const th = thOf(t); return AW[h] > 1 ? 1 / Math.sqrt(Math.sin(th) ** 2 / (AW[h] * AW[h]) + Math.cos(th) ** 2 / (AD[h] * AD[h])) : 0; };
    const faceTop = topY + fh * 0.15;
    for (let h = 0; h < NH; h++) for (let t = 0; t < NT; t++) {
      const i = h * NT + t, rp = prior(t, h); if (!rp) continue;
      const y = h0 + h * dhCell, inFace = Math.abs(thOf(t)) < 0.95 && y > faceTop && y < chinY;
      const lam = inFace ? 0.01 : 0.12; // the face keeps its detail; hair and skull lean on the head shape
      const inCover = Math.abs(thOf(t)) <= cov[h] + 0.12;
      if (Wt[i] > 0.01) R[i] = (Wt[i] * R[i] + lam * rp) / (Wt[i] + lam);
      else if (inCover && rp > fw * 0.1) { R[i] = rp; Wt[i] = 0.06; }
    }
  }
  // gentle smoothing, stronger away from the face
  for (let pass = 0; pass < 4; pass++) {
    const R2 = R.slice();
    for (let h = 1; h < NH - 1; h++) for (let t = 1; t < NT - 1; t++) {
      const i = h * NT + t; if (Wt[i] <= 0.01) continue;
      const y = h0 + h * dhCell, inFace = Math.abs(thOf(t)) < 0.95 && y > topY + fh * 0.15 && y < chinY;
      if (inFace && pass > 0) continue;
      let s2 = R[i] * 4, n = 4; for (const j of [i - 1, i + 1, i - NT, i + NT]) if (Wt[j] > 0.01) { s2 += R[j]; n++; }
      R2[i] = s2 / n;
    }
    R = R2;
  }
  // vertices (head frame, pixels)
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3);
  for (let h = 0; h < NH; h++) for (let t = 0; t < NT; t++) {
    const i = h * NT + t, th = -TMAX + (2 * TMAX) * t / (NT - 1), y = h0 + (h1 - h0) * h / (NH - 1);
    pos[i * 3] = R[i] * Math.sin(th); pos[i * 3 + 1] = y; pos[i * 3 + 2] = R[i] * Math.cos(th);
  }
  for (let h = 0; h < NH; h++) for (let t = 0; t < NT; t++) {
    const i = h * NT + t, a = h * NT + Math.min(NT - 1, t + 1), b = h * NT + Math.max(0, t - 1), c = Math.min(NH - 1, h + 1) * NT + t, d = Math.max(0, h - 1) * NT + t;
    const ex = [0, 1, 2].map((k) => pos[a * 3 + k] - pos[b * 3 + k]), ey = [0, 1, 2].map((k) => pos[c * 3 + k] - pos[d * 3 + k]);
    let n = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
    if (n[0] * pos[i * 3] + n[2] * pos[i * 3 + 2] < 0) n = n.map((x) => -x);
    const l = Math.hypot(...n) || 1; nor[i * 3] = n[0] / l; nor[i * 3 + 1] = n[1] / l; nor[i * 3 + 2] = n[2] / l;
  }
  // per-vertex texture coordinates and weights for each photo
  const gains = used.map((v) => { const m0 = meanColor(F, SKIN), m = meanColor(v, SKIN); return m0.map((x, k) => clamp(x / Math.max(1, m[k]), 0.8, 1.25)); });
  const uvs = used.map(() => new Float32Array(N * 2)), wts = new Float32Array(N * 3), alpha = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], n = [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]];
    let ws = 0;
    used.forEach((v, vi) => {
      const q = toView(v, p), u = q[0] / v.W, vv = q[1] / v.H;
      uvs[vi][i * 2] = u; uvs[vi][i * 2 + 1] = vv;
      if (u < 0.002 || u > 0.998 || vv < 0.002 || vv > 0.998) return;
      const nv = mulT(v.T.R, mulT(Rh, v.mirror ? [-n[0], n[1], n[2]] : n)), facing = nv[2];
      if (facing < 0.08) return;
      const occl = q[2] < v.Zat(u, vv) - v.fw * 0.09; if (occl) return;
      const cd = camDir(v), rl = Math.hypot(p[0], p[2]) || 1, cosA = (p[0] * cd[0] + p[2] * cd[2]) / (rl * (Math.hypot(cd[0], cd[2]) || 1));
      const w = v.maskAt(u, vv) * (0.1 + 0.9 * v.edgeAt(u, vv)) * (facing - 0.05) ** 3 * (vi === 0 ? 1.5 : 1) * (0.15 + smooth(0.2, 0.9, cosA));
      wts[i * 3 + vi] = w; ws += w;
    });
    const h = Math.floor(i / NT);
    if (ws > 0) for (let k = 0; k < 3; k++) wts[i * 3 + k] /= ws; // weights sum to 1: no dark seams between photos
    alpha[i] = smooth(0.004, 0.08, Wt[i]) * smooth(0.0005, 0.01, ws) * smooth(0, 0.2, (NH - 1 - h) / NH);
  }
  // soften the outline: a ragged cut-out edge reads as fake, a soft one reads as a photo
  for (let pass = 0; pass < 3; pass++) {
    const a2 = alpha.slice();
    for (let h = 1; h < NH - 1; h++) for (let t = 1; t < NT - 1; t++) {
      const i = h * NT + t; if (alpha[i] <= 0) continue;
      a2[i] = Math.min(alpha[i], (alpha[i] * 4 + alpha[i - 1] + alpha[i + 1] + alpha[i - NT] + alpha[i + NT]) / 8);
    }
    alpha.set(a2);
  }
  return { NT, NH, pos, nor, uvs, wts, alpha, views: used, gains, fw, h0, h1, info, off: off.map((o) => Math.round(o)) };
}

// ---------- rendering ----------
const VS = `attribute vec2 uv0; attribute vec2 uv1; attribute vec2 uv2; attribute vec3 wts; attribute float alpha;
varying vec2 vU0; varying vec2 vU1; varying vec2 vU2; varying vec3 vW; varying float vA; varying vec3 vN;
void main() { vU0 = uv0; vU1 = uv1; vU2 = uv2; vW = wts; vA = alpha; vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2; uniform vec3 g0; uniform vec3 g1; uniform vec3 g2;
varying vec2 vU0; varying vec2 vU1; varying vec2 vU2; varying vec3 vW; varying float vA; varying vec3 vN;
void main() { if (vA < 0.03) discard;
  float s = vW.x + vW.y + vW.z + 1e-6;
  vec3 c = (vW.x * texture2D(t0, vU0).rgb * g0 + vW.y * texture2D(t1, vU1).rgb * g1 + vW.z * texture2D(t2, vU2).rgb * g2) / s;
  float sh = 0.86 + 0.14 * max(0.0, dot(normalize(vN), normalize(vec3(0.3, 0.35, 1.0))));
  gl_FragColor = vec4(c * sh, vA); }`;

export function mountHead(host, views, { autoTurn = true, built = null } = {}) {
  const B = built || buildHead(views);
  const { NT, NH, pos, nor, uvs, wts, alpha } = B, s3 = 2.6 / B.fw;
  console.info("[facetwin] 180 head", { views: B.views.length, info: B.info, offset: B.off });
  const P = new Float32Array(pos.length), Nn = new Float32Array(nor.length);
  for (let i = 0; i < pos.length; i += 3) { P[i] = pos[i] * s3; P[i + 1] = -pos[i + 1] * s3; P[i + 2] = pos[i + 2] * s3; Nn[i] = nor[i]; Nn[i + 1] = -nor[i + 1]; Nn[i + 2] = nor[i + 2]; }
  const idx = [];
  for (let h = 0; h < NH - 1; h++) for (let t = 0; t < NT - 1; t++) {
    const a = h * NT + t, b = a + 1, c = a + NT, d = c + 1;
    for (const [p, q, r] of [[a, c, b], [b, c, d]]) {
      if (Math.min(alpha[p], alpha[q], alpha[r]) < 0.01) continue;
      const rp = Math.hypot(pos[p * 3], pos[p * 3 + 2]), rq = Math.hypot(pos[q * 3], pos[q * 3 + 2]), rr = Math.hypot(pos[r * 3], pos[r * 3 + 2]);
      if (Math.max(rp, rq, rr) - Math.min(rp, rq, rr) > B.fw * 0.18) continue; // no stretched sheets across depth jumps
      idx.push(p, q, r);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(Nn, 3));
  const blank = new Float32Array(NT * NH * 2);
  geo.setAttribute("uv0", new THREE.BufferAttribute(uvs[0], 2));
  geo.setAttribute("uv1", new THREE.BufferAttribute(uvs[1] || blank, 2));
  geo.setAttribute("uv2", new THREE.BufferAttribute(uvs[2] || blank, 2));
  geo.setAttribute("wts", new THREE.BufferAttribute(wts, 3));
  geo.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
  geo.setIndex(idx);
  const texs = B.views.map((v) => { const t = new THREE.CanvasTexture(v.photo); t.flipY = false; t.anisotropy = 8; return t; });
  while (texs.length < 3) texs.push(texs[0]);
  const g = (k) => new THREE.Vector3(...(B.gains[k] || [1, 1, 1]));
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, side: THREE.DoubleSide,
    uniforms: { t0: { value: texs[0] }, t1: { value: texs[1] }, t2: { value: texs[2] }, g0: { value: g(0) }, g1: { value: g(1) }, g2: { value: g(2) } } });
  const mesh = new THREE.Mesh(geo, mat), scene = new THREE.Scene(); scene.add(mesh);

  const w = host.clientWidth || 360, h = host.clientHeight || 480;
  const cam = new THREE.PerspectiveCamera(26, w / h, 0.1, 100);
  const viewH = (B.h1 - B.h0) * s3, cy = -((B.h0 + B.h1) / 2) * s3, viewW = B.fw * 2.6 * s3;
  const dist = Math.max(viewH, viewW * (h / w)) / 2 / Math.tan((26 * Math.PI) / 360) * 1.04 + B.fw * 0.7 * s3;
  cam.position.set(0, cy, dist); cam.lookAt(0, cy, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h);
  const el = renderer.domElement; el.style.touchAction = "pan-y"; el.setAttribute("aria-label", "Your 180° 3D twin. Drag to turn it.");
  host.prepend(el);

  let yaw = 0, pitch = 0, tYaw = 0, tPitch = 0, drag = false, lx = 0, ly = 0, touched = !autoTurn, t0 = performance.now(), raf = 0, alive = true;
  const down = (e) => { drag = true; touched = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (!drag) return; tYaw = clamp(tYaw + (e.clientX - lx) / 140, -1.55, 1.55); tPitch = clamp(tPitch + (e.clientY - ly) / 300, -0.3, 0.3); lx = e.clientX; ly = e.clientY; };
  const up = () => { drag = false; };
  el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  const loop = (t) => {
    if (!alive) return; raf = requestAnimationFrame(loop);
    if (!touched) { tYaw = Math.sin((t - t0) / 2200) * 1.0; tPitch = Math.sin((t - t0) / 2900) * 0.05; }
    yaw += (tYaw - yaw) * 0.1; pitch += (tPitch - pitch) * 0.1;
    mesh.rotation.set(pitch, yaw, 0); renderer.render(scene, cam);
  };
  raf = requestAnimationFrame(loop);
  return {
    info: B.info,
    setView(y, p = 0) { touched = true; tYaw = yaw = y; tPitch = pitch = p; mesh.rotation.set(p, y, 0); renderer.render(scene, cam); },
    dispose() {
      alive = false; cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      geo.dispose(); mat.dispose(); texs.forEach((t) => t.dispose()); renderer.dispose(); el.remove();
    },
  };
}
