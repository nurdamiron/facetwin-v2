// FaceTwin MVP: one-page mobile web app. State lives in this browser only (localStorage).
import { CONFIG } from "./config.js";
import { CONCERNS, buildPlan, stepsForDay } from "./plans.js";
import * as V from "./vision.js";
import * as D from "./depth3d.js";
import { SHELF, TIERS } from "./shelf.js";
import { mountTwin3D, mountRelief, webglOK } from "./twin3d.js";
import { buildHead, mountHead } from "./head3d.js";
import { PREVIEWS, GROUPS, GLOW_GROUPS, previewById, promptFor, cleanIdea } from "./previews.js";
import { EXERCISES, exById, workoutFor, RepCounter } from "./exercises.js";
import { ico } from "./icons.js";
import { startIconPass } from "./iconpass.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $("#app");
const QS = new URLSearchParams(location.search);
const DEBUG = QS.has("debug");
const KEY = "facetwin.v1";
const KEY_ENT = "facetwin.ent"; // what she paid for, kept apart from the photos so a full or corrupted photo store can never take a purchase with it
const DAY = 864e5;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- waiting that never looks frozen ----------
// crawler: a progress value that always creeps forward (never backwards, never reaches 100 by itself) and jumps on real progress.
function crawler(render, { from = 0, to = 90, tau = 15000 } = {}) {
  let lo = from, hi = to, span = tau, pct = from, dead = false;
  const t00 = performance.now();
  let t0 = t00;
  const tick = () => {
    if (dead) return;
    const v = lo + (hi - lo) * (1 - Math.exp(-(performance.now() - t0) / span));
    if (v > pct) pct = v;
    render(pct, performance.now() - t00);
  };
  const id = setInterval(tick, 250); tick();
  return {
    band(a, b, ms = tau) { lo = Math.max(pct, a); hi = Math.max(lo + 1, b); span = ms; t0 = performance.now(); },
    real(v) { if (v > pct) pct = v; },
    stop() { dead = true; clearInterval(id); },
  };
}
const withTimeout = (promise, ms, what) => Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(what + " timed out")), ms))]);
async function fetchT(url, opts = {}, ms = 25000) { // fetch that gives up instead of waiting forever
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); }
  catch (e) { throw e.name === "AbortError" ? new Error("That took too long. Check your connection and try again.") : e; }
  finally { clearTimeout(timer); }
}
// Full-screen "working" layer for waits outside a screen of their own (opening Stripe, confirming a payment).
function waitScreen(title, sub) {
  hideWait();
  const d = document.createElement("div");
  d.className = "waitov"; d.id = "waitov"; d.setAttribute("role", "status");
  d.innerHTML = `<div class="spin"></div><b>${esc(title)}</b><div class="pbar"><i id="wbar"></i></div><span class="small" id="wsub">${esc(sub)}</span>`;
  document.body.appendChild(d);
  d._cr = crawler((p, ms) => {
    const b = $("#wbar"); if (b) b.style.width = p + "%";
    const s = $("#wsub"); if (s && ms > 8000) s.textContent = "Still working. Nothing is stuck, this can take a few more seconds.";
  }, { from: 6, to: 92, tau: 6000 });
}
function hideWait() { const d = $("#waitov"); if (d) { d._cr?.stop(); d.remove(); } }
addEventListener("pageshow", (e) => { if (e.persisted) hideWait(); }); // back from Stripe with the page restored from cache

// ---------------- state ----------------
const DEFAULT = {
  goal: null, looks: [], concerns: [], minutes: 5, email: "", consent: true,
  photos: {}, lms: {}, analysis: null, scans: [],
  applied: [], tried: [], saved: [],
  startedAt: null, freeStart: null, paid: null, billing: null, chosen: "twelve", waitlist: null,
  checks: {}, reminders: null, utm: {}, flags: {}, dayOffset: 0,
  shelf: { tier: "budget", own: {}, pick: {} },
  intensity: {}, customHair: "#7C4DFF",
  wants: [], previews: [], previewsUsed: 0,
  exLog: [], exSound: true,
  aiOk: false, aiOkAt: null, // consent to send a photo to the AI editor (asked before the first edit)
  owned: {}, // one-time add-ons she bought: { looks: 1, coach: 1 } (confirmed by /api/verify)
};
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { return {}; } };
let storageWarned = false;
let S = load();
function load() {
  const base = readJSON(KEY), ent = readJSON(KEY_ENT);
  const s = { ...structuredClone(DEFAULT), ...base };
  s.paid = base.paid || ent.paid || null; s.billing = base.billing || ent.billing || null; s.owned = { ...(ent.owned || {}), ...(base.owned || {}) };
  s.email = base.email || ent.email || ""; s.flags = { ...(base.flags || {}), ...(ent.glow ? { glow: 1 } : {}) };
  return s;
}
function save() {
  try { localStorage.setItem(KEY_ENT, JSON.stringify({ paid: S.paid, owned: S.owned, billing: S.billing, email: S.email, glow: S.flags.glow ? 1 : 0 })); } catch { /* tiny, but the quota can be zero */ }
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch (e) {
    S.previews.forEach((q, i) => { if (i > 0) delete q.hd; }); // storage full: first drop the older HD files
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch { /* keep trimming */ }
    // still full: keep only the first and the latest scan photos
    S.scans = S.scans.map((s, i) => (i === 0 || i === S.scans.length - 1 ? s : { ...s, img: null }));
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch { console.warn("[facetwin] storage full", e); }
    if (!storageWarned) { storageWarned = true; setTimeout(() => toast("Your phone's storage is full. Download your photo now: it won't be kept after you close the app."), 300); }
    return false;
  }
}

// ---------------- dates ----------------
const now = () => new Date(Date.now() + (S.dayOffset || 0) * DAY);
const pad = (n) => String(n).padStart(2, "0");
const dkey = (d = now()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysBetween = (a, b) => Math.round((sod(b) - sod(a)) / DAY);
const week = () => (S.startedAt ? Math.floor(daysBetween(new Date(S.startedAt), now()) / 7) + 1 : 1);
const freeDay = () => (S.freeStart ? daysBetween(new Date(S.freeStart), now()) + 1 : 0);
const LOCAL = /^(localhost|127.0.0.1|[::1])$/.test(location.hostname);
const testerOn = () => !!S.flags.tester && (CONFIG.ALLOW_TESTER || LOCAL || DEBUG); // team test switch: off on the public site unless allowed in config.js
const isPaid = () => !!S.paid || testerOn(); // tester mode = everything unlocked
// A Glow plan covers retouch + Studio. Looks (3D twin, hair/brows/beard looks) and Coach (plan, camera coach, re-scan) are one-time add-ons.
const owns = (item) => testerOn() || !!(S.owned && S.owned[item]);
const hasLooks = () => owns("looks");
const freeOver = () => !isPaid() && S.freeStart && freeDay() > CONFIG.FREE_DAYS;
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const latest = () => S.scans[S.scans.length - 1];
const plan = () => buildPlan({ concerns: S.concerns, minutes: S.minutes, analysis: latest()?.a || S.analysis, week: week() });
const todaySteps = (d = now()) => stepsForDay(plan(), d, !isPaid());
const doneOn = (k) => S.checks[k] || [];
function dayComplete(d) {
  const st = todaySteps(d).filter((s) => !s.locked);
  const done = doneOn(dkey(d));
  return st.length > 0 && st.every((s) => done.includes(s.id));
}
function streak() {
  let n = 0, d = now();
  if (!dayComplete(d)) d = new Date(d.getTime() - DAY);
  while (n < 400 && dayComplete(d) && (!S.startedAt || sod(d) >= sod(new Date(S.startedAt)))) { n++; d = new Date(d.getTime() - DAY); }
  return n;
}
const daysDone = () => Object.keys(S.checks).filter((k) => dayComplete(new Date(k + "T12:00:00"))).length;

// ---------------- tracking (Meta Pixel) ----------------
const STD = new Set(["ViewContent", "Lead", "CompleteRegistration", "InitiateCheckout", "StartTrial", "Subscribe", "Purchase", "AddToWishlist", "Contact"]);
function initPixel() {
  if (!CONFIG.META_PIXEL_ID) return;
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq("init", CONFIG.META_PIXEL_ID);
  window.fbq("track", "PageView");
}
function track(name, params = {}) {
  if (window.fbq) STD.has(name) ? window.fbq("track", name, params) : window.fbq("trackCustom", name, params);
  console.info("[track]", name, params);
  if (DEBUG && name !== "Screen") toast("Event: " + name);
}
function trackOnce(name, params) {
  if (S.flags["t_" + name]) return;
  S.flags["t_" + name] = 1; save(); track(name, params);
}
function postLead(extra = {}) {
  if (!CONFIG.LEAD_ENDPOINT || !S.email) return;
  const body = {
    email: S.email, consent: S.consent, goal: S.goal, looks: S.looks.join(","), concerns: S.concerns.join(","),
    minutes: S.minutes, face_shape: S.analysis?.shape || "", plan_choice: S.chosen, ...S.utm, ...extra,
  };
  fetch(CONFIG.LEAD_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) })
    .catch((e) => console.warn("[facetwin] lead", e));
}

// ---------------- ui helpers ----------------
const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="#F5F3F7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5F3F7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5F3F7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  arrow: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};
const backBtn = (to) => `<button class="back" aria-label="Back" ${to ? `data-go="${to}"` : 'data-act="back"'}>${ICON.back}</button>`;
const bar = (n, total = 6) => `<div class="bar" style="grid-template-columns:repeat(${total},1fr)">${Array.from({ length: total }, (_, i) => `<span class="${i < n ? "on" : ""}"></span>`).join("")}</div>`;
const topbar = (to, n, total) => `<div class="top">${backBtn(to)}${bar(n, total)}</div>`;
const wordmark = (size = 24) => `<span style="font-family:var(--h);font-weight:400;font-size:${Math.round(size * 1.3)}px;letter-spacing:-.01em;line-height:1">facetwin<span style="color:var(--p)">.</span></span>`;
const PASTEL = ["var(--peach)", "var(--lilac)", "var(--blue)", "var(--yel)", "var(--pink)", "var(--mint)"];

function faceArt({ w = 150, h = 180, hair = "long", haircol = "#4A2C20", skin = "#F1CDB3", glasses = null, gcol = "#1A1412", brows = false, lips = "#C2566A" } = {}) {
  const hairs = {
    long: `<path d="M40 120 C32 40 168 40 160 120 L164 220 L140 220 L146 130 C140 90 60 90 54 130 L60 220 L36 220 Z" fill="${haircol}"/><path d="M42 118 C36 52 164 52 158 118 C150 82 122 72 100 88 C78 72 50 82 42 118 Z" fill="${haircol}"/>`,
    bob: `<path d="M38 120 C30 40 170 40 162 120 L166 168 C150 172 150 150 146 140 C140 90 60 90 54 140 C50 150 50 172 34 168 Z" fill="${haircol}"/>`,
    none: "",
  };
  const g = !glasses ? "" : glasses === "square"
    ? `<rect x="60" y="104" width="40" height="32" rx="9" fill="none" stroke="${gcol}" stroke-width="5"/><rect x="104" y="104" width="40" height="32" rx="9" fill="none" stroke="${gcol}" stroke-width="5"/>`
    : glasses === "cateye"
      ? `<path d="M58 108 Q80 98 102 112 Q98 136 80 136 Q62 134 58 108Z M142 108 Q120 98 98 112 Q102 136 120 136 Q138 134 142 108Z" fill="none" stroke="${gcol}" stroke-width="5"/>`
      : `<circle cx="80" cy="120" r="18" fill="none" stroke="${gcol}" stroke-width="5"/><circle cx="120" cy="120" r="18" fill="none" stroke="${gcol}" stroke-width="5"/><path d="M98 118 h4" stroke="${gcol}" stroke-width="5"/>`;
  const b = brows ? `<path d="M66 102 Q80 92 94 100 M106 100 Q120 92 134 102" fill="none" stroke="#3A2318" stroke-width="8" stroke-linecap="round"/>` : "";
  return `<svg width="${w}" height="${h}" viewBox="0 0 200 240" aria-hidden="true"><rect x="84" y="180" width="32" height="60" fill="#E8B996"/><ellipse cx="100" cy="122" rx="58" ry="74" fill="${skin}"/>${hairs[hair]}${b}<circle cx="80" cy="120" r="4.5" fill="#1A1A22"/><circle cx="120" cy="120" r="4.5" fill="#1A1A22"/>${g}<path d="M86 160 Q100 170 114 160" fill="none" stroke="${lips}" stroke-width="${lips === "#C2566A" ? 5 : 8}" stroke-linecap="round"/></svg>`;
}
function lookArt(l, w = 90, h = 108) {
  if (l.custom) return `<span style="width:${w * 0.6}px;height:${w * 0.6}px;border-radius:50%;background:conic-gradient(#e74c3c,#f1c40f,#2ecc71,#3498db,#9b59b6,#e74c3c);display:block;border:4px solid #fff"></span>`;
  if (l.skin) return faceArt({ w, h, hair: "none", skin: l.sw, lips: l.skin === "blush" ? "#C2566A" : "#C2566A" });
  if (l.hair) return faceArt({ w, h, hair: "bob", haircol: l.hair });
  if (l.glasses) return faceArt({ w, h, hair: "none", glasses: l.glasses, gcol: l.sw });
  if (l.brows) return faceArt({ w, h, hair: "none", brows: true });
  if (l.lips) return faceArt({ w, h, hair: "none", lips: l.lips });
  return "";
}

let toastT = 0;
function toast(msg) {
  let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.append(t); }
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), 2600);
}
function sheet(html) {
  const bg = document.createElement("div");
  bg.className = "sheet-bg";
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-close]")) bg.remove(); else if (e.target.closest("[data-go]")) bg.remove(); });
  document.body.append(bg);
}

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
function toCanvas(img, maxW = 99999) {
  const s = Math.min(1, maxW / (img.naturalWidth || img.width));
  const c = document.createElement("canvas");
  c.width = Math.round((img.naturalWidth || img.width) * s); c.height = Math.round((img.naturalHeight || img.height) * s);
  c.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
  return c;
}
async function fileToDataURL(file, maxW) {
  const url = URL.createObjectURL(file);
  try { const img = await loadImg(url); return toCanvas(img, maxW).toDataURL("image/jpeg", 0.86); }
  finally { URL.revokeObjectURL(url); }
}
async function shrink(dataUrl, maxW) { return toCanvas(await loadImg(dataUrl), maxW).toDataURL("image/jpeg", 0.85); }
function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------------- router ----------------
const R = {};
let cleanup = [];
let lastRoute = "";
const ui = { angle: "front", ai: null, prevSel: null, busy: false, before: false, cat: "Hair", shareTags: ["#glowup", "#facetwin", "#skincareroutine"], hideEyes: true, plan: null };
function go(path) { if (location.hash === "#/" + path) render(); else location.hash = "#/" + path; }
function render() {
  cleanup.forEach((f) => { try { f(); } catch { /* ignore */ } });
  cleanup = [];
  $$(".sheet-bg").forEach((n) => n.remove());
  let [name, arg] = location.hash.replace(/^#\/?/, "").split("/");
  if (!name) name = S.photos.front && S.startedAt ? homeFor() : "landing";
  let r = R[name];
  if (!r) { name = "landing"; r = R.landing; }
  if (r.needs && !S.photos.front) { name = "landing"; r = R.landing; }
  if (r.app && !S.startedAt && !(r.glowOk && S.flags.glow)) {
    if (S.flags.glow && isPaid()) { go(S.owned.coach ? "goal" : "up/coach"); return; } // Glow subscriber: Coach offer / onboarding, not the Glow paywall again
    name = "paywall"; r = R.paywall;
  }
  const entering = name !== lastRoute; lastRoute = name;
  app.innerHTML = r.view(arg) + (r.tab && S.startedAt ? tabbar(r.tab) : "") + (testerOn() ? `<div style="position:fixed;top:0;left:50%;transform:translateX(-50%);background:var(--yel);color:var(--ink);font-size:11px;font-weight:800;padding:3px 10px;border-radius:0 0 10px 10px;z-index:40">TESTER MODE · all unlocked</div>` : "");
  if (entering) app.firstElementChild?.classList.add("enter");
  window.scrollTo(0, 0);
  track("Screen", { screen: name });
  if (r.mount) Promise.resolve(r.mount(arg)).catch((e) => { console.error(e); toast("Something went wrong. Try again."); });
}
const tabbar = (on) => `<nav class="tabbar" aria-label="Main">${[["coach", "Exercise"], ["preview", "Looks"], ["progress", "Progress"]].map(([k, l]) => `<button class="${k === on ? "on" : ""}" data-go="${k}">${l}</button>`).join("")}</nav>`;

const ACT = {};
app.addEventListener("click", (e) => {
  const t = e.target.closest("[data-go],[data-act]");
  if (!t || t.disabled) return;
  e.__ft = true;
  if (t.dataset.go) { e.preventDefault(); go(t.dataset.go); return; }
  const fn = ACT[t.dataset.act];
  if (fn) { e.preventDefault(); fn(t.dataset.v, t, e); }
});
document.body.addEventListener("click", (e) => {
  if (e.__ft || app.contains(e.target)) return;
  const t = e.target.closest("[data-go],[data-act]");
  if (!t) return;
  if (t.dataset.go) { go(t.dataset.go); return; }
  const fn = ACT[t.dataset.act]; if (fn) fn(t.dataset.v, t, e);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".sheet-bg").forEach((n) => n.remove()); });
ACT.back = () => (history.length > 1 ? history.back() : go(""));

// =============== V2: GLOW (the landing is the editor) ===============
const GLOW_FEATURES = [["clearskin", "Acne & spots"], ["undereye", "Under-eye bags"], ["wrinkles", "Wrinkles"], ["teeth", "Teeth"], ["frecklesOn", "Freckles"], ["glow", "Glow"]];
const HOW = [["upload", "Upload a selfie", "Or try a demo face"], ["onetap", "Pick a retouch", "One tap, about 10 seconds"], ["compare", "Compare, then save", "Drag to see before and after"]];
const EXAMPLES = [["skin", "Skin"], ["under", "Under-eyes"], ["smile", "Smile"], ["freckles", "Freckles"], ["glow", "Glow"]];
const exampleHTML = (k) => compareHTML(`assets/examples/${k}-before.jpg`, `assets/examples/${k}-after.jpg`, "Before", "After", "60vh");
ACT.exSel = (k) => {
  const box = $("#exBox"); if (!box) return;
  box.innerHTML = exampleHTML(k);
  $$('[data-act="exSel"]').forEach((b) => b.classList.toggle("on", b.dataset.v === k));
  track("ExampleViewed", { example: k });
};
R.landing = {
  view: () => `<div class="scr land">
    <div class="top">${wordmark()}${S.photos.front ? `<button class="pill chip" data-go="preview">My edits</button>` : `<span class="pill dark">${ico("shield", 14)} Private by design</span>`}</div>
    <div class="hero">
      <h1 class="h1 xl">Fix your selfie <span class="hl">in one tap</span></h1>
      <p class="sub">Natural retouch that still looks like you. Real skin texture, no filter look. See the before and after in seconds.</p>
    </div>
    <label class="cta inline" style="cursor:pointer;text-align:center">${ico("camera", 24)} Upload a selfie<input type="file" accept="image/*" hidden id="glowUpl"></label>
    <p class="small center" style="margin-top:-6px">${ico("shield", 14)} 2 free edits · no sign-up · your photo stays in this browser until you tap Show me</p>
    <button class="link p" data-act="glowDemo" style="margin-top:-6px">No selfie handy? Try a demo face</button>
    <div id="exBox" class="ex">${exampleHTML("skin")}</div>
    <div class="scroll-x">${EXAMPLES.map(([k, l], i) => `<button class="chip sm ${i === 0 ? "on" : ""}" data-act="exSel" data-v="${k}">${l}</button>`).join("")}</div>
    <p class="small center" style="margin-top:-6px">Example results. Yours depend on your photo and the light.</p>
    <div class="feat">${GLOW_FEATURES.map(([ic, name], i) => `<div class="feat-i"><span class="tbub sm" style="--tc:${TINT[i % TINT.length]}">${ico(ic, 24)}</span><span>${name}</span></div>`).join("")}</div>
    <div class="how">${HOW.map(([ic, t, s], i) => `<div class="how-i"><span class="how-n">${ico(ic, 22)}</span><span><b>${t}</b><small>${s}</small></span></div>`).join("")}</div>
    <div class="trust">${ico("shield", 22)}<p class="small">Your photo goes to an AI editor only when you tap Show me, and only with your OK. We don't store it. Face care, not medical advice.</p></div>
    <p class="small center"><a href="privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms</a></p>
  </div>`,
  mount: () => bindGlowUpload(),
};
function bindGlowUpload() {
  const inp = $("#glowUpl"); if (!inp) return;
  inp.addEventListener("change", async () => {
    const f = inp.files && inp.files[0]; inp.value = ""; if (!f) return; // reset so the same file can be chosen again
    if (f.type && !/^image\//.test(f.type)) { track("BadPhoto", { reason: "type" }); return toast("That isn't a photo. Choose a JPG or PNG selfie."); }
    if (f.size > 40e6) { track("BadPhoto", { reason: "size" }); return toast("That photo is too big. Choose one under 40 MB."); }
    toast("Reading your photo…"); track("PhotoUploaded", { mode: "glow" });
    let url;
    try { url = await fileToDataURL(f, 1024); }
    catch { track("BadPhoto", { reason: "unreadable" }); return toast("We couldn't open that photo. Try a JPG or PNG (on iPhone: Camera settings, Formats, Most Compatible)."); }
    await useGlowPhoto(url, "upload");
  });
}
async function useGlowPhoto(url, source) {
  try {
    await V.loadFace();
    if (!V.detect(await loadImg(url))) { track("NoFace", { source }); return toast("We couldn't find a face. Try a clear, front-facing selfie."); }
    if (V.lastFaceCount > 1) { track("BadPhoto", { reason: "several_faces" }); return toast("We see more than one face. Use a photo with only you in it."); }
  }
  catch (e) { console.warn("[facetwin] face check skipped", e); }
  S.photos = { front: url }; S.lms = {}; S.depth = null; S.depthSide = {}; ui.head = null;
  ui.prevSel = "onetap"; ui.prevGroup = "Glow"; ui.prevKey = null; ui.base = null;
  S.goal = S.goal || "look"; S.flags.glow = 1; save();
  trackOnce("FunnelStart"); trackOnce("SelfiesDone", { source, photos: 1 }); go("preview");
}
ACT.glowDemo = async () => {
  try { toast("Loading the demo face…"); const b = await (await fetch("assets/demo/glow.jpg")).blob(); track("DemoFace"); await useGlowPhoto(await fileToDataURL(b, 1024), "demo"); }
  catch (e) { console.error(e); toast("The demo face didn't load"); }
};

// =============== ONBOARDING (V1: the 3D twin flow) ===============
R.meet3d = {
  view: () => `<div class="scr">
    <div class="top">${wordmark()}${S.startedAt ? `<button class="pill chip" data-go="coach">Open my app</button>` : S.photos.front ? `<button class="pill chip" data-go="twin">My report</button>` : ""}</div>
    <h1 class="h1 xl">Meet your <span class="hl">3D twin</span></h1>
    <div class="grid2" style="flex:1;min-height:0">
      <div class="col" style="gap:10px">
        <div class="tile" style="height:220px;background:var(--peach);justify-content:center;align-items:flex-end;padding:0">${faceArt({ w: 150, h: 180, glasses: "round" })}<span class="pill dark" style="position:absolute;top:12px;left:12px">Round frames</span></div>
        <div class="tile" style="height:160px;background:var(--blue);justify-content:center;align-items:flex-end;padding:0">${faceArt({ w: 120, h: 144, hair: "bob", haircol: "#C9974F", skin: "#E2B08E" })}<span class="pill dark" style="position:absolute;top:12px;left:12px">Honey blonde</span></div>
      </div>
      <div class="col" style="gap:10px">
        <div class="tile" style="height:150px;background:var(--lilac);justify-content:center;align-items:flex-end;padding:0">${faceArt({ w: 110, h: 132, hair: "bob", haircol: "#B4532A", skin: "#E2B08E", brows: true })}<span class="pill dark" style="position:absolute;top:12px;left:12px">Copper</span></div>
        <div class="tile" style="height:230px;background:var(--p);color:#fff;flex-direction:column;align-items:flex-start;justify-content:space-between;padding:16px">
          <span style="font-size:12px;letter-spacing:.12em;text-transform:uppercase">Your twin</span>
          <span style="font-family:var(--h);font-size:23px;line-height:1.05">A realistic 3D you, from one selfie.</span>
          <span style="font-size:13px;font-weight:700">Try new hair and looks on it, in 3D</span>
        </div>
      </div>
    </div>
    <button class="cta inline" data-act="start">See it on me ${ICON.arrow}</button>
    <button class="link" data-act="demoFace">Try it with a demo face (3 photos, 180° twin)</button>
    <p class="small center">Face care, not medical advice · the face scan runs on your phone; a photo goes to the AI only when you ask for an edit, with your OK</p>
  </div>`,
};
ACT.start = () => { trackOnce("FunnelStart"); setTimeout(() => D.loadDepth().catch(() => {}), 800); go("goal"); };

const GOALS = [
  ["jaw", "Sharper jawline", "Face exercises with a live camera coach", "var(--lilac)"],
  ["look", "Try a new look", "Hair, braids, brows or beard before I commit", "var(--peach)"],
  ["skin", "Better skin", "Glow, texture, a routine that sticks", "var(--mint)"],
  ["twin", "See myself in 3D", "My face from every side", "var(--blue)"],
];
const homeFor = () => (S.goal === "look" ? "preview" : S.goal === "skin" ? "today" : "coach");
R.goal = {
  view: () => `<div class="scr">${topbar("meet3d", 1)}
    <h1 class="h1">What brings you <span class="hl">here?</span></h1>
    <p class="sub">Pick one. We'll shape your twin and plan around it.</p>
    <div class="col">${GOALS.map(([id, t, s, bg]) => `<button class="opt ${S.goal === id ? "on" : ""}" style="background:${bg}" data-act="goal" data-v="${id}"><span class="t"><b>${t}</b><small>${s}</small></span><span class="dot">${S.goal === id ? "✓" : ""}</span></button>`).join("")}</div>
    <button class="cta" data-act="goalNext" ${S.goal ? "" : "disabled"}>Continue</button></div>`,
};
ACT.goal = (v) => { S.goal = v; save(); render(); };
ACT.goalNext = () => { trackOnce("QuizStart", { goal: S.goal }); go("looks"); };

R.looks = {
  view: () => `<div class="scr">${topbar("goal", 2)}
    <h1 class="h1">What would you like <span class="hl">to see on you?</span></h1>
    <p class="sub">Pick up to 3. We'll show them realistically on your own face, in 3D.</p>
    <div class="grid2">${PREVIEWS.filter((p) => p.pick).map((p, i) => {
      const on = S.wants.includes(p.id);
      return tile(p.icon, p.name, { on, i, attrs: `data-act="pickWant" data-v="${p.id}"` });
    }).join("")}</div>
    <button class="cta" data-act="looksNext" ${S.wants.length ? "" : "disabled"}>${S.wants.length ? `${S.wants.length} picked · next` : "Pick at least 1"}</button></div>`,
};
ACT.pickWant = (v) => {
  if (S.wants.includes(v)) S.wants = S.wants.filter((x) => x !== v);
  else if (S.wants.length < 3) S.wants.push(v);
  else return toast("Up to 3. Tap one to swap it.");
  save(); render();
};
ACT.looksNext = () => go("skin");

R.skin = {
  view: () => `<div class="scr">${topbar("looks", 3)}
    <h1 class="h1">Tell us about <span class="hl">your skin</span></h1>
    <p class="sub">Choose all that apply. Your scan adds what it sees too.</p>
    <div class="wrap">${CONCERNS.map((c) => `<button class="chip ${S.concerns.includes(c.id) ? "on" : ""}" data-act="concern" data-v="${c.id}">${c.label}${S.concerns.includes(c.id) ? " ✓" : ""}</button>`).join("")}</div>
    <div class="card"><b style="font-size:15px">How much time do you have each day?</b>
      <div class="seg">${[2, 5, 10].map((m) => `<button class="${S.minutes === m ? "on" : ""}" data-act="minutes" data-v="${m}">${m} min</button>`).join("")}</div></div>
    <button class="cta" data-act="skinNext">Continue</button></div>`,
};
ACT.concern = (v) => { S.concerns = S.concerns.includes(v) ? S.concerns.filter((x) => x !== v) : [...S.concerns, v]; save(); render(); };
ACT.minutes = (v) => { S.minutes = +v; save(); render(); };
// She already gave a photo in the Glow editor: build the report from it instead of asking for selfies again.
ACT.skinNext = () => { trackOnce("QuizComplete", { goal: S.goal, concerns: S.concerns.length, minutes: S.minutes }); go(S.photos.front ? "building" : "permission"); };

R.permission = {
  view: () => `<div class="scr">${topbar("skin", 5)}
    <div class="photo" style="height:250px;background:var(--lilac);display:flex;align-items:center;justify-content:center">
      <svg width="130" height="130" viewBox="0 0 24 24" fill="none" stroke="#0E0E14" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="4"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>
      <span class="tl"><span class="pill dark">Private by design</span></span></div>
    <h1 class="h1">3 selfies, <span class="hl">kept on your phone</span></h1>
    <div class="col" style="font-size:14px;font-weight:700">
      <div class="top" style="justify-content:flex-start"><span class="dot on">✓</span>The face scan runs on your phone. A photo goes to the AI only when you ask for an edit, with your OK.</div>
      <div class="top" style="justify-content:flex-start"><span class="dot on">✓</span>Delete your photos and twin anytime in Privacy.</div>
      <div class="top" style="justify-content:flex-start"><span class="dot on">✓</span>Best in daylight, no glasses, hair off your face.</div>
    </div>
    <button class="cta" data-go="selfie">Allow camera</button>
    <label class="link">Upload 1–3 photos instead (front + sides)<input type="file" accept="image/*" hidden id="upl"></label></div>`,
  mount: () => bindUpload("#upl", "onboard"),
};

function bindUpload(sel, mode) {
  const inp = $(sel); if (!inp) return;
  if (mode !== "scan") inp.multiple = true;
  inp.addEventListener("change", async () => {
    const files = [...(inp.files || [])].slice(0, 3); if (!files.length) return;
    toast(files.length > 1 ? `Reading your ${files.length} photos…` : "Reading your photo…");
    if (mode === "scan") { const data = await fileToDataURL(files[0], 480); track("PhotoUploaded", { mode }); if (await addScan(data)) go("scanresult"); return; }
    const urls = []; for (const f of files) urls.push(await fileToDataURL(f, 720));
    track("PhotoUploaded", { mode, photos: urls.length });
    await usePhotoSet(urls, "upload");
  });
}
// 1–3 photos of one face: the straightest one becomes the front, the others the two sides.
async function usePhotoSet(urls, source) {
  let set = urls.map((url) => ({ url }));
  if (set.length > 1) {
    await V.loadFace();
    for (const p of set) { const lm = V.detect(await loadImg(p.url)); p.lm = lm; p.yaw = lm ? (lm[1][0] - lm[234][0]) / (lm[454][0] - lm[234][0]) - 0.5 : 9; }
    set = set.filter((p) => p.lm).sort((a, b) => Math.abs(a.yaw) - Math.abs(b.yaw));
    if (!set.length) { toast("We couldn't find a face in these photos"); return; }
  }
  const [front, ...sides] = set;
  S.photos = { front: front.url }; S.lms = {}; S.depth = null; S.depthSide = {}; ui.head = null;
  sides.sort((a, b) => b.yaw - a.yaw).forEach((p, i) => { const k = i === 0 ? "left" : "right"; S.photos[k] = p.url; S.lms[k] = p.lm; });
  save(); trackOnce("SelfiesDone", { source, photos: set.length }); go("building");
}
async function loadDemoFace() {
  toast("Loading the demo face…");
  const urls = [];
  for (const n of ["front", "left", "right"]) { const b = await (await fetch(`assets/demo/${n}.jpg`)).blob(); urls.push(await fileToDataURL(b, 720)); }
  track("DemoFace"); if (!S.goal) S.goal = "look"; await usePhotoSet(urls, "demo");
}
ACT.demoFace = () => loadDemoFace().catch((e) => { console.error(e); toast("The demo face didn't load"); });

async function mountCamera(mode) {
  bindUpload("#upl", mode);
  const poses = mode === "scan" ? ["front"] : ["front", "side1", "side2"];
  const shots = {};
  let i = 0, side = 0, good = 0, alive = true, stream = null;
  cleanup.push(() => { alive = false; stream && stream.getTracks().forEach((t) => t.stop()); });
  const video = $("#cam"), hint = $("#hint"), ring = $("#ringp");
  const setHint = (m, ok) => { if (!hint) return; hint.textContent = m; hint.style.background = ok ? "var(--p)" : "var(--chip)"; };
  setHint("Loading face AI…");
  try { await V.loadFace(); } catch (e) { setHint("Face AI didn't load. Check your connection."); return; }
  if (!alive) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false });
  } catch (e) {
    track("CameraDenied", { reason: e.name });
    setHint("Camera is blocked");
    $("#snote").innerHTML = `<span class="err">Allow the camera in your browser settings, or upload a photo below.</span>`;
    return;
  }
  if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
  video.srcObject = stream;
  await video.play().catch(() => {});
  trackOnce("CameraAllowed");

  const updateUI = () => {
    const s = $("#sstep"), t = $("#stitle");
    if (mode !== "scan") {
      s.textContent = `Selfie ${Math.min(i + 1, 3)} of 3`;
      t.innerHTML = i === 0 ? `Look straight <span class="hl">at the camera</span>` : i === 1 ? `Now turn a little <span class="hl">to one side</span>` : `And the <span class="hl">other side</span>`;
      Object.entries(shots).forEach(([k]) => { const n = $(`[data-th="${poses.indexOf(k)}"]`); if (n) { n.style.backgroundImage = `url(${shots[k]})`; n.style.color = "#fff"; n.textContent = "✓"; } });
      const cur = $(`[data-th="${i}"]`); if (cur) cur.style.outline = "3px solid var(--p)";
      $("#skipside")?.classList.toggle("hidden", i === 0);
    }
  };
  updateUI();

  const snap = () => {
    const maxW = mode === "scan" ? 480 : 720, s = Math.min(1, maxW / video.videoWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(video.videoWidth * s); c.height = Math.round(video.videoHeight * s);
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.86);
  };
  const finish = async () => {
    alive = false; stream.getTracks().forEach((t) => t.stop());
    if (mode === "scan") { if (await addScan(shots.front)) go("scanresult"); else render(); return; }
    S.photos = { front: shots.front }; if (shots.side1) S.photos.left = shots.side1; if (shots.side2) S.photos.right = shots.side2;
    S.lms = {}; save();
    trackOnce("SelfiesDone", { source: "camera", photos: Object.keys(S.photos).length });
    go("building");
  };
  const capture = () => {
    shots[poses[i]] = snap(); i++;
    app.animate?.([{ filter: "brightness(1.6)" }, { filter: "none" }], { duration: 250 });
    good = 0; ring.style.strokeDashoffset = 100;
    if (i >= poses.length) finish(); else updateUI();
  };
  $("#shutter").onclick = () => { if (!V.detect(video)) return toast("We can't see your face yet"); capture(); };
  const skip = $("#skipside"); if (skip) skip.onclick = () => finish();

  let last = 0;
  const loop = (t) => {
    if (!alive) return;
    requestAnimationFrame(loop);
    if (t - last < 170 || video.readyState < 2) return;
    last = t;
    const lm = V.detect(video), q = V.quality(video, lm), pose = poses[i];
    let msg, ok = false;
    const dark = q.brightness < 55;
    $("#dark")?.classList.toggle("hidden", !dark);
    if (dark) msg = "Too dark";
    else if (!lm) msg = "Fit your face in the oval";
    else if (q.size < 0.28) msg = "Move a little closer";
    else if (q.sharp < 12) msg = "Hold still…";
    else if (pose === "front") { ok = Math.abs(q.yaw) < 0.1; msg = ok ? "Perfect, hold still" : "Look straight at the camera"; }
    else if (pose === "side1") { ok = Math.abs(q.yaw) > 0.18; if (ok) side = Math.sign(q.yaw); msg = ok ? "Nice, hold it" : "Turn your head a little"; }
    else { ok = Math.abs(q.yaw) > 0.18 && Math.sign(q.yaw) === -side; msg = ok ? "Nice, hold it" : "Now turn the other way"; }
    good = ok ? good + 1 : 0;
    ring.style.strokeDashoffset = 100 - Math.min(100, good * 20);
    setHint(msg, ok);
    if (good >= 5) capture();
  };
  requestAnimationFrame(loop);
}
// Camera screen for the 3 onboarding selfies (mode "onboard") and the weekly re-scan (mode "scan").
// mountCamera() fills it in: #cam video, #ringp progress ring, #hint, #dark, #shutter, #skipside, #snote, #upl, thumbs [data-th].
function selfieView(mode) {
  const scan = mode === "scan";
  return `<div class="scr">
    <div class="top">${backBtn(scan ? "progress" : "permission")}<span class="pill chip" id="sstep">${scan ? "Weekly re-scan" : "Selfie 1 of 3"}</span><span class="spacer"></span></div>
    <h1 class="h1" id="stitle">${scan ? `Same light, same angle <span class="hl">as last time</span>` : `Look straight <span class="hl">at the camera</span>`}</h1>
    <div class="photo" style="aspect-ratio:3/4;max-height:54vh;background:#000">
      <video id="cam" playsinline muted autoplay style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
      <svg class="ring" viewBox="0 0 100 133" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <ellipse cx="50" cy="62" rx="33" ry="43" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2" stroke-dasharray="3 3"/>
        <ellipse id="ringp" cx="50" cy="62" rx="33" ry="43" fill="none" stroke="#7C4DFF" stroke-width="2.6" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 50 62)"/>
      </svg>
      <span class="pill" id="hint" style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);white-space:nowrap">Loading face AI…</span>
      <div id="dark" class="hidden" style="position:absolute;inset:0;background:rgba(14,14,20,.55);display:flex;align-items:center;justify-content:center"><b>Too dark. Face a window or a lamp.</b></div>
    </div>
    ${scan ? "" : `<div class="row" style="justify-content:center;gap:10px">${[0, 1, 2].map((i) => `<span data-th="${i}" style="width:46px;height:58px;border-radius:12px;background:var(--card) center/cover;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:var(--muted)">${["front", "side", "side"][i]}</span>`).join("")}</div>`}
    <button class="cta" id="shutter" aria-label="Take photo">Take photo</button>
    ${scan ? "" : `<button class="link hidden" id="skipside">Skip the side photos</button>`}
    <div id="snote" class="small center"></div>
    <label class="link" style="cursor:pointer;text-align:center">${scan ? "Upload a photo instead" : "Upload 1-3 photos instead"}<input type="file" accept="image/*" hidden id="upl"></label>
  </div>`;
}
R.selfie = { view: () => selfieView("onboard"), mount: () => { if (hasLooks()) D.loadDepth().catch(() => {}); return mountCamera("onboard"); } }; // the 3D AI downloads while she takes the selfie

// ---------- build the twin ----------
R.building = {
  needs: true,
  view: () => `<div class="scr" style="align-items:center">
    <span class="pill chip">Almost there</span>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px">
      <div id="bring" class="alive" style="width:240px;height:240px;border-radius:50%;background:conic-gradient(var(--p) 0 5%,var(--line) 5% 100%);display:flex;align-items:center;justify-content:center">
        <div style="width:210px;height:210px;border-radius:50%;overflow:hidden;background:var(--peach)"><img src="${S.photos.front}" alt="" style="width:100%;height:100%;object-fit:cover"></div></div>
      <div class="center"><div id="bpct" style="font-family:var(--h);font-size:44px;font-weight:800">5%</div><div style="font-weight:700">Building your 3D twin</div><div id="bmsg" class="small" style="margin-top:6px;min-height:20px">Reading your face…</div></div>
    </div>
    <div class="col" style="width:100%">${["Mapping 478 points of your face", "Building your realistic 3D twin", "Writing your face report"].map((t, i) => `<div class="row" id="bs${i}"><span><b>${t}</b><small>Waiting</small></span><span class="r">…</span></div>`).join("")}</div>
    <p class="small center" id="bhint" style="min-height:34px">Your face data is processed in this browser.</p></div>`,
  mount: runBuild,
};
function setBuild(pct, step, state) {
  const r = $("#bring"); if (!r) return;
  r.style.background = `conic-gradient(var(--p) 0 ${pct}%,var(--line) ${pct}% 100%)`;
  $("#bpct").textContent = pct + "%";
  if (step != null) {
    const row = $("#bs" + step);
    row.querySelector("small").textContent = state === "done" ? "Done" : "Working on it";
    row.querySelector(".r").textContent = state === "done" ? "✓" : "…";
    row.style.backgroundColor = state === "done" ? "var(--card)" : "var(--p)";
    row.classList.toggle("live", state !== "done");
  }
}
async function runBuild() {
  const MSGS = {
    face: ["Reading your face…", "Finding the outline of your face…", "Mapping the points…"],
    dl: ["Getting the 3D AI ready…", "This part is only slow the first time…", "Downloading, nothing is stuck…"],
    lift: ["Lifting your photo into 3D…", "Working out depth for your hair and neck…", "Smoothing the shape…", "Joining the pieces…"],
    report: ["Writing your face report…", "Measuring your proportions…", "Last touches…"],
  };
  let msgs = MSGS.face, t3d = 0;
  const cr = crawler((p, ms) => {
    setBuild(Math.round(p));
    const m = $("#bmsg"); if (m) m.textContent = msgs[Math.floor(ms / 3200) % msgs.length];
    const h = $("#bhint"); if (!h) return;
    const s3 = t3d ? performance.now() - t3d : 0;
    if (s3 > 45000) h.textContent = "Slow connection. Still going, nothing is stuck.";
    else if (s3 > 12000) h.textContent = "First time can take up to a minute. Keep this page open.";
  }, { from: 5, to: 38, tau: 2500 });
  try {
    setBuild(8, 0, "work");
    await withTimeout(V.loadFace(), 45000, "Face model");
    const front = await loadImg(S.photos.front);
    const lm = V.detect(front);
    if (!lm) { cr.stop(); S.flags.fail = "front"; save(); track("TwinFailed", { reason: "no_face" }); go("twinfailed"); return; }
    S.lms = { front: lm };
    const a = V.analyze(toCanvas(front, 480), lm);
    S.analysis = a;
    cr.real(40); setBuild(40, 0, "done"); setBuild(45, 1, "work");
    msgs = MSGS.dl; t3d = performance.now(); cr.band(45, 62, 30000);
    for (const k of ["left", "right"]) {
      if (!S.photos[k]) continue;
      const l2 = V.detect(await loadImg(S.photos[k]));
      if (l2) S.lms[k] = l2; else delete S.photos[k];
    }
    const small = await shrink(S.photos.front, 480);
    S.scans = [{ date: dkey(), img: small, a, lm }];
    D.onDepthProgress((p, got, total) => {
      const el = $("#bs1 small"); if (!el) return;
      if (p < 1) el.textContent = `Downloading the 3D AI (first time only) · ${Math.round(got / 1048576)} of ${Math.round(total / 1048576)} MB`;
      cr.real(45 + p * 17);
    });
    const sm = $("#bs1 small");
    try {
      const dl = D.loadDepth();
      await withTimeout(dl, 150000, "3D AI download");
      msgs = MSGS.lift; cr.band(62, 70, 9000);
      if (sm) sm.textContent = "Lifting your photo into 3D…";
      const dep = await withTimeout(D.estimateDepth(front), 90000, "3D lift");
      S.depth = D.depthToDataURL(dep);
      track("Twin3DBuilt");
      if (S.lms.left || S.lms.right) { if (sm) sm.textContent = "Joining your 3 selfies into a 180° twin…"; await withTimeout(ensureSideDepth(), 90000, "Side views"); }
    } catch (e) {
      console.warn("[facetwin] 3D build", e); S.depth = null; track("Twin3DFailed");
      if (sm) sm.textContent = "Skipping the 3D lift. Your twin still works."; // never leave her waiting on a step that is stuck
    }
    t3d = 0; msgs = MSGS.report; cr.real(70); setBuild(70, 1, "done"); setBuild(72, 2, "work"); cr.band(72, 98, 3000);
    S.measures = { ...measures(lm, front.naturalWidth, front.naturalHeight), v3: 1 };
    await sleep(900);
    save();
    cr.stop(); setBuild(100, 2, "done");
    const m = $("#bmsg"); if (m) m.textContent = "Ready!";
    await sleep(600);
    go(S.startedAt ? homeFor() : "twin"); // a Coach buyer goes straight into her app
  } catch (e) {
    cr.stop(); console.warn("[facetwin] build", e); track("TwinFailed", { reason: "error" });
    toast("Something slowed down on our side. Let's try your photo again.");
    go("twinfailed");
  }
}
function defaultLooks() {
  const out = [], cats = new Set();
  for (const id of S.looks) {
    const l = V.lookById(id); if (!l || cats.has(l.cat)) continue;
    if (l.hair && !V.hairReady()) continue;
    out.push(id); cats.add(l.cat);
    if (out.length === 2) break;
  }
  if (!out.length) out.push("round");
  return out;
}

R.twinfailed = {
  view: () => `<div class="scr"><div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px">
    <div style="width:170px;height:170px;border-radius:50%;background:var(--pink);display:flex;align-items:flex-end;justify-content:center;overflow:hidden">
      <svg width="130" height="156" viewBox="0 0 200 240" aria-hidden="true"><ellipse cx="100" cy="122" rx="58" ry="74" fill="none" stroke="#0E0E14" stroke-width="5" stroke-dasharray="14 10"/><path d="M80 120 h1 M120 120 h1" stroke="#0E0E14" stroke-width="9" stroke-linecap="round"/><path d="M86 166 Q100 156 114 166" fill="none" stroke="#0E0E14" stroke-width="5" stroke-linecap="round"/></svg></div>
    <h1 class="h1">We couldn't find <span class="hl">your face</span> this time</h1>
    <p class="sub">Usually it's light, blur or a photo cut at the edge. It's the photo, not you.</p>
    <div class="col"><div class="row"><span><b>Face the light</b><small>A window in front of you works best</small></span><span class="r">☀️</span></div>
      <div class="row"><span><b>Whole face in the frame</b><small>Forehead to chin, no sunglasses</small></span><span class="r">✓</span></div></div></div>
    <button class="cta inline" data-go="selfie">Retake</button>
    <label class="link">Upload a different photo<input type="file" accept="image/*" hidden id="upl"></label></div>`,
  mount: () => bindUpload("#upl", "onboard"),
};

// ---------- twin (aha) ----------
const angles = () => ["front", "left", "right"].filter((k) => S.photos[k] && S.lms[k]);
const HAS3D = webglOK();
const views = () => (HAS3D && S.lms.front ? ["3d"] : []).concat(angles());
const viewName = (k) => ({ "3d": "3D twin", front: "Front", left: "Side 1", right: "Side 2" }[k]);
// The big picture on Twin and Try on: the rotating 3D face, or one of the 3 photos.
function stageHTML(minH, extra = "") {
  const v = views(), is3d = ui.angle === "3d";
  const hairOn = S.applied.some((id) => V.lookById(id)?.hair);
  return `<div class="photo" id="stage" style="aspect-ratio:3/4;max-height:${minH};${is3d ? "background:radial-gradient(circle at 50% 38%,#2b2440,#0E0E14 72%)" : ""}">
      ${is3d ? "" : `<canvas id="cv" aria-label="Your photo with looks applied"></canvas>`}
      <span class="tl"><span class="pill dark">${is3d ? (hasSides() ? "Your 180° twin" : "Your 3D twin") : esc(looksOn().join(" + ") || "Your photo")}</span></span>
      <span class="tr"><span class="pill">${looksOn().length} looks on</span></span>
      ${is3d ? `<span style="position:absolute;bottom:62px;left:50%;transform:translateX(-50%)"><span class="pill" style="background:rgba(245,243,247,.14)">↔ drag to turn</span></span>` : ""}
      <div class="bc toggle"><button data-act="ba" data-v="1" class="${ui.before ? "on" : ""}">Before</button><button data-act="ba" data-v="0" class="${ui.before ? "" : "on"}">After</button></div>
      ${extra}
    </div>
    ${v.length > 1 ? `<div class="seg" style="grid-template-columns:repeat(${v.length},1fr)">${v.map((k) => `<button class="${ui.angle === k ? "on" : ""}" data-act="angle" data-v="${k}">${viewName(k)}</button>`).join("")}</div>` : ""}`;
}
// Realistic 3D twin (depth AI). photoSrc: data URL; lm: landmarks for that photo; depthUrl: saved depth or null.
async function mountReliefInto(host, photoSrc, lm, depthUrl, ids = [], before = false) {
  if (!host) return null;
  let dep = depthUrl ? await D.depthFromDataURL(depthUrl) : null;
  const img = await loadImg(photoSrc);
  if (!dep) dep = await D.estimateDepth(img);
  let tex;
  if (ids.length && !before && photoSrc === S.photos.front) { tex = document.createElement("canvas"); await drawPhoto(tex, "front", ids, false); }
  else tex = toCanvas(img);
  if (!host.isConnected) return null;
  const t = mountRelief(host, tex, dep, lm, { autoTurn: !ui.turned });
  ui.turned = true;
  cleanup.push(() => t.dispose());
  return { t, dep };
}
async function ensureDepth() {
  if (S.depth || !S.photos.front) return;
  try { S.depth = D.depthToDataURL(await D.estimateDepth(await loadImg(S.photos.front))); save(); } catch (e) { console.warn(e); }
}
// 180° twin: front + side selfies fused into one head (head3d.js). Side depth is saved small.
const hasSides = () => !!(S.photos.left && S.lms.left?.[0]?.length > 2) || !!(S.photos.right && S.lms.right?.[0]?.length > 2);
async function ensureSideDepth() {
  S.depthSide = S.depthSide || {};
  for (const k of ["left", "right"]) {
    if (!S.photos[k] || S.depthSide[k]) continue;
    const im = await loadImg(S.photos[k]);
    if (!S.lms[k] || S.lms[k][0]?.length < 3) { await V.loadFace(); const l = V.detect(im); if (!l) { delete S.photos[k]; delete S.lms[k]; continue; } S.lms[k] = l; }
    try { S.depthSide[k] = D.depthToDataURL(await D.estimateDepth(im), 256); } catch (e) { console.warn(e); }
  }
  save();
}
async function mountTwinHero(host) {
  await ensureDepth();
  if (hasSides()) {
    try {
      await ensureSideDepth();
      const key = [S.photos.front, S.photos.left, S.photos.right].map((x) => (x || "").length).join(":");
      if (!ui.head || ui.head.key !== key) {
        const views = [];
        for (const k of ["front", "left", "right"]) {
          if (!S.photos[k] || !S.lms[k]) continue;
          const dURL = k === "front" ? S.depth : S.depthSide?.[k]; if (!dURL) continue;
          views.push({ photo: toCanvas(await loadImg(S.photos[k])), lm: S.lms[k], dep: await D.depthFromDataURL(dURL) });
        }
        ui.head = { key, B: views.length > 1 ? buildHead(views) : null };
      }
      if (ui.head.B && ui.head.B.views.length > 1 && host.isConnected) {
        const t = mountHead(host, null, { autoTurn: !ui.turned, built: ui.head.B }); ui.turned = true; cleanup.push(() => t.dispose());
        trackOnce("Twin180Viewed", { views: ui.head.B.views.length });
        return "180";
      }
    } catch (e) { console.warn("[facetwin] 180 twin, using the one-photo twin", e); }
  }
  await mountReliefInto(host, S.photos.front, S.lms.front, S.depth);
  return "front";
}
async function addSidePhoto(k, file) {
  const url = await fileToDataURL(file, 720), im = await loadImg(url);
  await V.loadFace(); const l = V.detect(im);
  if (!l) return toast("We couldn't find a face in that photo");
  S.photos[k] = url; S.lms[k] = l; if (S.depthSide) delete S.depthSide[k];
  save(); track("SidePhotoAdded", { side: k }); render();
}
async function mountStage(ids) {
  if (!views().includes(ui.angle)) ui.angle = views()[0] || "front";
  if (ui.angle !== "3d") return drawPhoto($("#cv"), ui.angle, ids, ui.before);
  const host = $("#stage"); if (!host) return;
  let lm = S.lms.front;
  if (!lm[0] || lm[0].length < 3) { // twins saved before the 3D update: re-read the face once
    await V.loadFace(); const fresh = V.detect(await loadImg(S.photos.front));
    if (fresh) { lm = S.lms.front = fresh; save(); }
  }
  if (hasSides()) { // 180° twin with the looks drawn on all three photos
    try {
      await ensureDepth(); await ensureSideDepth();
      const views = [];
      for (const k of ["front", "left", "right"]) {
        const dURL = k === "front" ? S.depth : S.depthSide?.[k];
        if (!S.photos[k] || !S.lms[k] || !dURL) continue;
        const c = document.createElement("canvas"); await drawPhoto(c, k, ids, ui.before);
        views.push({ photo: c, lm: S.lms[k], dep: await D.depthFromDataURL(dURL) });
      }
      if (views.length > 1 && host.isConnected) {
        const t = mountHead(host, null, { autoTurn: !ui.turned, built: buildHead(views) }); ui.turned = true; cleanup.push(() => t.dispose());
        trackOnce("Twin3DViewed"); return;
      }
    } catch (e) { console.warn("[facetwin] 180 looks, using the one-photo twin", e); }
  }
  try {
    await ensureDepth();
    await mountReliefInto(host, S.photos.front, lm, S.depth, ids, ui.before);
    trackOnce("Twin3DViewed");
  } catch (e) {
    console.warn("[facetwin] 3D relief, falling back to face mesh", e);
    const tex = document.createElement("canvas"); await drawPhoto(tex, "front", ids, ui.before);
    if (!host.isConnected) return;
    const t = mountTwin3D(host, tex, lm, { autoTurn: !ui.turned }); ui.turned = true; cleanup.push(() => t.dispose());
  }
}
async function drawPhoto(canvas, angle, ids, before = false) {
  if (!canvas || !S.photos[angle]) return;
  const img = await loadImg(S.photos[angle]);
  const res = await V.render(canvas, img, S.lms[angle], before ? {} : V.combine(ids, { k: S.intensity, customHair: S.customHair }), angle);
  if (!before && ids.some((id) => V.lookById(id)?.hair)) {
    if (!res.hair) toast("Hair color needs the hair AI: check your internet and try again.");
    else if (res.approx && !S.flags.hairApprox) { S.flags.hairApprox = 1; save(); toast("Hair color in quick mode: edges are rough until the hair AI downloads."); }
  }
}
const looksOn = () => S.applied.map((id) => V.lookById(id)?.name).filter(Boolean);
function lookChips() {
  const ids = [...new Set([...S.looks, ...V.LOOKS.map((l) => l.id)])];
  return ids.map((id) => { const l = V.lookById(id), on = S.applied.includes(id); return `<button class="chip ${on ? "on" : ""}" data-act="look" data-v="${id}">${l.name}${on ? " ✓" : ""}</button>`; }).join("");
}
// ---------- feature 2: face report ----------
function measures(lm, W, H) {
  // 3D distances (x, y and depth) so a slightly turned head doesn't skew the numbers
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
const SUITS = { Oval: ["bangs", "copper", "braid"], Round: ["long", "straight", "honey"], Square: ["curls", "bangs", "arched"], Heart: ["bob", "braid", "straight"], Long: ["bangs", "curls", "bob"] };
function reportText(m) {
  const t = m.thirds, sp = m.spacing;
  return {
    thirds: t < 0.9 ? ["Shorter lower third", "Volume at the crown and higher ponytails balance it."]
      : t > 1.12 ? ["Longer lower third", "Side-swept bangs and volume at cheek level balance it."]
      : ["Balanced thirds", "Middle and lower face are in classic balance, so most cuts work."],
    eyes: sp > 1.5 ? ["Wide-set eyes", "Start brows a touch closer and darken the inner lash line."]
      : sp < 1.05 ? ["Close-set eyes", "Lighten the inner corners and start brows a little wider."]
      : ["Classic eye spacing", "Most frame widths and brow shapes will suit you."],
  };
}
function drawAnalysis(canvas, img, lm) {
  const W = img.naturalWidth, H = img.naturalHeight;
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext("2d");
  x.drawImage(img, 0, 0);
  x.fillStyle = "rgba(14,14,20,.25)"; x.fillRect(0, 0, W, H);
  const p = (i) => [lm[i][0] * W, lm[i][1] * H];
  const oval = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  const lw = Math.max(1.5, W / 320);
  x.strokeStyle = "rgba(185,164,255,.9)"; x.lineWidth = lw; x.setLineDash([lw * 4, lw * 3]);
  x.beginPath(); oval.forEach((i, k) => { const [a, b] = p(i); k ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); x.stroke();
  x.setLineDash([]);
  for (const [i, label] of [[9, "brow line"], [2, "nose base"], [152, "chin"]]) {
    const [, y] = p(i);
    x.strokeStyle = "rgba(245,243,247,.75)"; x.beginPath(); x.moveTo(p(234)[0] - W * 0.04, y); x.lineTo(p(454)[0] + W * 0.04, y); x.stroke();
    x.fillStyle = "#F5F3F7"; x.font = `800 ${Math.round(W / 34)}px Inter, sans-serif`; x.fillText(label, p(454)[0] + W * 0.05, y + W / 90);
  }
  x.fillStyle = "#7C4DFF";
  for (let i = 0; i < lm.length; i += 6) { const [a, b] = p(i); x.beginPath(); x.arc(a, b, lw * 1.1, 0, Math.PI * 2); x.fill(); }
}
const suggestions = () => {
  const shape = S.analysis?.shape || "Oval";
  return [...new Set([...S.wants, ...(SUITS[shape] || SUITS.Oval)])].filter((id) => previewById(id) && id !== "custom").slice(0, 4);
};
R.twin = {
  needs: true,
  view: () => {
    const a = S.analysis || {}, m = S.measures || { thirds: 1, spacing: 1, symmetry: 90 }, tx = reportText(m);
    const tip = V.SHAPE_TIPS[a.shape] || V.SHAPE_TIPS.Oval, first = suggestions()[0], aiOn = ui.ai?.ok;
    const card = (k, v, sub) => `<div class="card" style="padding:12px;gap:4px;border-radius:20px"><small class="small">${k}</small><b style="font-size:16px">${v}</b>${sub ? `<small class="small">${sub}</small>` : ""}</div>`;
    return `<div class="scr">
      <div class="top"><h1 class="h1" style="font-size:36px">Hey, it's you</h1><span class="pill">${esc(a.shape || "")} face</span></div>
      ${(() => { const is3d = ui.twinView !== "analysis" && HAS3D; return `<div class="photo" id="hero" style="aspect-ratio:3/4;max-height:52vh;${is3d ? "background:radial-gradient(circle at 50% 38%,#2b2440,#0E0E14 72%)" : ""}">
        ${is3d ? `<div id="heroWait" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px"><div class="spin"></div><span class="small">Building your 3D twin…</span></div>` : `<canvas id="an"></canvas>`}
        <span class="tl"><span class="pill dark" id="heroLbl">${is3d ? (hasSides() ? "Your 180° twin" : "Your 3D twin") : "478 points mapped"}</span></span>
        ${is3d ? `<span class="bc"><span class="pill" style="background:rgba(245,243,247,.14)">↔ drag to turn</span></span>` : ""}</div>
      ${HAS3D ? `<div class="seg" style="grid-template-columns:1fr 1fr"><button class="${is3d ? "on" : ""}" data-act="twinView" data-v="3d">3D twin</button><button class="${is3d ? "" : "on"}" data-act="twinView" data-v="analysis">Face analysis</button></div>` : ""}`; })()}
      ${HAS3D && !(S.photos.left && S.photos.right) ? `<div class="row" style="border:2px dashed var(--p);flex-direction:column;align-items:stretch;gap:10px"><span><b>Turn your twin to 180°</b><small>Add a photo with your head turned to each side (about 30–40°). Same light, same hair.</small></span>
        <div class="grid2"><label class="ghost" style="text-align:center;cursor:pointer">${S.photos.left ? "✓ Side 1" : "＋ Side 1"}<input type="file" accept="image/*" data-side="left" hidden></label><label class="ghost" style="text-align:center;cursor:pointer">${S.photos.right ? "✓ Side 2" : "＋ Side 2"}<input type="file" accept="image/*" data-side="right" hidden></label></div></div>` : ""}
      <div class="top"><b style="font-size:17px">Your face report</b></div>
      <div class="grid3">${card("Face shape", esc(a.shape || "—"))}${card("Symmetry", m.symmetry + "%", "most faces 85–95%")}${card("Skin score", a.score ?? "—", esc((a.notes || [])[0] || ""))}</div>
      <div class="col">
        <div class="row"><span><b>${tx.thirds[0]}</b><small>${tx.thirds[1]}</small></span><span class="r">${m.thirds}</span></div>
        <div class="row"><span><b>${tx.eyes[0]}</b><small>${tx.eyes[1]}</small></span><span class="r">${m.spacing}</span></div>
        <div class="row"><span><b>Frames for a ${esc((a.shape || "oval").toLowerCase())} face</b><small>${tip.frames}</small></span><span class="r">👓</span></div>
        <div class="row"><span><b>Hair that suits you</b><small>${tip.hair}</small></span><span class="r">💇‍♀️</span></div>
      </div>
      <button class="row" data-go="coach" style="background:var(--lilac);color:var(--ink)"><span><b>💪 Train your jawline with your camera</b><small style="color:var(--ink);opacity:.7">Live rep counting and form checks · try one free</small></span><span class="r">›</span></button>
      <div class="top"><b style="font-size:17px">See these on you</b><span class="small">realistic AI preview</span></div>
      <div class="grid2">${suggestions().map((id, i) => { const p = previewById(id); return tile(p.icon, p.name, { i, attrs: `data-go="preview/${id}"` }); }).join("")}</div>
      ${S.goal === "jaw" ? `<button class="cta" data-go="coach">Start my face workout · free</button><button class="link" data-act="twinNext">Save my twin + get my plan</button>` : aiOn ? `<button class="cta" data-go="preview/${first}">See ${esc(previewById(first).name.toLowerCase())} on me · free</button>
        <button class="link" data-act="twinNext">Skip, get my plan</button>`
        : `<button class="cta" data-act="twinNext">Save my report + get my plan</button>`}
      <p class="small center">Face care and style guidance, not medical advice.</p></div>`;
  },
  mount: async () => {
    trackOnce("ReportViewed", { shape: S.analysis?.shape });
    $$("input[data-side]").forEach((inp) => inp.addEventListener("change", () => { const f = inp.files?.[0]; if (f) { ui.head = null; toast("Adding your side photo…"); addSidePhoto(inp.dataset.side, f); } }));
    if ((!S.measures || !S.measures.v3) && S.lms.front && S.lms.front[0]?.length > 2) { const im = await loadImg(S.photos.front); S.measures = { ...measures(S.lms.front, im.naturalWidth, im.naturalHeight), v3: 1 }; save(); render(); return; }
    const c = $("#an"); if (c) drawAnalysis(c, await loadImg(S.photos.front), S.lms.front);
    if ($("#hero") && !c) {
      try { const mode = await mountTwinHero($("#hero")); trackOnce("Twin3DViewed"); const lb = $("#heroLbl"); if (lb) lb.textContent = mode === "180" ? "Your 180° twin" : "Your 3D twin"; }
      catch (e) { console.warn(e); ui.twinView = "analysis"; render(); return; }
      $("#heroWait")?.remove();
    }
    if (ui.ai === null) { await checkAI(); if (location.hash.startsWith("#/twin")) render(); }
  },
};

// ---------- feature 1: realistic previews ----------
async function checkAI() {
  try {
    const r = await fetch("api/status", { cache: "no-store" });
    if (r.ok) { const j = await r.json(); ui.ai = { ok: !!j.ai, server: true, payments: !!j.payments, upsells: !!j.upsells }; }
    else ui.ai = { ok: false, server: false };
  } catch { ui.ai = { ok: false, server: false }; }
  return ui.ai;
}
const cmpSeen = new Set();
const compareHTML = (a, b, la = "Before", lb = "After", maxH = "56vh") => { const k = b.length + b.slice(-48), hint = !cmpSeen.has(k); cmpSeen.add(k); return `<div class="cmp${hint ? " hint" : ""}" style="max-height:${maxH}">
  <img src="${b}" alt="${lb}"><div class="cmp-a"><img src="${a}" alt="${la}"></div><div class="cmp-line"><span>⟷</span></div>
  <span class="cmp-tl"><span class="pill dark">${la}</span></span><span class="cmp-tr"><span class="pill">${lb}</span></span>
  <input type="range" min="0" max="100" value="50" class="cmp-r" aria-label="Drag to compare ${la} and ${lb}"></div>`; };
app.addEventListener("input", (e) => {
  if (!e.target.classList.contains("cmp-r")) return;
  const box = e.target.closest(".cmp"), v = +e.target.value;
  box.querySelector(".cmp-a").style.clipPath = `inset(0 ${100 - v}% 0 0)`;
  box.querySelector(".cmp-line").style.left = v + "%";
});
const previewOf = (id) => S.previews.find((p) => p.id === id);
const previewsLeft = () => (isPaid() ? Infinity : Math.max(0, CONFIG.FREE_PREVIEWS - S.previewsUsed));
const entryName = (q) => q.name || previewById(q.id)?.name || "Your look";
const entryIcon = (q) => q.icon || previewById(q.src || q.id)?.icon || "sparkles";
const TINT = ["var(--peach)", "var(--lilac)", "var(--blue)", "var(--yel)", "var(--pink)", "var(--mint)"];
// the big picker tile: a 56px icon bubble, the name below, a check when selected
const tile = (icon, label, { on = false, done = false, i = 0, attrs = "" } = {}) =>
  `<button class="tile2 ${on ? "on" : ""}" ${attrs} aria-pressed="${on}"><span class="tbub" style="--tc:${TINT[i % TINT.length]}">${ico(icon, 30)}</span><span class="tlabel">${esc(label)}</span>${on ? `<span class="tck">${ico("check", 14)}</span>` : done ? `<span class="tdone">${ico("check", 12)}</span>` : ""}</button>`;
const changeKey = (sel) => (ui.base ? ui.base.id + "+" + sel : sel);
R.preview = {
  needs: true, tab: "preview",
  view: (id) => {
    if (id && previewById(id)) { ui.prevSel = id; ui.prevGroup = previewById(id).group; }
    const sel = ui.prevSel || (S.flags.glow ? "onetap" : suggestions()[0]) || PREVIEWS[0].id, p = previewById(sel), left = previewsLeft();
    ui.prevSel = sel; // mount() and the actions read ui.prevSel, so it must hold the default after a reload too
    const group = ui.prevGroup || p.group, base = ui.base;
    const shown = ui.prevKey ? previewOf(ui.prevKey) : sel === "custom" ? null : previewOf(changeKey(sel));
    const before = base ? base.img : S.photos.front, ai = ui.ai;
    return `<div class="scr ${S.startedAt ? "tabbed" : ""}">
      <div class="top">${S.startedAt ? `<span class="h1" style="font-size:36px">${S.flags.glow ? "Retouch" : "Try a new look"}</span>` : `${backBtn(S.flags.glow ? "landing" : "twin")}<span class="h1" style="font-size:31px">${S.flags.glow ? "Retouch" : "Try a new look"}</span>`}
        <span class="row-r"><span class="pill ${left === Infinity ? "" : "chip"}">${left === Infinity ? "Unlimited" : `${left} free`}</span>${S.flags.glow ? `<button class="iconbtn" data-go="account" aria-label="Account and plan">${ico("user", 22)}</button>` : ""}</span></div>
      ${shown && ui.prev3d ? `<div class="photo" id="pv3" style="aspect-ratio:3/4;max-height:52vh;background:radial-gradient(circle at 50% 38%,#2b2440,#0E0E14 72%)"><div id="pvWait" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px"><div class="spin"></div><span class="small">Putting your new look on your 3D twin…</span></div><span class="tl"><span class="pill dark">${ico(entryIcon(shown), 16)} ${esc(entryName(shown))} · 3D</span></span><span class="bc"><span class="pill" style="background:rgba(245,243,247,.14)">↔ drag to turn</span></span></div>`
        : shown ? compareHTML(S.photos.front, shown.img, "You now", esc(entryName(shown)))
        : `<div class="photo" style="aspect-ratio:3/4;max-height:52vh"><img src="${before}" alt="Your photo">
            <span class="tl"><span class="pill dark">${ico(p.icon, 16)} ${esc(p.name)}</span></span>
            ${base ? `<span class="tr"><span class="pill">on top of ${esc(entryName(base))}</span></span>` : ""}
            ${ui.busy ? `<div class="busy"><div class="scanl"></div><div class="spin"></div><b id="busyMsg">Creating your look…</b><div class="pbar"><i id="busyBar"></i></div><span class="small" id="busyHint">Usually 5–15 seconds</span></div>` : ""}</div>`}
      ${shown && !ui.prev3d ? `<p class="small center">Drag the line to compare · AI preview, a simulation of the change</p>` : ""}
      ${base ? `<div class="row" style="border:2px dashed var(--p)"><span><b>Adding a change on top of ${esc(entryName(base))}</b><small>Pick the next change below</small></span><button class="pill chip" data-act="baseOff">✕ Stop</button></div>` : ""}
      ${shown ? `<div class="col" style="gap:12px">
          <button class="cta inline" data-act="prevSave">${ico(S.flags.glow ? (isPaid() ? "download" : "lock") : "download", 22)} ${S.flags.glow ? "Download in HD" : "Save photo"}</button>
          <div class="wrap" style="justify-content:center">
            <button class="chip sm" data-act="prev3d">${ico(ui.prev3d ? "compare" : "cube", 16)} ${ui.prev3d ? "Compare 2D" : "View in 3D"}${S.flags.glow && !hasLooks() && !ui.prev3d ? ` <span class="pro-tag">Looks</span>` : ""}</button>
            <button class="chip sm" data-act="stackOn">${ico("plus", 16)} Add a change</button>
            <button class="chip sm" data-act="prevAgain">${ico("refresh", 16)} Try again</button></div></div>` : ""}
      <div class="scroll-x">${GROUPS.map((g) => `<button class="chip sm ${g === group ? "on" : ""}" data-act="prevGroup" data-v="${g}">${S.flags.glow && !GLOW_GROUPS.includes(g) && !hasLooks() ? ico("lock", 13) + " " : ""}${g}</button>`).join("")}</div>
      ${group === "Your idea" ? `<div class="card" style="gap:8px"><b>Describe any change to your face or hair</b>
          <textarea id="ctext" rows="2" maxlength="200" placeholder="e.g. a short curly fade and a thin mustache" style="width:100%;border-radius:14px;border:2px solid var(--line);background:var(--bg);color:var(--text);padding:12px;font:inherit;font-weight:700;resize:none">${esc(ui.ctext || "")}</textarea>
          <small class="small">Keep it to your face and hair. The AI keeps everything else the same.</small></div>`
        : `<div class="grid3 tiles">${PREVIEWS.filter((q) => q.group === group).map((q, i) => tile(q.icon, q.name, { on: q.id === sel, done: !!previewOf(changeKey(q.id)), i, attrs: `data-act="prevSel" data-v="${q.id}"` })).join("")}</div>`}
      ${ai && !ai.ok ? `<div class="card" style="background:var(--yel);color:var(--ink)"><b>Realistic looks are off</b><span style="font-size:13px;font-weight:700;line-height:1.45">${ai.server ? "Add your Gemini API key (README → Realistic previews), then restart." : "Start the app with <code>python3 server.py</code> instead of http.server to turn them on."}</span>
          ${S.startedAt ? `<button class="link" style="text-align:left;color:var(--ink);text-decoration:underline" data-go="studio">Use the instant drawn try-on meanwhile</button>` : ""}</div>` : ""}
      ${!shown ? `<div class="dock"><button class="cta inline" data-act="prevGen" data-v="${sel}" ${ui.busy || (ai && !ai.ok) ? "disabled" : ""}>${ui.busy ? `<span class="spin sm"></span> Working…` : `${ico("sparkles", 22)} ${group === "Your idea" ? "Show me" : `Show me with ${esc(p.name.toLowerCase())}`}`}</button></div>` : ""}
      ${!S.startedAt && S.previews.length && !S.flags.glow ? `<button class="cta" data-act="twinNext">Save my looks + start</button>` : ""}
      ${!shown && !S.startedAt && S.previews.length && S.flags.glow ? (isPaid() ? `<button class="ghost" data-act="prevSave">${ico("download", 20)} Download in HD</button>` : `<button class="ghost" data-go="paywall">${ico("lock", 20)} Download in HD</button>`) : ""}
      ${S.previews.length ? `<div class="top"><b style="font-size:15px">Your looks</b><span class="small">${S.previews.length}</span></div>
        <div class="scroll-x">${S.previews.map((q) => `<button data-act="prevShow" data-v="${esc(q.id)}" style="border:0;padding:0;background:none;cursor:pointer;width:84px;height:110px;border-radius:16px;overflow:hidden;flex:none;${shown && q.id === shown.id ? "outline:3px solid var(--p);outline-offset:-3px" : ""}"><img src="${q.img}" alt="${esc(entryName(q))}" style="width:100%;height:100%;object-fit:cover"></button>`).join("")}</div>` : ""}
      ${S.startedAt ? `<button class="link" data-go="studio">Instant drawn try-on (hair colors, brows)</button>` : ""}
    </div>`;
  },
  mount: async () => {
    trackOnce("PreviewScreen");
    const ta = $("#ctext"); if (ta) ta.addEventListener("input", () => { ui.ctext = ta.value; });
    const host = $("#pv3");
    if (host) {
      const q = ui.prevKey ? previewOf(ui.prevKey) : previewOf(changeKey(ui.prevSel));
      try {
        ui.prevGeo = ui.prevGeo || {};
        const gk = q.id + q.date + q.img.length;
        let g = ui.prevGeo[gk];
        if (!g) {
          await V.loadFace(); const im = await loadImg(q.img); const lm = V.detect(im);
          if (!lm) throw new Error("no face in preview");
          g = ui.prevGeo[gk] = { lm, depth: D.depthToDataURL(await D.estimateDepth(im)) };
        }
        await mountReliefInto(host, q.img, g.lm, g.depth); $("#pvWait")?.remove(); track("Preview3DViewed", { preview: q.id });
      } catch (e) { console.warn(e); toast("Couldn't make this look 3D. Try another one."); ui.prev3d = false; render(); }
    }
    if (ui.ai === null) { await checkAI(); if (location.hash.startsWith("#/preview")) render(); }
  },
};
ACT.prev3d = () => {
  if (S.flags.glow && !hasLooks() && !ui.prev3d) return upsell("The 3D twin is part of Looks", "looks");
  ui.prev3d = !ui.prev3d; render();
};
ACT.prevGroup = (g) => {
  ui.prevGroup = g; ui.prevKey = null;
  const first = PREVIEWS.find((q) => q.group === g); if (first) ui.prevSel = first.id;
  render();
};
ACT.prevSel = (v) => { ui.prevSel = v; ui.prevKey = null; ui.prevGroup = previewById(v)?.group; render(); };
ACT.prevShow = (key) => { ui.prevKey = key; render(); };
ACT.stackOn = () => {
  const q = ui.prevKey ? previewOf(ui.prevKey) : previewOf(changeKey(ui.prevSel)); if (!q) return;
  ui.base = q; ui.prevKey = null; ui.prev3d = false; track("LookStack", { base: q.id }); render();
};
ACT.baseOff = () => { ui.base = null; ui.prevKey = null; render(); };
ACT.prevAgain = () => {
  const q = ui.prevKey ? previewOf(ui.prevKey) : previewOf(changeKey(ui.prevSel)); if (!q) return;
  if (q.src === "custom") { ui.prevGroup = "Your idea"; ui.prevSel = "custom"; ui.ctext = q.text || ""; }
  ui.prevKey = null; ACT.prevGen(q.src || ui.prevSel, null, null, q);
};
ACT.prevGen = async (id, _el, _e, redo = null) => {
  if (ui.busy) return;
  const left = previewsLeft();
  if (!left) return upsell("You've used your free look");
  const p = previewById(id); if (!p) return;
  if (S.flags.glow && !hasLooks() && !GLOW_GROUPS.includes(p.group)) return upsell("Hair, brows and beard looks are part of Looks", "looks");
  if (!S.aiOk) return askAIConsent(() => ACT.prevGen(id, _el, _e, redo)); // the photo leaves the device: ask first
  let text = "";
  if (id === "custom") {
    text = cleanIdea(redo?.text || $("#ctext")?.value || ui.ctext);
    if (text.length < 4) return toast("Describe the change first");
    ui.ctext = text;
  }
  const base = redo ? (redo.baseId ? previewOf(redo.baseId) : null) : ui.base;
  ui.busy = true; ui.prevSel = id; ui.prev3d = false; render();
  const msgs = ["Reading your face…", "Keeping you, you…", "Adding the change…", "Final touches…"];
  const cr = crawler((pc, ms) => {
    const bar = $("#busyBar"); if (bar) bar.style.width = pc + "%";
    const el = $("#busyMsg"); if (el) el.textContent = msgs[Math.min(msgs.length - 1, Math.floor(ms / 3500))];
    const h = $("#busyHint"); if (h) h.textContent = ms > 40000 ? "Busy right now. Still working, nothing is stuck." : ms > 18000 ? "Good edits take a little longer. Almost there." : "Usually 5–15 seconds";
  }, { from: 4, to: 94, tau: 11000 });
  const t = { stop: () => cr.stop() };
  try {
    const src = toCanvas(await loadImg(base ? base.img : S.photos.front), 1024).toDataURL("image/jpeg", 0.9);
    const r = await fetchT("api/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: src.split(",")[1], mime: "image/jpeg", prompt: promptFor(id, text), id, text }) }, 85000);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.image) throw new Error(j.error || "The preview didn't work. Try again.");
    const big = await loadImg(`data:${j.mime || "image/png"};base64,${j.image}`);
    const out = toCanvas(big, 720).toDataURL("image/jpeg", 0.85), hd = toCanvas(big, 1600).toDataURL("image/jpeg", 0.92); // hd = what "Download in HD" saves
    const own = id === "custom" ? { name: text.length > 28 ? text.slice(0, 27) + "…" : text, icon: "pencil", text } : { name: p.name, icon: p.icon };
    const key = id === "custom" ? (base ? base.id + "+" : "") + "custom" + Date.now().toString(36) : base ? base.id + "+" + id : id;
    const entry = { id: key, src: id, img: out, hd, date: dkey(), ...own, ...(base ? { baseId: base.id, name: entryName(base) + " + " + own.name } : {}) };
    S.previews = [entry, ...S.previews.filter((q) => q.id !== key)].slice(0, 12);
    S.previews.forEach((q, i) => { if (i >= 4) delete q.hd; }); // keep HD files for the latest 4 only (browser storage is small)
    if (!isPaid()) S.previewsUsed++;
    save(); track("PreviewGenerated", { preview: id, stacked: !!base, mock: !!j.mock });
    trackOnce("ViewContent", { content_name: "first_result", content_category: S.flags.glow ? "glow" : "looks" }); // the standard Meta event for "saw her result", to optimise ads on
    ui.prevKey = key; ui.base = null; ui.prev3d = S.flags.glow ? false : HAS3D; // V1 flow shows the new look on the 3D twin first
  } catch (e) {
    track("PreviewFailed", { preview: id }); toast(String(e.message || e).slice(0, 160));
  } finally { t.stop(); ui.busy = false; render(); }
};
ACT.prevSave = async () => {
  const q = ui.prevKey ? previewOf(ui.prevKey) : previewOf(changeKey(ui.prevSel)); if (!q) return;
  if (S.flags.glow && !isPaid()) { // V2: saving the file is behind the paywall; straight to the plans, no extra sheet
    track("HDTapped", { preview: q.id }); S.flags.upFlow = 0; if (!CONFIG.PLANS_GLOW.some((x) => x.id === S.chosen)) S.chosen = "glow_q"; save(); return go("paywall");
  }
  const blob = await (await fetch(q.hd || q.img)).blob(), name = `facetwin-${q.id.replace(/[^a-z0-9+-]/gi, "")}.jpg`;
  if (!q.hd) toast("Saved at standard size. Only your 4 newest edits keep the full HD file."); // older edits were trimmed to save space
  const file = new File([blob], name, { type: "image/jpeg" });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); track("PreviewSaved", { preview: q.id, via: "share" }); return; }
    catch (e) { if (e && e.name === "AbortError") return; /* she closed the sheet */ } // any other error: fall back to a download
  }
  download(blob, name); track("PreviewSaved", { preview: q.id, via: "download" });
};

ACT.twinView = (v) => { ui.twinView = v; render(); };
ACT.ba = (v) => { ui.before = v === "1"; render(); };
ACT.angle = (v) => { ui.angle = v; render(); };
ACT.look = (v) => toggleLook(v);
function toggleLook(id) {
  const l = V.lookById(id); if (!l) return;
  if (S.applied.includes(id)) S.applied = S.applied.filter((x) => x !== id);
  else {
    if (!isPaid() && !S.tried.includes(id) && S.tried.length >= CONFIG.FREE_LOOKS) return upsell(`You've tried your ${CONFIG.FREE_LOOKS} free looks`);
    S.applied = S.applied.filter((x) => V.lookById(x)?.cat !== l.cat).concat(id);
    if (!S.tried.includes(id)) { S.tried.push(id); track("LookTried", { look: id }); }
    if (l.hair && !V.hairReady()) { toast("Loading hair colors…"); V.loadHair().then(() => render()); }
  }
  ui.before = false; save(); render();
}
// The photo leaves the device only after this explicit, unticked-by-default consent (privacy.html mirrors it).
function askAIConsent(next) {
  ui.afterConsent = next;
  sheet(`<h2 class="h1" style="font-size:31px">One thing before we edit</h2>
    <p class="sub">To make this edit we send your photo to Google's Gemini AI. We don't keep it on our servers; your photos stay in this browser. You can delete them anytime in Privacy. <a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a></p>
    <label class="row" style="cursor:pointer"><input type="checkbox" id="aiOk" style="width:22px;height:22px;flex:none"><span><b>I agree to send my photo to the AI editor</b><small>This includes processing of my face in the photo. Needed to continue.</small></span></label>
    <button class="cta inline" data-act="aiAgree">Continue</button><button class="link" data-close>Not now</button>`);
}
ACT.aiAgree = () => {
  if (!$("#aiOk")?.checked) return toast("Please tick the box to continue");
  S.aiOk = true; S.aiOkAt = new Date().toISOString(); save(); track("AIConsent");
  $$(".sheet-bg").forEach((n) => n.remove());
  const f = ui.afterConsent; ui.afterConsent = null; if (f) f();
};
const upsellOf = (id) => (CONFIG.UPSELLS || []).find((u) => u.id === id);
function upsell(title, want = "glow") {
  track("UpsellShown", { reason: title, want });
  const add = upsellOf(want), buyable = add && S.paid; // an add-on is sold to people who already have a Glow plan
  const text = !S.flags.glow ? "Unlimited realistic previews, your full face report and 12-week plan with products, and weekly before/after."
    : add ? (buyable ? `${add.name}: ${add.title.toLowerCase()}. One-time $${add.price.toFixed(2)}, no subscription.` : `${add.name} is a one-time add-on to Glow: ${add.title.toLowerCase()}. Start with a Glow plan.`)
    : "Glow: unlimited natural retouch and Studio, saved in HD. Looks and Coach are optional one-time add-ons.";
  sheet(`<span class="tbub" style="--tc:var(--lilac)">${ico(add ? add.icon : "lock", 30)}</span>
    <h2 class="h1" style="font-size:34px">${esc(title)}</h2>
    <p class="sub">${esc(text)}</p>
    <button class="cta inline" data-act="seePlans" data-v="${want}">${buyable ? `See ${add.name}` : "See plans"}</button><button class="link" data-close>Not now</button>`);
}
ACT.seePlans = (want) => {
  S.flags.upFlow = 0; // opened on her own, not from the post-checkout sequence
  if (upsellOf(want) && S.paid) { save(); return go("up/" + want); }
  if (S.flags.glow && !CONFIG.PLANS_GLOW.some((q) => q.id === S.chosen)) S.chosen = "glow_q";
  save(); go("paywall");
};
ACT.saveLook = async () => {
  if (!S.applied.length) return toast("Turn on a look first");
  const key = [...S.applied].sort().join("+");
  if (S.saved.some((s) => s.key === key)) return toast("Already saved");
  const c = document.createElement("canvas");
  await drawPhoto(c, "front", S.applied);
  const thumb = toCanvas(c, 260).toDataURL("image/jpeg", 0.8);
  S.saved.unshift({ key, ids: [...S.applied], thumb, date: dkey() });
  save(); track("AddToWishlist", { content_name: key });
  toast("Saved to your looks");
};
ACT.twinNext = () => go(S.email ? "paywall" : "signup");

R.signup = {
  needs: true,
  view: () => `<div class="scr">${topbar("twin", 6)}
    <div class="grid2"><div class="photo" style="height:190px;border-radius:26px"><canvas id="c1"></canvas></div><div class="photo" style="height:190px;border-radius:26px"><canvas id="c2"></canvas></div></div>
    <h1 class="h1">Save your twin so <span class="hl">it waits for you</span></h1>
    <p class="sub">Get your plan and weekly reminders by email. Your photos stay on this phone.</p>
    <form id="sf" class="col" novalidate>
      <input class="input" id="em" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" value="${esc(S.email)}" required>
      <label class="small" style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="cs" ${S.consent ? "checked" : ""}> Email me my plan, reminders and tips. Unsubscribe anytime.</label>
      <span class="err hidden" id="ee">That email doesn't look right.</span>
    </form>
    <button class="cta" data-act="signup">Save my twin</button>
    <button class="link" data-act="skipSignup">Skip for now</button>
    <p class="small center">By continuing you agree to the <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>.</p></div>`,
  mount: async () => {
    await drawPhoto($("#c1"), "front", S.applied);
    const alt = V.LOOKS.find((l) => !S.applied.includes(l.id) && (l.glasses || l.lips))?.id;
    await drawPhoto($("#c2"), "front", alt ? [alt] : [], !alt);
    $("#sf").addEventListener("submit", (e) => { e.preventDefault(); ACT.signup(); });
  },
};
ACT.signup = () => {
  const v = $("#em").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { $("#ee").classList.remove("hidden"); return; }
  S.email = v; S.consent = $("#cs").checked; save();
  track("Lead"); track("CompleteRegistration");
  postLead({ step: "signup" });
  go("paywall");
};
ACT.skipSignup = () => { track("SignupSkipped"); go("paywall"); };

// ---------- paywall ----------
const planById = (id) => [...CONFIG.PLANS_GLOW, ...CONFIG.PLANS].find((p) => p.id === id) || (S.flags.glow ? CONFIG.PLANS_GLOW[1] : CONFIG.PLANS[0]);
// Honest renewal line shown above the pay button: today's price, the recurring price, the reminder.
const renewText = (pl) => pl.period === "month"
  ? `Today $${pl.price.toFixed(2)}. From day 31: $${pl.then.toFixed(2)} a month until you cancel. We remind you 3 days before.`
  : pl.period === "quarter"
  ? `Today $${pl.price.toFixed(2)}. From month 4: $${pl.then.toFixed(2)} every 3 months until you cancel. We remind you 3 days before.`
  : `Today $${pl.price.toFixed(2)}. Renews at $${pl.then.toFixed(2)} a year until you cancel. We remind you 3 days before.`;
const payLabel = (p) => `${ico("lock", 22)} Pay $${p.price.toFixed(2)} · secure checkout`;
function glowPaywall() {
  if (!CONFIG.PLANS_GLOW.some((p) => p.id === S.chosen)) { S.chosen = "glow_q"; save(); }
  const last = S.previews[0], p = planById(S.chosen);
  const perks = [
    ["Glow", "var(--pink)", [["onetap", "Unlimited natural retouch"], ["image", "Studio backgrounds"], ["download", "HD download, no watermark"]]],
    ["Add-ons", "var(--lilac)", CONFIG.UPSELLS.map((u) => [u.icon, `${u.name}: $${u.price.toFixed(2)} once, after checkout`])],
  ];
  const plan = (q) => `<button class="plan ${S.chosen === q.id ? "on" : ""}" data-act="choose" data-v="${q.id}">${q.popular ? `<span class="badge">Best value</span>` : ""}<span><b>${q.name}</b><small>${q.note}</small></span><span class="price">$${q.price.toFixed(2)}</span></button>`;
  const ba = last ? `<div class="ba"><div class="photo"><img src="${S.photos.front}" alt="Before"><span class="tl"><span class="pill dark">Before</span></span></div><div class="photo"><img src="${last.img}" alt="Your edit"><span class="tl"><span class="pill">${ico(entryIcon(last), 14)} ${esc(entryName(last))}</span></span></div></div>` : "";
  return `<div class="scr" style="gap:12px">
    <div class="top">${backBtn("preview")}<span class="pill" style="background:var(--pink);color:var(--ink)">${ico("download", 14)} HD, no watermark</span></div>
    ${ba}
    <h1 class="h1" style="font-size:39px">Your edit is ready. <span class="hl">Get it in HD.</span></h1>
    <div class="col">${CONFIG.PLANS_GLOW.map(plan).join("")}</div>
    <div class="grid2">${perks.map(([tier, bg, items]) => `<div class="card perk"><span class="pill" style="background:${bg};color:var(--ink);align-self:flex-start">${tier}</span>${items.map(([ic, t]) => `<div class="perk-i">${ico(ic, 20)}<span>${t}</span></div>`).join("")}</div>`).join("")}</div>
    <p class="small center" style="font-size:11px">Payments by Stripe. <a href="terms.html" target="_blank" rel="noopener">Terms</a> · <a href="privacy.html" target="_blank" rel="noopener">Privacy</a> · Face care and photo editing, not medical advice.</p>
    <div class="dock pay">
      <p class="small center" id="renewLine" style="font-size:12px;font-weight:800;color:var(--text)">${renewText(p)}</p>
      <label class="row" style="cursor:pointer;padding:12px 14px"><input type="checkbox" id="renewOk" style="width:22px;height:22px;flex:none"><span><b style="font-size:14px">I agree to the renewal terms above</b><small>Cancel anytime in Settings, in 2 taps.</small></span></label>
      <button class="cta inline" data-act="checkout">${payLabel(p)}</button>
      <button class="link" data-act="notNow">Not now</button>
    </div></div>`;
}
R.paywall = {
  needs: true,
  view: (variant) => {
    if (S.flags.glow) return glowPaywall();
    const day7 = variant === "day7" && S.scans.length > 1;
    const first = S.scans[0], last = latest();
    const head = day7
      ? `<div class="grid2"><div class="photo" style="height:180px;border-radius:24px"><img src="${first.img}" alt="Day 0"><span class="tl"><span class="pill dark">Day 0</span></span></div>
           <div class="photo" style="height:180px;border-radius:24px"><img src="${last.img}" alt="Today"><span class="tl"><span class="pill">Day ${freeDay()}</span></span></div></div>
         <h1 class="h1">One week in. <span class="hl">Keep it going.</span></h1>`
      : `<div class="top" style="justify-content:flex-start;gap:12px"><div class="photo" style="width:84px;height:104px;border-radius:22px;flex:none"><canvas id="pc"></canvas></div>
         <h1 class="h1" style="font-size:39px">Keep your twin + <span class="hl">your 12-week plan</span></h1></div>`;
    return `<div class="scr" style="gap:12px">
      <div class="top">${backBtn(S.startedAt ? "today" : "twin")}<span class="pill" style="background:var(--pink);color:var(--ink)">Plan ready for your ${esc(S.analysis?.shape?.toLowerCase() || "")} face</span></div>
      ${head}
      <div class="col" style="font-size:14px;font-weight:700;gap:7px">
        ${["Unlimited realistic previews on your own face", `Your face report + a ${S.minutes}-minute routine with products`, "Weekly re-scan with before / after"].map((t) => `<div class="top" style="justify-content:flex-start"><span class="dot on" style="width:24px;height:24px;font-size:12px">✓</span>${t}</div>`).join("")}
      </div>
      <div class="col">${CONFIG.PLANS.map((p) => `<button class="plan ${S.chosen === p.id ? "on" : ""}" data-act="choose" data-v="${p.id}">${p.popular ? `<span class="badge">Most popular</span>` : ""}<span><b>${p.name}</b><small>${p.note}</small></span><span class="price">$${p.price.toFixed(2)}</span></button>`).join("")}</div>
      <button class="cta" data-act="checkout">Start my plan</button>
      <button class="link" data-act="notNow">${S.freeStart ? "Maybe later" : "Not now"}</button>
      <p class="small center" style="font-size:11px">Renews automatically at the plan price until you cancel. Cancel anytime, at least 24h before renewal. Face care, not medical advice.</p></div>`;
  },
  mount: async (variant) => {
    trackOnce(variant === "day7" ? "Day7PaywallView" : "PaywallView");
    if (S.flags.glow) track("PaywallShown", { plan: S.chosen, previews: S.previews.length });
    const c = $("#pc"); if (c) await drawPhoto(c, "front", S.applied);
  },
};
ACT.choose = (v) => {
  S.chosen = v; save(); $$(".plan").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  const line = $("#renewLine"); if (line) line.textContent = renewText(planById(v));
  const pay = $('.dock.pay [data-act="checkout"]'); if (pay && S.flags.glow) pay.innerHTML = payLabel(planById(v));
};
const STRIPE_PLANS = ["glow_m", "glow_q"]; // the plans that exist as Stripe prices
ACT.checkout = async (_v, el) => {
  if (S.flags.glow && !$("#renewOk")?.checked) return toast("Please tick the box to confirm the renewal terms");
  const p = planById(S.chosen);
  track("InitiateCheckout", { value: p.price, currency: CONFIG.CURRENCY, content_name: p.id });
  postLead({ step: "checkout" });
  const link = CONFIG.PAYMENT_LINKS[p.id];
  if (testerOn()) {
    S.paid = p.id; if (!S.flags.glow) S.startedAt = S.startedAt || now().toISOString(); save();
    toast("Tester mode: plan unlocked, no payment"); go(S.flags.glow ? "preview" : "welcome"); return;
  }
  // 1) Stripe Checkout through our /api (the secret key stays on the server)
  if (STRIPE_PLANS.includes(p.id)) {
    const label = el && el.textContent;
    if (el) { el.disabled = true; el.textContent = "Opening secure checkout…"; }
    waitScreen("Opening secure checkout", "You'll be on Stripe in a moment.");
    try {
      const r = await fetchT("api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: p.id, email: S.email || "", utm: S.utm }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) { location.href = j.url; return; }
      if (r.status !== 503 && r.status !== 404) throw new Error(j.error || "Checkout didn't open. Try again.");
    } catch (e) {
      hideWait(); if (el) { el.disabled = false; el.textContent = label; }
      return toast(String(e.message || e).slice(0, 160));
    }
    hideWait(); if (el) { el.disabled = false; el.textContent = label; }
  }
  // 2) payment link, 3) honest "payments open soon" screen
  if (link) location.href = link.replace("{email}", encodeURIComponent(S.email || ""));
  else go("waitlist");
};
// Back from Stripe: /?cs=<session id>. Ask our server whether Stripe really took the money, then unlock.
async function confirmCheckout(cs) {
  history.replaceState(null, "", location.pathname + (DEBUG ? "?debug=1" : "") + "#/welcome");
  let next = "preview";
  waitScreen("Confirming your payment", "Checking with Stripe. Please keep this page open.");
  try {
    const r = await fetchT(`api/verify?cs=${encodeURIComponent(cs)}`, { cache: "no-store" }, 30000);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.paid) throw new Error(j.error || "We couldn't confirm the payment yet.");
    S.billing = { customer: j.customer, token: j.token, cs };
    if (j.email && !S.email) S.email = j.email;
    const cur = j.currency || CONFIG.CURRENCY;
    if (j.kind === "upsell") {
      // a one-time add-on: Looks or Coach
      const u = upsellOf(j.item); if (!u) throw new Error("Unknown add-on.");
      const first = !S.owned[j.item], value = typeof j.value === "number" ? j.value : (j.skip ? u.skipPrice : u.price);
      S.owned = { ...S.owned, [j.item]: 1 }; S.flags.glow = 1; save();
      if (first) {
        if (window.fbq) window.fbq("track", "Purchase", { value, currency: cur, content_name: "addon_" + u.id }, { eventID: cs });
        console.info("[track]", "Purchase", { value, addon: u.id, cs });
        track("AddOnPurchased", { item: u.id, value, currency: cur, second_chance: !!j.skip });
      }
      toast(`${u.name} is unlocked. Thank you!`);
      next = nextOffer(u.id);
    } else {
      const p = planById(j.plan), first = S.paid !== j.plan;
      if (CONFIG.PLANS_GLOW.some((q) => q.id === j.plan)) S.flags.glow = 1;
      S.paid = j.plan; save();
      if (first) {
        const value = typeof j.value === "number" ? j.value : p.price;
        // eventID = checkout session, so a later server-side (CAPI) Purchase is deduplicated with this one
        if (window.fbq) window.fbq("track", "Purchase", { value, currency: cur, content_name: p.id }, { eventID: cs });
        console.info("[track]", "Purchase", { value, plan: p.id, cs });
        track("Subscribe", { value, currency: cur });
      }
      if (!S.flags.glow) toast(`${p.name} is active. Thank you!`); // Glow buyers get the green banner on the next screen instead
      if (S.flags.glow) { S.flags.upFlow = 1; save(); next = nextOffer(null); } else next = "welcome";
    }
  } catch (e) {
    hideWait();
    toast(String(e.message || e).slice(0, 160) + " Write to " + CONFIG.SUPPORT_EMAIL);
    go("paywall"); return;
  }
  hideWait();
  go(next);
}

// ---------- one-time add-ons after checkout: Looks, then Coach ----------
// Each is offered at its price; if she says no, once more at the second-chance price; then the next one.
// Both prices are real prices she can pay (no crossed-out price that was never charged).
function nextOffer(after) {
  if (S.flags.upFlow) {
    const ids = CONFIG.UPSELLS.map((u) => u.id);
    for (const id of ids.slice(ids.indexOf(after) + 1)) if (!owns(id)) { save(); return "up/" + id; }
  }
  S.flags.upFlow = 0;
  if (S.owned.coach && !S.analysis) { // Coach needs her face report: answer 2 quick questions, the report is built from her photo
    S.startedAt = S.startedAt || now().toISOString(); S.goal = S.goal || "skin"; save(); return "goal";
  }
  save(); return "preview";
}
R.up = {
  needs: true,
  view: (arg) => {
    const [id, phase] = String(arg || "").split("-"), u = upsellOf(id) || CONFIG.UPSELLS[0], second = phase === "2";
    const price = second ? u.skipPrice : u.price, key = u.id + (second ? "-2" : "");
    return `<div class="scr" style="gap:14px">
      ${S.flags.upFlow && !second && id === CONFIG.UPSELLS[0].id && S.paid ? `<div class="ok-banner"><span class="ok-ic">${ico("check", 16)}</span><span>${esc(planById(S.paid).name)} is active. Your HD download is unlocked.</span></div>` : ""}
      <div class="top"><span class="pill chip">${ico("gift", 14)} One-time add-on</span><span class="spacer"></span></div>
      <span class="tbub" style="--tc:var(--lilac)">${ico(u.icon, 30)}</span>
      <h1 class="h1 xl">${esc(u.title)}</h1>
      <div class="col" style="font-size:14px;font-weight:700;gap:9px">${u.points.map((t) => `<div class="top" style="justify-content:flex-start;gap:10px">${ico("check", 20)}<span>${esc(t)}</span></div>`).join("")}</div>
      <p class="small center" style="font-size:13px;font-weight:800">${second ? "One more offer" : "Pay once"}: $${price.toFixed(2)}. No subscription, nothing renews.</p>
      <button class="cta" data-act="upBuy" data-v="${key}">${ico("lock", 22)} Add ${esc(u.name)} · $${price.toFixed(2)}</button>
      <button class="link" data-act="upNo" data-v="${key}">No thanks</button>
      <p class="small center" style="font-size:11px">Your Glow plan stays active. Payments by Stripe. <a href="terms.html" target="_blank" rel="noopener">Terms</a></p></div>`;
  },
  mount: async (arg) => {
    const u = upsellOf(String(arg || "").split("-")[0]) || CONFIG.UPSELLS[0];
    trackOnce("AddOnView_" + u.id);
    if (testerOn()) return;
    if (ui.ai === null) await checkAI();
    if (!ui.ai?.upsells) { toast("Add-ons are not available yet."); go(nextOffer(u.id)); }
  },
};
ACT.upBuy = async (v, el) => {
  const [id, phase] = String(v).split("-"), u = upsellOf(id); if (!u) return;
  const skip = phase === "2", price = skip ? u.skipPrice : u.price;
  track("InitiateCheckout", { value: price, currency: CONFIG.CURRENCY, content_name: "addon_" + u.id });
  if (testerOn()) { S.owned = { ...S.owned, [u.id]: 1 }; save(); toast(`Tester mode: ${u.name} unlocked`); return go(nextOffer(u.id)); }
  const label = el && el.textContent;
  if (el) { el.disabled = true; el.textContent = "Opening secure checkout…"; }
  waitScreen("Opening secure checkout", "You'll be on Stripe in a moment.");
  try {
    const r = await fetchT("api/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "upsell", item: u.id, skip, email: S.email || "", utm: S.utm, customer: S.billing?.customer, token: S.billing?.token }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) throw new Error(j.error || "Checkout didn't open. Try again.");
    location.href = j.url;
  } catch (e) { hideWait(); if (el) { el.disabled = false; el.textContent = label; } toast(String(e.message || e).slice(0, 160)); }
};
ACT.upNo = (v) => {
  const [id, phase] = String(v).split("-");
  track("AddOnDeclined", { item: id, second_chance: phase === "2" });
  if (phase !== "2" && S.flags.upFlow) return go(`up/${id}-2`); // the second-chance price is only part of the post-checkout sequence
  go(nextOffer(id));
};
// Stripe Customer Portal: change plan, update card, cancel (the signed token proves this browser is the buyer).
ACT.manageSub = async (_v, el) => {
  if (!S.billing?.customer) return toast("Open the link in your receipt email to manage the plan.");
  if (el) el.disabled = true;
  try {
    const r = await fetch("api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(S.billing) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) throw new Error(j.error || "Couldn't open billing. Try again.");
    track("ManageSubscription"); location.href = j.url;
  } catch (e) { if (el) el.disabled = false; toast(String(e.message || e).slice(0, 160)); }
};
ACT.notNow = () => { track("PaywallDismissed"); go(S.flags.glow ? "preview" : S.freeStart ? "today" : "freeoffer"); };

R.waitlist = {
  needs: true,
  view: () => {
    const p = planById(S.chosen);
    return `<div class="scr"><div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px">
      <span class="pill" style="align-self:flex-start;background:var(--yel);color:var(--ink)">Early access</span>
      <h1 class="h1 xl">Payments open <span class="hl">in a few days</span></h1>
      <p class="sub">You picked the <b style="color:var(--text)">${p.name}</b>. We saved your spot with <b style="color:var(--text)">50% off your first payment</b>.</p>
      ${S.email ? `<div class="row"><span><b>We'll email you first</b><small>${esc(S.email)}</small></span><span class="r">✓</span></div>`
        : `<input class="input" id="wem" type="email" placeholder="you@email.com" autocomplete="email"><button class="ghost" data-act="waitEmail">Save my spot</button>`}
      ${S.flags.glow ? `<div class="row" style="background:var(--mint);color:var(--ink)"><span><b>Meanwhile</b><small>${CONFIG.FREE_PREVIEWS} free edits, with before and after</small></span><span class="r">Free</span></div>`
        : `<div class="row" style="background:var(--mint);color:var(--ink)"><span><b>Meanwhile: your free week</b><small>2-step routine, ${CONFIG.FREE_LOOKS} looks, day-7 re-scan</small></span><span class="r">Free</span></div>`}
    </div>${S.flags.glow ? `<button class="cta inline" data-go="preview">Back to my edits</button>` : `<button class="cta inline" data-act="startFree">Start my free week now</button>`}</div>`;
  },
  mount: () => { if (!S.waitlist) { S.waitlist = S.chosen; save(); track("JoinWaitlist", { plan: S.chosen, value: planById(S.chosen).price, currency: CONFIG.CURRENCY }); } },
};
ACT.waitEmail = () => {
  const v = $("#wem").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return toast("Check your email address");
  S.email = v; save(); track("Lead"); postLead({ step: "waitlist" }); render();
};

R.freeoffer = {
  needs: true,
  view: () => `<div class="scr">
    <div class="top">${backBtn("paywall")}<span class="spacer"></span></div>
    <div class="photo" style="height:230px;background:var(--mint)"><canvas id="fc"></canvas>
      <span class="tl"><span class="pill dark">Free · no card</span></span><span class="tr"><span class="pill">${CONFIG.FREE_DAYS} days</span></span></div>
    <h1 class="h1">Not ready? <span class="hl">Try a light week free</span></h1>
    <div class="grid2">
      <div class="card" style="padding:14px;border-radius:22px"><small style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--pl)">Free week</small><span style="font-size:13px;font-weight:700;line-height:1.6">✓ Your twin<br>✓ ${CONFIG.FREE_LOOKS} try-on looks<br>✓ 2-step daily routine<br>✓ Streak + reminders</span></div>
      <div class="card" style="padding:14px;border-radius:22px;opacity:.75"><small style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Full plan</small><span style="font-size:13px;font-weight:700;line-height:1.6">🔒 Full routine<br>🔒 Every look<br>🔒 Before / after<br>🔒 Weekly updates</span></div>
    </div>
    <p class="sub">On day 7 you re-scan your face and see the change yourself.</p>
    <button class="cta" data-act="startFree">Start my free week</button>
    <button class="link" data-go="paywall">Actually, get the full plan</button></div>`,
  mount: () => drawPhoto($("#fc"), "front", S.applied),
};
ACT.startFree = () => {
  if (!S.freeStart) { S.freeStart = now().toISOString(); track("StartTrial", { value: 0, currency: CONFIG.CURRENCY, predicted_ltv: 0 }); }
  if (!S.startedAt) S.startedAt = S.freeStart;
  save(); go(homeFor());
};

R.welcome = {
  needs: true,
  view: () => `<div class="scr"><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center">
    <div style="width:220px;height:220px;border-radius:50%;background:var(--p);padding:18px"><div class="photo" style="width:100%;height:100%;border-radius:50%"><canvas id="wc"></canvas></div></div>
    <h1 class="h1 xl">Welcome to <span class="hl">your plan</span></h1>
    <p class="sub">Your first routine is ready. It takes about ${S.minutes} minutes.</p></div>
    <button class="cta inline" data-go="${homeFor()}">${S.goal === "look" ? "Try my first look" : S.goal === "skin" ? "Start day 1" : "Start my first workout"}</button></div>`,
  mount: () => drawPhoto($("#wc"), "front", S.applied),
};

// =============== DAILY LOOP ===============
function stepRow(s, done) {
  if (s.locked) return `<button class="step locked" data-act="locked"><span style="font-size:18px;width:30px;text-align:center">🔒</span><span class="t"><b>${s.name}</b><small>In the full plan</small></span></button>`;
  return `<div class="step ${done ? "done" : ""}" style="background:${s.color}">
    <button class="check" data-act="check" data-v="${s.id}" aria-label="Mark ${esc(s.name)} done">${done ? "✓" : ""}</button>
    <a class="t" data-go="step/${s.id}" href="#/step/${s.id}" style="color:inherit;text-decoration:none"><b>${s.name}</b><small>${s.when === "am" ? "Morning" : "Evening"} · ${s.min < 1 ? "30 sec" : s.min + " min"}${s.focus ? " · " + s.focus : ""}</small></a>
    <span style="font-weight:800">›</span></div>`;
}
const lastScanDays = () => (latest() ? daysBetween(new Date(latest().date + "T12:00:00"), now()) : 99);
R.today = {
  needs: true, app: true, tab: "today",
  view: () => {
    const d = now(), steps = todaySteps(d), done = doneOn(dkey(d));
    const open = steps.filter((s) => !s.locked), n = open.filter((s) => done.includes(s.id)).length;
    const pct = open.length ? n / open.length : 0, st = streak(), h = d.getHours();
    const am = steps.filter((s) => s.when === "am"), pm = steps.filter((s) => s.when === "pm");
    const scanDue = lastScanDays() >= 7, fo = freeOver();
    return `<div class="scr tabbed">
      <div class="top"><div><div class="small" style="font-weight:700">${isPaid() ? `Week ${week()}` : `Free week · day ${Math.min(freeDay(), CONFIG.FREE_DAYS)} of ${CONFIG.FREE_DAYS}`} · ${DOW[d.getDay()]}</div>
        <div class="h1" style="font-size:39px">${h < 12 ? "Good morning" : h < 18 ? "Hi there" : "Good evening"}</div></div>
        <span class="pill">🔥 ${st} ${st === 1 ? "day" : "days"}</span></div>
      ${fo ? `<button class="row" style="background:var(--p);color:#fff" data-go="${scanDue ? "scan" : "paywall/day7"}"><span><b>Your free week is done</b><small>${scanDue ? "Do your day-7 re-scan and see the change" : "See your before / after and keep going"}</small></span><span class="r">›</span></button>` : ""}
      <div class="card" style="background:var(--lilac);color:var(--ink);flex-direction:row;justify-content:space-between;align-items:center">
        <div><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase">Today's routine</div>
          <div class="h1" style="font-size:34px">${n} of ${open.length} done</div>
          <div class="small" style="color:var(--ink);opacity:.7;font-weight:700">${open.length - n ? `About ${Math.max(1, Math.round(open.filter((s) => !done.includes(s.id)).reduce((a, s) => a + s.min, 0)))} min left` : "All done for today"}</div></div>
        <svg width="76" height="76" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="32" fill="none" stroke="#fff" stroke-width="10"/><circle cx="40" cy="40" r="32" fill="none" stroke="#7C4DFF" stroke-width="10" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 - pct * 100}" transform="rotate(-90 40 40)" opacity="${pct ? 1 : 0}"/></svg></div>
      ${am.length ? `<div class="small" style="font-weight:800;letter-spacing:.08em;text-transform:uppercase">Morning</div><div class="col">${am.map((s) => stepRow(s, done.includes(s.id))).join("")}</div>` : ""}
      ${pm.length ? `<div class="small" style="font-weight:800;letter-spacing:.08em;text-transform:uppercase">Evening</div><div class="col">${pm.map((s) => stepRow(s, done.includes(s.id))).join("")}</div>` : ""}
      ${shelfRow()}
      <button class="row" data-go="scan"><span><b>${scanDue ? "Re-scan due today" : "Weekly re-scan"}</b><small>${scanDue ? "30 seconds · see what changed" : `Next one in ${7 - lastScanDays()} days`}</small></span><span class="r" style="color:var(--pl)">${scanDue ? "Start ›" : "›"}</span></button>
      ${!S.reminders ? `<button class="row" style="border:2px dashed var(--p)" data-go="reminders"><span><b>🔔 Get a daily reminder</b><small>Calendar alert or Home Screen app</small></span><span class="r">›</span></button>` : ""}
      ${!isPaid() && !fo ? `<button class="row" data-go="paywall"><span><b>Unlock your full plan</b><small>${plan().steps.length} steps made for your face</small></span><span class="r" style="color:var(--pl)">See plans</span></button>` : ""}
    </div>`;
  },
  mount: () => {
    if (freeOver() && !S.flags["day7_" + dkey()]) { S.flags["day7_" + dkey()] = 1; save(); trackOnce("FreeWeekEnded"); }
  },
};
ACT.locked = () => upsell("This step is in your full plan");
ACT.check = (id) => {
  const k = dkey(), arr = new Set(doneOn(k));
  if (arr.has(id)) arr.delete(id); else { arr.add(id); track("RoutineStep", { step: id }); }
  S.checks[k] = [...arr]; save();
  if (dayComplete(now()) && !S.flags["done_" + k]) { S.flags["done_" + k] = 1; save(); track("DayComplete", { streak: streak() }); go("daydone"); return; }
  render();
};

R.step = {
  needs: true, app: true,
  view: (id) => {
    const steps = todaySteps().filter((s) => !s.locked), idx = Math.max(0, steps.findIndex((s) => s.id === id)), s = steps[idx];
    if (!s) return `<div class="scr"><p class="sub">No step here today.</p><button class="cta" data-go="today">Back to today</button></div>`;
    ui.stepSecs = Math.round(s.min * 60);
    return `<div class="scr">
      <div class="top">${backBtn("today")}${bar(idx + 1, steps.length)}</div>
      <div class="top"><span class="small" style="font-weight:800">Step ${idx + 1} of ${steps.length} · ${s.when === "am" ? "Morning" : "Evening"}</span>${s.focus ? `<span class="pill chip" style="font-size:12px;padding:7px 11px">${s.focus}</span>` : ""}</div>
      <h1 class="h1 xl">${s.name}</h1>
      <div class="photo" style="height:300px;background:${s.color};display:flex;align-items:flex-end;justify-content:center">${faceArt({ w: 220, h: 264, hair: "bob" })}</div>
      <div class="card" style="flex-direction:row;align-items:center;gap:14px">
        <button id="tbtn" data-act="timer" style="width:66px;height:66px;border-radius:50%;border:0;cursor:pointer;background:conic-gradient(var(--p) 0 0%,var(--line) 0% 100%);display:flex;align-items:center;justify-content:center;flex:none"><span id="tval" style="width:54px;height:54px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">▶ ${fmt(ui.stepSecs)}</span></button>
        <span style="font-size:14px;font-weight:700;line-height:1.45">${s.how}</span></div>
      ${SHELF[s.id] ? (() => { const p = pickFor(s.id); return `<button class="row" data-go="shelf"><span><b>${S.shelf.own[s.id] ? "Using what you have ✓" : esc(p.name)}</b><small>${S.shelf.own[s.id] ? SHELF[s.id].what : `${SHELF[s.id].what} · ≈ $${p.price}`}</small></span><span class="r" style="color:var(--pl)">My shelf ›</span></button>`; })() : ""}
      <button class="cta" data-act="stepDone" data-v="${s.id}">Done · next step</button></div>`;
  },
  mount: () => { ui.timer = null; ui.left = ui.stepSecs; cleanup.push(() => clearInterval(ui.timer)); },
};
const fmt = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
ACT.timer = () => {
  if (ui.timer) { clearInterval(ui.timer); ui.timer = null; $("#tval").textContent = "▶ " + fmt(ui.left); return; }
  ui.timer = setInterval(() => {
    ui.left = Math.max(0, ui.left - 1);
    const p = 100 - (ui.left / ui.stepSecs) * 100;
    const b = $("#tbtn"); if (!b) return clearInterval(ui.timer);
    b.style.background = `conic-gradient(var(--p) 0 ${p}%,var(--line) ${p}% 100%)`;
    $("#tval").textContent = fmt(ui.left);
    if (!ui.left) { clearInterval(ui.timer); ui.timer = null; navigator.vibrate?.(200); $("#tval").textContent = "✓"; }
  }, 1000);
};
ACT.stepDone = (id) => {
  const k = dkey(), arr = new Set(doneOn(k));
  if (!arr.has(id)) { arr.add(id); track("RoutineStep", { step: id }); }
  S.checks[k] = [...arr]; save();
  const next = todaySteps().filter((s) => !s.locked && !arr.has(s.id))[0];
  if (next) go("step/" + next.id);
  else { if (!S.flags["done_" + k]) { S.flags["done_" + k] = 1; save(); track("DayComplete", { streak: streak() }); } go("daydone"); }
};

R.daydone = {
  needs: true, app: true,
  view: () => {
    const st = streak(), d = now(), mon = new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY);
    const tomorrow = todaySteps(new Date(d.getTime() + DAY)).filter((s) => !s.locked).length;
    return `<div class="scr"><div class="top"><span class="spacer"></span><button class="back" data-go="today" aria-label="Close" style="font-size:20px;font-weight:800">×</button></div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center">
        <div style="width:230px;height:230px;border-radius:50%;background:var(--p);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <span style="font-size:54px;line-height:1">🔥</span><span style="font-family:var(--h);font-size:64px;font-weight:800;line-height:1">${st}</span><span style="font-size:14px;font-weight:800">day streak</span></div>
        <h1 class="h1 xl">Day done. <span class="hl">Nice work.</span></h1>
        <p class="sub">Tomorrow: ${tomorrow} ${tomorrow === 1 ? "step" : "steps"}. Same time is easiest.</p></div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">${Array.from({ length: 7 }, (_, i) => {
        const day = new Date(mon.getTime() + i * DAY), ok = dayComplete(day);
        return `<div class="center" style="display:flex;flex-direction:column;align-items:center;gap:6px"><span style="width:36px;height:36px;border-radius:50%;background:${ok ? "var(--p)" : "var(--chip)"};display:flex;align-items:center;justify-content:center;font-weight:800">${ok ? "✓" : ""}</span><span class="small" style="font-weight:800">${"MTWTFSS"[i]}</span></div>`;
      }).join("")}</div>
      <button class="cta inline" data-go="studio">Play with a new look</button></div>`;
  },
};

// ---------- studio ----------
R.studio = {
  needs: true, app: true, tab: "preview",
  view: () => {
    const cats = V.CATS;
    const left = Math.max(0, CONFIG.FREE_LOOKS - S.tried.length);
    return `<div class="scr tabbed">
      <div class="top"><span class="h1" style="font-size:36px">Try on</span><button class="pill chip" data-go="progress">Saved ${S.saved.length}</button></div>
      <div class="scroll-x">${cats.map((c) => `<button class="chip sm ${ui.cat === c ? "on" : ""}" data-act="cat" data-v="${c}">${c}</button>`).join("")}</div>
      ${stageHTML("52vh", `<div class="br" style="display:flex;flex-direction:column;gap:8px"><button class="back" data-act="saveLook" aria-label="Save look">${ICON.heart}</button><button class="back" data-go="share" aria-label="Share">${ICON.share}</button></div>`)}
      <div class="grid3">${V.LOOKS.filter((l) => l.cat === ui.cat).map((l, i) => {
        const on = S.applied.includes(l.id), lock = !isPaid() && !S.tried.includes(l.id) && S.tried.length >= CONFIG.FREE_LOOKS;
        const wait = l.hair && !V.hairReady() && !V.hairFailed(), off = false;
        return `<button class="tile ${on ? "on" : ""}" style="height:110px;background:${PASTEL[i % 6]};${lock ? "opacity:.55" : ""}" data-act="look" data-v="${l.id}"><span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-bottom:18px">${lookArt(l, 64, 78)}</span><span style="position:relative">${lock ? "🔒 " : ""}${l.name}${off ? " · offline" : wait ? " · loading" : ""}</span><span class="ck">✓</span></button>`;
      }).join("")}</div>
      ${ui.cat === "Hair" ? `<label class="row" style="cursor:pointer"><span><b>Pick any hair color</b><small>Tap the circle, choose a shade</small></span><input type="color" value="${S.customHair}" data-change="customHair" style="width:46px;height:46px;border:0;background:none;padding:0;cursor:pointer" aria-label="Choose hair color"></label>` : ""}
      ${ui.cat !== "Glasses" ? `<div class="card" style="padding:12px 16px;gap:6px"><div class="top"><b style="font-size:14px">${ui.cat} strength</b><span class="small" style="font-weight:800">${Math.round((S.intensity[ui.cat] ?? DEF_K[ui.cat]) * 100)}%</span></div>
        <input type="range" min="20" max="100" step="5" value="${Math.round((S.intensity[ui.cat] ?? DEF_K[ui.cat]) * 100)}" data-change="intensity" data-v="${ui.cat}" aria-label="${ui.cat} strength" style="width:100%;accent-color:#7C4DFF"></div>` : ""}
      ${!isPaid() ? `<p class="small center">${left ? `${left} free ${left === 1 ? "look" : "looks"} left to try` : `Free looks used · <a href="#/paywall">unlock all</a>`}</p>` : ""}
    </div>`;
  },
  mount: async () => {
    if (ui.cat === "Hair" && !V.hairReady()) V.loadHair().then((ok) => { if (ok && location.hash.startsWith("#/studio")) render(); });
    await mountStage(S.applied);
  },
};
ACT.cat = (v) => { ui.cat = v; render(); };
const DEF_K = { Hair: 0.8, Skin: 0.7, Brows: 0.75, Lips: 0.75 };
const CHG = {
  intensity: (val, el) => { S.intensity[el.dataset.v] = +val / 100; save(); track("LookStrength", { cat: el.dataset.v, value: +val }); render(); },
  customHair: (val) => {
    S.customHair = val;
    if (!S.applied.includes("custom")) { toggleLook("custom"); return; }
    save(); render();
  },
};
app.addEventListener("change", (e) => { const el = e.target.closest("[data-change]"); if (el && CHG[el.dataset.change]) CHG[el.dataset.change](el.value, el); });

// ---------- my shelf ----------
const pickFor = (id) => { const e = SHELF[id]; return e ? e[S.shelf.pick[id] || S.shelf.tier] : null; };
function shelfItems() {
  const steps = plan().steps.filter((st) => SHELF[st.id]);
  return steps.map((st) => ({ ...st, locked: !isPaid() && !st.free, own: !!S.shelf.own[st.id], p: pickFor(st.id), tier: S.shelf.pick[st.id] || S.shelf.tier }));
}
function shelfTotals() {
  const it = shelfItems().filter((i) => !i.locked);
  const buy = it.filter((i) => !i.own), own = it.filter((i) => i.own);
  return { buy, own, cost: buy.reduce((a, i) => a + i.p.price, 0), saved: own.reduce((a, i) => a + i.p.price, 0) };
}
function shelfRow() {
  const t = shelfTotals();
  if (!t.buy.length && !t.own.length) return "";
  return `<button class="row" data-go="shelf"><span><b>🧴 My shelf</b><small>${t.buy.length ? `${t.buy.length} to get · ≈ $${t.cost}` : "You have everything for today's routine"}${t.saved ? ` · saved ≈ $${t.saved}` : ""}</small></span><span class="r" style="color:var(--pl)">Open ›</span></button>`;
}
const buyUrl = (name) => {
  let u = CONFIG.SHOP_SEARCH_URL.replace("{q}", encodeURIComponent(name));
  if (CONFIG.AFFILIATE_TAG) u += (u.includes("?") ? "&" : "?") + "tag=" + encodeURIComponent(CONFIG.AFFILIATE_TAG);
  return u;
};
const listText = () => {
  const t = shelfTotals();
  return ["My FaceTwin shopping list", ...t.buy.map((i) => `• ${i.name}: ${i.p.name} (≈ $${i.p.price})`), `Total ≈ $${t.cost}`,
    t.own.length ? `Already have: ${t.own.map((i) => i.name).join(", ")}` : ""].filter(Boolean).join("\n");
};
R.shelf = {
  needs: true, app: true, tab: "today",
  view: () => {
    const items = shelfItems(), t = shelfTotals();
    return `<div class="scr tabbed">
      <div class="top"><span class="h1" style="font-size:39px">My shelf</span><span class="pill">${t.buy.length} to get</span></div>
      <p class="sub" style="margin-top:-6px">One pick for every step of your routine. Already have something similar? Tick it and skip buying.</p>
      <div class="seg">${TIERS.map((x) => `<button class="${S.shelf.tier === x.id ? "on" : ""}" data-act="shelfTier" data-v="${x.id}">${x.label}</button>`).join("")}</div>
      <div class="card" style="background:var(--lilac);color:var(--ink);flex-direction:row;justify-content:space-between;align-items:center">
        <div><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase">Shopping list</div>
          <div class="h1" style="font-size:36px">≈ $${t.cost}</div>
          <div style="font-size:13px;font-weight:700;opacity:.7">${t.buy.length} ${t.buy.length === 1 ? "item" : "items"}${t.saved ? ` · you saved ≈ $${t.saved} with what you have` : ""}</div></div>
        <span style="font-size:40px">🧴</span></div>
      <div class="col" style="gap:10px">${items.map((i) => i.locked
        ? `<button class="step locked" data-act="locked"><span style="font-size:18px;width:30px;text-align:center">🔒</span><span class="t"><b>${i.name}</b><small>Product pick unlocks with the full plan</small></span></button>`
        : `<div class="card" style="gap:8px;border-left:6px solid ${i.color};${i.own ? "opacity:.7" : ""}">
            <div class="top"><span><b style="font-size:15px">${i.name}</b><br><small class="small">${SHELF[i.id].what} · ${i.when === "am" ? "morning" : "evening"}</small></span>
              <button class="chip sm ${i.own ? "on" : ""}" data-act="shelfOwn" data-v="${i.id}">${i.own ? "Have it ✓" : "I have one"}</button></div>
            ${i.own ? "" : `<div class="col" style="gap:6px">${TIERS.map((x) => { const p = SHELF[i.id][x.id], on = i.tier === x.id;
              return `<button class="row" style="padding:11px 14px;border-radius:16px;${on ? "background:var(--p);color:#fff" : "background:var(--chip)"}" data-act="shelfPick" data-v="${i.id}:${x.id}"><span><b style="font-size:14px">${esc(p.name)}</b><small>${x.label}</small></span><span class="r">≈ $${p.price}</span></button>`; }).join("")}
              <a class="link p" style="text-align:right" href="${buyUrl(i.p.name)}" target="_blank" rel="noopener sponsored" data-act="shelfBuy" data-v="${i.id}">Find it ›</a></div>`}
          </div>`).join("")}</div>
      <div class="grid2"><button class="ghost" data-act="shelfCopy">Copy list</button><button class="ghost" data-act="shelfSave">Save list</button></div>
      <p class="small center">Prices are approximate. Not sponsored: picks are chosen for the step, not the brand. Patch-test anything new.</p>
    </div>`;
  },
  mount: () => trackOnce("ShelfView"),
};
ACT.shelfTier = (v) => { S.shelf.tier = v; S.shelf.pick = {}; save(); track("ShelfTier", { tier: v }); render(); };
ACT.shelfPick = (v) => { const [id, tier] = v.split(":"); S.shelf.pick[id] = tier; save(); render(); };
ACT.shelfOwn = (id) => { S.shelf.own[id] = !S.shelf.own[id]; save(); if (S.shelf.own[id]) track("ShelfOwn", { step: id }); render(); };
ACT.shelfBuy = (id, el) => {
  const p = pickFor(id);
  track("ShelfBuyClick", { content_name: p.name, value: p.price, currency: CONFIG.CURRENCY, step: id });
  window.open(el.href, "_blank", "noopener");
};
ACT.shelfCopy = async () => { try { await navigator.clipboard.writeText(listText()); toast("Shopping list copied"); } catch { toast("Couldn't copy. Try Save list."); } track("ShelfListCopied"); };
ACT.shelfSave = () => { download(new Blob([listText()], { type: "text/plain" }), "facetwin-shopping-list.txt"); track("ShelfListSaved"); };

// ---------- weekly re-scan ----------
R.scan = { needs: true, app: true, view: () => selfieView("scan"), mount: () => mountCamera("scan") };
async function addScan(dataUrl) {
  await V.loadFace();
  const img = await loadImg(dataUrl), c = toCanvas(img, 480), lm = V.detect(c);
  if (!lm) { toast("We couldn't see your face. Try again in better light."); track("ScanFailed"); return false; }
  const a = V.analyze(c, lm);
  S.scans.push({ date: dkey(), img: c.toDataURL("image/jpeg", 0.85), a, lm });
  save(); track("WeeklyScan", { week: week(), score: a.score, scans: S.scans.length });
  return true;
}
const trend = (first, last, lowerIsBetter = true) => {
  const d = last - first; if (Math.abs(d) < 0.08) return ["Same", "var(--card)", "var(--text)"];
  const better = lowerIsBetter ? d < 0 : d > 0;
  return better ? ["Better", "var(--mint)", "var(--ink)"] : ["Watch", "var(--yel)", "var(--ink)"];
};
R.scanresult = {
  needs: true, app: true,
  view: () => {
    const f = S.scans[0], l = latest(), delta = l.a.score - f.a.score, p = plan();
    const rows = [["Skin texture", "texture"], ["Redness", "redness"], ["Under-eyes", "darkCircles"]].map(([t, k]) => {
      const [lab, bg, fg] = S.scans.length > 1 ? trend(f.a[k], l.a[k]) : ["Baseline", "var(--card)", "var(--text)"];
      return `<div class="row" style="background:${bg};color:${fg}"><span><b>${t}</b><small>${S.scans.length > 1 ? `Week 0 → now` : "Your starting point"}</small></span><span class="r" style="font-family:var(--h);font-size:20px">${lab}</span></div>`;
    }).join("");
    const freeEnd = !isPaid() && freeDay() >= CONFIG.FREE_DAYS;
    return `<div class="scr">
      <div class="top">${backBtn("today")}<span class="pill chip">Week ${week()} check-in</span><span class="spacer"></span></div>
      <h1 class="h1">${delta > 0 ? `Look how far <span class="hl">you've come</span>` : `Scan saved. <span class="hl">Keep going.</span>`}</h1>
      ${compareHTML(f.img, l.img, f.date === l.date ? "Before" : "Week 0", `Now · ${l.a.score}`, "46vh")}
      <div class="col">${rows}</div>
      <div class="row"><span><b>Next week's plan</b><small>${p.steps.length} steps${p.fromScan.length ? " · adjusted from your scan" : ""}</small></span><span class="r" style="color:var(--pl)">Updated</span></div>
      <p class="small">Light and angle move the numbers a little, so watch the trend over weeks, not one photo.</p>
      <button class="cta" data-go="${freeEnd ? "paywall/day7" : "progress"}">${freeEnd ? "Keep my progress" : "See my progress"}</button>
      <button class="link p" data-go="share">Share my glow-up ↗</button></div>`;
  },
};

// =============== FEATURE 1: FACE EXERCISE COACH ===============
// The camera counts her reps and checks her form live, on the phone. Nothing is recorded or uploaded.
const exDays = () => [...new Set(S.exLog.map((r) => r.d))].sort();
function exStreak() {
  const days = new Set(exDays());
  let n = 0, d = now();
  if (!days.has(dkey(d))) d = new Date(d.getTime() - DAY);
  while (days.has(dkey(d))) { n++; d = new Date(d.getTime() - DAY); }
  return n;
}
const exLast = (id) => [...S.exLog].reverse().find((r) => r.id === id);
const exFirst = (id) => S.exLog.find((r) => r.id === id);
const exDoneToday = () => new Set(S.exLog.filter((r) => r.d === dkey()).map((r) => r.id));
function exDemo(id, size = 120) {
  return `<svg class="exd exd-${id}" width="${size}" height="${Math.round(size * 1.15)}" viewBox="0 0 120 138" aria-hidden="true">
    <g class="exd-head">
      <ellipse cx="60" cy="66" rx="40" ry="50" fill="#F1CDB3"/>
      <path d="M20 58 Q22 12 60 14 Q98 12 100 58 Q92 30 60 30 Q28 30 20 58Z" fill="#4A2C20"/>
      <g class="exd-brows"><path d="M34 50 Q42 45 50 49" stroke="#4A2C20" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M70 49 Q78 45 86 50" stroke="#4A2C20" stroke-width="4" fill="none" stroke-linecap="round"/></g>
      <circle cx="43" cy="60" r="3.6" fill="#1A1412"/><circle cx="77" cy="60" r="3.6" fill="#1A1412"/>
      <path d="M60 64 L56 80 Q60 83 64 80" stroke="#C99A80" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <g class="exd-cheeks"><circle cx="34" cy="86" r="9" fill="#F0A8A0" opacity=".55"/><circle cx="86" cy="86" r="9" fill="#F0A8A0" opacity=".55"/></g>
      <ellipse class="exd-mouth" cx="60" cy="97" rx="11" ry="3.4" fill="#A8404F"/>
    </g></svg>`;
}

R.coach = {
  needs: true, tab: "coach",
  view: () => {
    const ids = workoutFor(now()), today = exDoneToday(), n = ids.filter((id) => today.has(id)).length, st = exStreak();
    const mins = Math.round(ids.reduce((a, id) => a + exById(id).reps * (exById(id).phases[0].hold ? 6 : 3) + 15, 0) / 60);
    return `<div class="scr ${S.startedAt ? "tabbed" : ""}">
      <div class="top">${S.startedAt ? `<span class="h1" style="font-size:36px">Face workout</span>` : `${backBtn("twin")}<span class="h1" style="font-size:31px">Face workout</span>`}
        <span class="pill">🔥 ${st} ${st === 1 ? "day" : "days"}</span></div>
      <div class="card" style="background:var(--lilac);color:var(--ink);gap:10px">
        <div class="top"><div><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase">Today · jawline + cheeks</div>
          <div class="h1" style="font-size:34px">${n === ids.length ? "Done for today" : `${ids.length} exercises · ~${mins} min`}</div></div>
          ${exDemo("jaw", 64)}</div>
        <div style="display:flex;gap:6px">${ids.map((id) => `<span style="flex:1;height:8px;border-radius:4px;background:${today.has(id) ? "#7C4DFF" : "rgba(14,14,20,.15)"}"></span>`).join("")}</div>
        <button class="cta inline" style="margin:0" data-act="woStart">${n && n < ids.length ? "Continue workout" : n === ids.length ? "Do it again" : "Start workout"}</button>
      </div>
      <div class="row" style="background:var(--card)"><span><b>📷 Your camera is your coach</b><small>It counts every rep and checks your form live. Nothing is recorded.</small></span></div>
      <div class="top"><b style="font-size:17px">All exercises</b><span class="small">${EXERCISES.length}</span></div>
      <div class="col">${EXERCISES.map((e, i) => { const l = exLast(e.id); return `<button class="row" data-go="ex/${e.id}" style="text-align:left">
        <span style="display:flex;gap:12px;align-items:center"><span style="width:46px;height:46px;border-radius:14px;background:${PASTEL[i % 6]};display:flex;align-items:center;justify-content:center;flex:none;color:var(--ink)">${ico(e.icon, 26)}</span>
        <span><b>${e.name}</b><small>${e.area} · ${e.reps} reps${e.phases[0].hold ? ` × ${e.phases[0].hold / 1000}s hold` : ""}${l ? ` · last reach ${l.rom}%` : ""}</small></span></span>
        <span class="r">${today.has(e.id) ? "✓" : "›"}</span></button>`; }).join("")}</div>
      ${HAS3D ? `<button class="row" data-go="twin"><span><b>My 3D twin</b><small>See your face from every side</small></span><span class="r">›</span></button>` : ""}
      <p class="small center">Face exercises are for fitness and relaxation. Stop if anything hurts. Results differ for everyone.</p>
    </div>`;
  },
};
ACT.woStart = () => {
  if (freeOver()) return upsell("Your free week is over");
  const ids = workoutFor(now()), today = exDoneToday();
  const rest = ids.filter((id) => !today.has(id));
  ui.wo = { ids: rest.length ? rest : ids, i: 0, results: [] };
  track("WorkoutStart", { exercises: ui.wo.ids.length });
  ui.exLive = true; ui.exResult = null;
  go("ex/" + ui.wo.ids[0]);
};

R.ex = {
  needs: true,
  view: (id) => {
    const e = exById(id) || EXERCISES[0], wo = ui.wo && ui.wo.ids[ui.wo.i] === e.id ? ui.wo : null;
    const head = `<div class="top">${backBtn("coach")}${wo ? bar(wo.i + 1, wo.ids.length) : `<span class="pill chip">${e.area}</span>`}<button class="back" data-act="exSound" aria-label="Sound ${S.exSound ? "on" : "off"}" style="font-size:18px">${S.exSound ? "🔊" : "🔇"}</button></div>`;
    if (ui.exResult) {
      const r = ui.exResult, next = wo && wo.ids[wo.i + 1] ? exById(wo.ids[wo.i + 1]) : null, f = exFirst(e.id);
      return `<div class="scr">${head}
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center">
          <div style="width:170px;height:170px;border-radius:50%;background:var(--p);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <span style="font-family:var(--h);font-size:58px;font-weight:800;line-height:1">${r.reps}</span><span style="font-size:13px;font-weight:800">of ${r.target} reps</span></div>
          <h1 class="h1">${r.reps >= r.target ? `${esc(e.name)} <span class="hl">done</span>` : `Good effort`}</h1>
          <div class="grid3" style="width:100%">
            <div class="card" style="padding:12px;gap:4px;border-radius:20px"><small class="small">Reach</small><b style="font-size:18px">${r.rom}%</b></div>
            <div class="card" style="padding:12px;gap:4px;border-radius:20px"><small class="small">Form</small><b style="font-size:18px">${r.form}%</b></div>
            <div class="card" style="padding:12px;gap:4px;border-radius:20px"><small class="small">Time</small><b style="font-size:18px">${fmt(r.secs)}</b></div></div>
          <p class="sub" style="font-size:14px">${f && f !== exLast(e.id) && r.rom > f.rom ? `Your reach is up ${r.rom - f.rom} points since your first time.` : "Reach = how far you moved, compared with a full standard range. It grows as the muscles get stronger."}</p></div>
        ${next ? `<button class="cta" data-act="woNext">Next: ${esc(next.name)}</button>` : wo ? `<button class="cta" data-act="woNext">Finish workout</button>` : `<button class="cta" data-act="exAgain">Do it again</button><button class="link" data-go="coach">Back to exercises</button>`}
      </div>`;
    }
    if (!ui.exLive) {
      return `<div class="scr">${head}
        <h1 class="h1 xl">${esc(e.name)}</h1>
        <div class="photo" style="height:250px;background:var(--lilac);display:flex;align-items:center;justify-content:center">${exDemo(e.id, 170)}
          <span class="tl"><span class="pill dark">${e.muscles}</span></span><span class="tr"><span class="pill">${e.reps} reps</span></span></div>
        <div class="card"><b>How to do it</b><span style="font-size:14px;font-weight:700;line-height:1.5">${esc(e.how)}</span></div>
        <div class="row"><span><b>📷 We'll use your front camera</b><small>Hold the phone at face height. First, relax your face for 2 seconds so the coach learns your neutral face.</small></span></div>
        <button class="cta" data-act="exGo">Start · camera on</button></div>`;
    }
    return `<div class="scr" style="gap:12px">${head}
      <div class="photo" id="exStage" style="aspect-ratio:3/4;max-height:64vh;background:#0E0E14">
        <video id="exCam" playsinline muted style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
        <canvas id="exDots" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transform:scaleX(-1)"></canvas>
        <span class="tl"><span class="pill dark">${ico(e.icon, 16)} ${esc(e.name)}</span></span>
        <span class="tr" style="display:flex;flex-direction:column;align-items:center;gap:6px">
          <span style="position:relative;width:16px;height:150px;border-radius:8px;background:rgba(245,243,247,.18);overflow:hidden">
            <span id="exMeter" style="position:absolute;left:0;right:0;bottom:0;height:0;background:#7C4DFF;transition:height .08s"></span>
            <span style="position:absolute;left:-2px;right:-2px;bottom:${Math.round(100 / 1.3)}%;height:3px;background:#fff"></span></span></span>
        <div style="position:absolute;top:54px;left:12px">
          <svg width="96" height="96" viewBox="0 0 128 128" aria-live="polite"><circle cx="64" cy="64" r="56" fill="rgba(14,14,20,.55)"/>
            <circle id="exHold" cx="64" cy="64" r="56" fill="none" stroke="#B9A4FF" stroke-width="8" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 64 64)"/>
            <text id="exReps" x="64" y="72" text-anchor="middle" fill="#fff" font-family="Inter,sans-serif" font-weight="800" font-size="40">0</text>
            <text x="64" y="96" text-anchor="middle" fill="#B9A4FF" font-family="Inter,sans-serif" font-weight="800" font-size="13">of ${e.reps}</text></svg></div>
        <div class="bc" style="bottom:16px"><span class="pill" id="exCue" style="font-size:16px;padding:12px 18px;background:var(--chip)">Starting camera…</span></div>
      </div>
      <div style="display:flex;gap:4px">${Array.from({ length: e.reps }, (_, k) => `<span data-rep="${k}" style="flex:1;height:8px;border-radius:4px;background:var(--chip)"></span>`).join("")}</div>
      <div class="grid2"><button class="ghost" data-act="exFinish">${wo ? "Skip / finish" : "Finish"}</button><button class="ghost" data-act="exRestart">Restart</button></div>
      <p id="exNote" class="small center">Keep your whole face inside the frame.</p></div>`;
  },
  mount: (id) => { if (ui.exLive && !ui.exResult) return runExercise(exById(id) || EXERCISES[0]); },
};
ACT.exSound = () => { S.exSound = !S.exSound; save(); const b = $('[data-act="exSound"]'); if (b) b.textContent = S.exSound ? "🔊" : "🔇"; };
ACT.exGo = () => { if (freeOver()) return upsell("Your free week is over"); ui.exLive = true; ui.exResult = null; render(); };
ACT.exAgain = () => { ui.exLive = true; ui.exResult = null; render(); };
ACT.exRestart = () => { ui.exRun?.restart(); };
ACT.exFinish = () => { ui.exRun?.finish(); };
ACT.woNext = () => {
  const wo = ui.wo; if (!wo) return go("coach");
  wo.i++; ui.exResult = null;
  if (wo.i < wo.ids.length) { ui.exLive = true; go("ex/" + wo.ids[wo.i]); return; }
  ui.exLive = false; go("wodone");
};

let audioCtx = null;
function beep(freq = 880, ms = 120) {
  if (!S.exSound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.18, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + ms / 1000);
    o.start(); o.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* no sound */ }
}
function say(text) {
  if (!S.exSound || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; speechSynthesis.speak(u); } catch { /* no voice */ }
}
const DOTS = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 1];

async function runExercise(e) {
  const cue = $("#exCue"), note = $("#exNote"), video = $("#exCam");
  let alive = true, stream = null, rc = new RepCounter(e), last = 0, lastCue = "", lastSay = "", startT = 0;
  const stop = () => { alive = false; stream && stream.getTracks().forEach((t) => t.stop()); try { speechSynthesis.cancel(); } catch { /* */ } };
  cleanup.push(stop);
  const setCue = (t, on) => { if (!cue || t === lastCue) return; lastCue = t; cue.textContent = t; cue.style.background = on ? "var(--p)" : "var(--chip)"; };
  const finish = () => {
    if (!alive) return; stop();
    const r = rc.result();
    if (r.reps > 0) {
      S.exLog = [...S.exLog, { d: dkey(), ...r }].slice(-500); save();
      track("ExerciseDone", { exercise: e.id, reps: r.reps, rom: r.rom, form: r.form });
    }
    if (ui.wo && ui.wo.ids[ui.wo.i] === e.id) ui.wo.results.push(r);
    ui.exResult = r; ui.exLive = false; render();
  };
  ui.exRun = { finish, restart: () => { rc = new RepCounter(e); lastSay = ""; $$("[data-rep]").forEach((n) => (n.style.background = "var(--chip)")); const t = $("#exReps"); if (t) t.textContent = "0"; } };
  setCue("Loading face AI…");
  try { await V.loadCoach(); } catch { setCue("Face AI didn't load. Check your connection."); return; }
  if (!alive) return;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 853 } }, audio: false }); }
  catch (err) { track("CameraDenied", { reason: err.name, where: "exercise" }); setCue("Camera is blocked"); if (note) note.innerHTML = `<span class="err">Allow the camera for this site in your browser settings, then tap Restart.</span>`; return; }
  if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
  video.srcObject = stream; await video.play().catch(() => {});
  track("ExerciseStart", { exercise: e.id, workout: !!ui.wo });
  const cv = $("#exDots"), cx = cv.getContext("2d");
  const loop = (t) => {
    if (!alive) return;
    requestAnimationFrame(loop);
    if (t - last < 60 || video.readyState < 2) return;
    const dt = last ? Math.min(150, t - last) : 66; last = t;
    const f = V.trackFace(video, t), st = rc.update(f, dt);
    // face dots: shows her the AI is following her face
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W) { cv.width = W; cv.height = H; }
    cx.clearRect(0, 0, W, H);
    if (f) {
      const vw = video.videoWidth, vh = video.videoHeight, s = Math.max(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
      cx.fillStyle = st.formOk === false ? "#FFD25E" : "#B9A4FF";
      for (const i of DOTS) { cx.beginPath(); cx.arc(ox + f.lm[i][0] * vw * s, oy + f.lm[i][1] * vh * s, 2.4, 0, 7); cx.fill(); }
    }
    const m = $("#exMeter"); if (m) m.style.height = Math.round((st.norm / 1.3) * 100) + "%";
    const hold = $("#exHold"); if (hold) hold.style.strokeDashoffset = String(100 - st.holdPct * 100);
    if (st.calibrating) { setCue(st.face && st.cue.startsWith("Relax") ? `Relax your face… ${Math.round((st.calibPct || 0) * 100)}%` : st.cue, false); return; }
    if (!startT) { startT = t; beep(660, 160); if (e.phases[0].say) say(e.phases[0].say); }
    setCue(st.cue || (st.relaxing ? e.cues.relax : "Go"), st.formOk && (st.holdPct > 0 || st.norm >= 1));
    if (st.say && st.say !== lastSay && !st.relaxing) { lastSay = st.say; if (e.phases.length > 1) say(st.say); }
    if (st.repDone) {
      lastSay = "";
      const r = $("#exReps"); if (r) r.textContent = st.reps;
      const bar = $(`[data-rep="${st.reps - 1}"]`); if (bar) bar.style.background = "var(--p)";
      navigator.vibrate?.(60); beep(980, 110); if (!e.phases[0].say) say(String(st.reps));
      if (st.done) { setCue("Done!", true); setTimeout(finish, 700); }
    }
  };
  requestAnimationFrame(loop);
}

R.wodone = {
  needs: true,
  view: () => {
    const rs = ui.wo?.results || [], reps = rs.reduce((a, r) => a + r.reps, 0), secs = rs.reduce((a, r) => a + r.secs, 0), st = exStreak();
    const rom = rs.length ? Math.round(rs.reduce((a, r) => a + r.rom, 0) / rs.length) : 0;
    return `<div class="scr"><div class="top"><span class="spacer"></span><button class="back" data-go="coach" aria-label="Close" style="font-size:20px;font-weight:800">×</button></div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center">
        <div style="width:200px;height:200px;border-radius:50%;background:var(--p);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <span style="font-size:46px;line-height:1">🔥</span><span style="font-family:var(--h);font-size:58px;font-weight:800;line-height:1">${st}</span><span style="font-size:13px;font-weight:800">day streak</span></div>
        <h1 class="h1 xl">Workout done. <span class="hl">Nice work.</span></h1>
        <div class="grid3" style="width:100%">${[["Reps", reps], ["Avg reach", rom + "%"], ["Time", fmt(secs)]].map(([k, v]) => `<div class="card" style="padding:12px;gap:4px;border-radius:20px"><small class="small">${k}</small><b style="font-size:18px">${v}</b></div>`).join("")}</div>
        <div class="col" style="width:100%">${rs.map((r) => { const e = exById(r.id); return `<div class="row"><span><b>${esc(e.name)}</b><small>${r.reps}/${r.target} reps · form ${r.form}%</small></span><span class="r">${r.rom}%</span></div>`; }).join("")}</div></div>
      <button class="cta inline" data-go="progress">See my progress</button>
      <button class="link" data-go="preview">Try a new look on your twin</button></div>`;
  },
  mount: () => { const rs = ui.wo?.results || []; if (rs.length && !ui.wo.logged) { ui.wo.logged = 1; track("WorkoutDone", { exercises: rs.length, reps: rs.reduce((a, r) => a + r.reps, 0) }); } },
};

// Reach (range of motion) per workout day, for the Progress tab.
function exChart() {
  const days = exDays().slice(-14);
  const pts = days.map((d) => { const rs = S.exLog.filter((r) => r.d === d); return Math.round(rs.reduce((a, r) => a + r.rom, 0) / rs.length); });
  if (pts.length < 2) return `<p class="small">${pts.length ? `Day 1: average reach ${pts[0]}%. Work out again tomorrow to start your line.` : "Do your first workout to see your reach here."}</p>`;
  const W = 320, H = 110, min = Math.min(...pts) - 5, max = Math.max(...pts) + 5;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * (W - 16) + 8, H - 8 - ((v - min) / (max - min || 1)) * (H - 16)]);
  return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Average reach by workout day: ${pts.join(", ")}">
    <path d="M0 ${H - 8} H${W} M0 ${H / 2} H${W}" stroke="#2A2A36"/>
    <polyline points="${xy.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#7C4DFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === xy.length - 1 ? 7 : 4}" fill="#7C4DFF" stroke="#0E0E14" stroke-width="3"/>`).join("")}</svg>`;
}
function exProgressHTML() {
  const days = exDays(), tried = EXERCISES.filter((e) => exFirst(e.id));
  const pts = days.map((d) => { const rs = S.exLog.filter((r) => r.d === d); return Math.round(rs.reduce((a, r) => a + r.rom, 0) / rs.length); });
  const delta = pts.length > 1 ? pts[pts.length - 1] - pts[0] : 0;
  return `<div class="card"><div class="top"><b style="font-size:15px">Face workout · reach</b><span style="font-family:var(--h);font-size:22px;font-weight:800;color:var(--pl)">${delta > 0 ? "+" : ""}${delta}</span></div>${exChart()}
      <div class="top small" style="font-weight:700"><span>${days.length} workout ${days.length === 1 ? "day" : "days"}</span><span>🔥 ${exStreak()}</span></div></div>
    ${tried.length ? `<div class="col">${tried.map((e) => { const f = exFirst(e.id), l = exLast(e.id), d = l.rom - f.rom; return `<div class="row"><span><b>${esc(e.name)}</b><small>first ${f.rom}% → now ${l.rom}% · form ${l.form}%</small></span><span class="r" style="color:${d > 0 ? "var(--pl)" : "inherit"}">${d > 0 ? "+" : ""}${d}</span></div>`; }).join("")}</div>` : ""}`;
}

// ---------- progress ----------
function chart() {
  const pts = S.scans.map((s) => s.a.score);
  if (pts.length < 2) return `<p class="small">Your first point is in. Re-scan next week to see your line.</p>`;
  const W = 320, H = 110, min = Math.min(...pts) - 4, max = Math.max(...pts) + 4;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * (W - 16) + 8, H - 8 - ((v - min) / (max - min || 1)) * (H - 16)]);
  return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Skin score by week: ${pts.join(", ")}">
    <path d="M0 ${H - 8} H${W} M0 ${H / 2} H${W}" stroke="#2A2A36"/>
    <polyline points="${xy.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#7C4DFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === xy.length - 1 ? 7 : 4}" fill="#7C4DFF" stroke="#0E0E14" stroke-width="3"/>`).join("")}</svg>`;
}
R.progress = {
  needs: true, app: true, tab: "progress",
  view: () => {
    const f = S.scans[0], l = latest(), d = l && f ? l.a.score - f.a.score : 0;
    return `<div class="scr tabbed">
      <div class="top"><span class="h1" style="font-size:39px">Your progress</span><button class="pill chip" data-go="account">Week ${week()} · ⚙</button></div>
      ${exProgressHTML()}
      ${S.scans.length > 1 && S.scans[0].img && latest().img ? compareHTML(S.scans[0].img, latest().img, "Week 0", `Week ${week()}`, "40vh") : ""}
      <div class="card"><div class="top"><b style="font-size:15px">Skin score</b><span style="font-family:var(--h);font-size:22px;font-weight:800;color:var(--pl)">${d > 0 ? "+" : ""}${d}</span></div>${chart()}
        <div class="top small" style="font-weight:700"><span>Week 0</span><span>${S.scans.length} ${S.scans.length === 1 ? "scan" : "scans"}</span></div></div>
      <div class="grid3">${[["Workouts", exDays().length], ["Reps", S.exLog.reduce((a, r) => a + r.reps, 0)], ["Looks", S.previews.length]].map(([t, v]) => `<div class="card" style="padding:12px;gap:4px;border-radius:20px"><small class="small">${t}</small><b style="font-size:18px">${v}</b></div>`).join("")}</div>
      <div class="top"><b style="font-size:17px">Saved looks</b><span class="small">${S.saved.length}</span></div>
      ${S.saved.length ? `<div class="grid2">${S.saved.map((s, i) => `<button class="tile" style="height:${i % 3 ? 170 : 210}px;padding:0;background:var(--card)" data-act="openLook" data-v="${s.key}"><img src="${s.thumb}" alt="" style="width:100%;height:100%;object-fit:cover"><span class="pill dark" style="position:absolute;left:10px;top:10px;font-size:11px">${esc(s.ids.map((id) => V.lookById(id)?.name).join(" + "))}</span></button>`).join("")}</div>`
        : `<button class="row" data-go="studio"><span><b>No saved looks yet</b><small>Tap ♡ in Try on to keep one</small></span><span class="r">›</span></button>`}
      <button class="cta inline" data-go="share">Share my glow-up</button></div>`;
  },
};
ACT.openLook = (key) => { const s = S.saved.find((x) => x.key === key); if (s) { S.applied = [...s.ids]; save(); go("studio"); } };

// ---------- share card ----------
async function buildShareCard(canvas) {
  const W = 1080, H = 1920; canvas.width = W; canvas.height = H;
  const x = canvas.getContext("2d");
  try { await document.fonts.load("800 80px Inter"); await document.fonts.load("800 40px Inter"); } catch { /* fonts optional */ }
  const g = x.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, "#E5DBFF"); g.addColorStop(1, "#FFC9DE");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const F = (w, s) => `${w} ${s}px Inter, sans-serif`;
  x.fillStyle = "#0E0E14"; x.font = F(800, 72); x.fillText("facetwin", 80, 150);
  x.fillStyle = "#7C4DFF"; x.fillText(".", 80 + x.measureText("facetwin").width, 150);
  const pill = (t, px, py, bg, fg, size = 40) => { x.font = `800 ${size}px Inter, sans-serif`; const w = x.measureText(t).width + size * 1.2; x.fillStyle = bg; x.beginPath(); x.roundRect(px, py, w, size * 1.8, size * 0.9); x.fill(); x.fillStyle = fg; x.fillText(t, px + size * 0.6, py + size * 1.25); return w; };

  let before, after, headline, stickers = [];
  const multi = S.scans.length > 1;
  if (multi) {
    before = { img: await loadImg(S.scans[0].img), a: S.scans[0].a };
    after = { img: await loadImg(latest().img), a: latest().a };
    headline = `${week()} ${week() === 1 ? "week" : "weeks"}, ${S.minutes} min a day`;
    const f = S.scans[0].a, l = latest().a;
    if (l.texture < f.texture - 0.05) stickers.push("smoother skin");
    if (l.redness < f.redness - 0.05) stickers.push("calmer skin");
    if (l.darkCircles < f.darkCircles - 0.05) stickers.push("brighter under-eyes");
    if (streak() > 2) stickers.push(`${streak()}-day streak`);
    pill(`Week ${week()}`, W - 330, 88, "#0E0E14", "#F5F3F7");
  } else {
    const c1 = document.createElement("canvas"), c2 = document.createElement("canvas");
    await drawPhoto(c1, "front", [], true); await drawPhoto(c2, "front", S.applied.length ? S.applied : ["round"]);
    before = { img: c1, a: S.analysis }; after = { img: c2, a: S.analysis };
    headline = `Tried ${looksOn().join(" + ") || "a new look"} on my own face`;
    stickers = ["before I commit", "made with my twin"];
    pill("New look", W - 330, 88, "#0E0E14", "#F5F3F7");
  }
  const cardW = 440, cardH = 760, y0 = 260;
  const drawCard = (o, px, label, bg) => {
    x.save(); x.beginPath(); x.roundRect(px, y0, cardW, cardH, 56); x.clip();
    x.fillStyle = "#fff"; x.fillRect(px, y0, cardW, cardH);
    const iw = o.img.naturalWidth || o.img.width, ih = o.img.naturalHeight || o.img.height, s = Math.max(cardW / iw, cardH / ih);
    const dw = iw * s, dh = ih * s, dx = px + (cardW - dw) / 2, dy = y0 + (cardH - dh) / 2;
    x.drawImage(o.img, dx, dy, dw, dh);
    if (ui.hideEyes && o.a?.eyes) {
      const e = o.a.eyes, ex = (e.x1 - e.x0) * 0.14, eh = Math.max(e.y1 - e.y0, (e.x1 - e.x0) * 0.18);
      x.fillStyle = "rgba(14,14,20,.94)";
      x.beginPath(); x.roundRect(dx + (e.x0 - ex) * dw, dy + (e.y0 - eh * 0.7) * dh, (e.x1 - e.x0 + ex * 2) * dw, eh * 2.4 * dh, 40); x.fill();
    }
    x.restore();
    pill(label, px + 28, y0 + 28, bg, bg === "#7C4DFF" ? "#fff" : "#F5F3F7", 34);
  };
  drawCard(before, 80, multi ? "Before" : "Me", "#0E0E14");
  drawCard(after, 560, multi ? "Now" : "New look", "#7C4DFF");
  x.fillStyle = "#0E0E14"; x.font = F(800, 92);
  const words = headline.split(" "); let line = "", ly = 1180;
  for (const w of words) { const t = line ? line + " " + w : w; if (x.measureText(t).width > W - 160) { x.fillText(line, 80, ly); ly += 104; line = w; } else line = t; }
  x.fillText(line, 80, ly); ly += 70;
  let sy = ly + 30;
  stickers.slice(0, 3).forEach((t, i) => {
    x.save(); x.translate(i % 2 ? W - 120 : 90, sy); x.rotate(i % 2 ? 0.07 : -0.06);
    x.font = "800 44px Inter, sans-serif"; const w = x.measureText(t).width + 56;
    if (i % 2) x.translate(-w, 0);
    x.fillStyle = "#0E0E14"; x.beginPath(); x.roundRect(4, 10, w, 92, 26); x.fill();
    x.fillStyle = i % 2 ? "#FFFFFF" : "#FFF1B8"; x.beginPath(); x.roundRect(0, 0, w, 92, 26); x.fill();
    x.fillStyle = "#0E0E14"; x.fillText(t, 28, 62); x.restore(); sy += 130;
  });
  x.fillStyle = "#7C4DFF"; x.font = "800 46px Inter, sans-serif"; x.fillText(ui.shareTags.join(" "), 80, H - 200);
  x.fillStyle = "#0E0E14"; x.globalAlpha = 0.7; x.font = "700 40px Inter, sans-serif"; x.fillText(`Try yours → ${CONFIG.SHARE_URL}`, 80, H - 120); x.globalAlpha = 1;
}
const TAGS = ["#glowup", "#facetwin", "#skincareroutine", "#3weekchallenge", "#newlook", "#beforeandafter", "#skintok"];
R.share = {
  needs: true, app: true,
  view: () => `<div class="scr">
    <div class="top">${backBtn()}<span class="pill chip">Share my glow-up</span><span class="spacer"></span></div>
    <div style="align-self:center;width:230px;height:409px;border-radius:26px;overflow:hidden;background:var(--lilac)"><canvas id="shc" style="width:100%;height:100%"></canvas></div>
    <span class="small" style="font-weight:800">Tags</span>
    <div class="wrap">${TAGS.map((t) => `<button class="chip sm ${ui.shareTags.includes(t) ? "on" : ""}" data-act="tag" data-v="${t}">${t}</button>`).join("")}</div>
    <button class="row" data-act="hideEyes"><span><b>Hide my eyes</b><small>Share your skin, keep it anonymous</small></span>
      <span style="width:46px;height:28px;border-radius:999px;background:${ui.hideEyes ? "var(--p)" : "var(--line)"};position:relative;flex:none"><span style="position:absolute;${ui.hideEyes ? "right" : "left"}:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff"></span></span></button>
    <div style="margin-top:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      ${[["share", "Stories / TikTok", "linear-gradient(135deg,#F9CE34,#EE2A7B,#6228D7)", "↗"], ["telegram", "Telegram", "#2AABEE", "➤"], ["copy", "Copy tags", "var(--chip)", "#"], ["save", "Save", "var(--chip)", "↓"]].map(([v, l, bg, g]) =>
        `<button data-act="shareTo" data-v="${v}" style="border:0;background:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="width:54px;height:54px;border-radius:18px;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800">${g}</span><span class="small" style="font-weight:800;font-size:11px">${l}</span></button>`).join("")}
    </div></div>`,
  mount: () => buildShareCard($("#shc")),
};
ACT.tag = (t) => { ui.shareTags = ui.shareTags.includes(t) ? ui.shareTags.filter((x) => x !== t) : [...ui.shareTags, t]; render(); };
ACT.hideEyes = () => { ui.hideEyes = !ui.hideEyes; render(); };
ACT.shareTo = async (how) => {
  const c = $("#shc"), text = `${ui.shareTags.join(" ")} Try yours → https://${CONFIG.SHARE_URL}`;
  track("Share", { method: how });
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const file = new File([blob], "facetwin-glowup.png", { type: "image/png" });
  if (how === "share") {
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); } catch { /* user closed */ } }
    else { download(blob, file.name); toast("Saved. Post it to Stories or TikTok from your photos."); }
  } else if (how === "telegram") {
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); return; } catch { /* fall through */ } }
    window.open(`https://t.me/share/url?url=${encodeURIComponent("https://" + CONFIG.SHARE_URL)}&text=${encodeURIComponent(ui.shareTags.join(" "))}`, "_blank");
  } else if (how === "copy") { try { await navigator.clipboard.writeText(text); toast("Tags copied"); } catch { toast(text); } }
  else { download(blob, file.name); toast("Saved to your downloads"); }
};

// =============== ACCOUNT, REMINDERS, PRIVACY ===============
// Account for the Glow flow: plan, upgrade, manage subscription (Stripe portal), privacy, help.
function glowAccount() {
  const p = S.paid ? planById(S.paid) : null, left = previewsLeft();
  const mine = CONFIG.UPSELLS.filter((u) => owns(u.id)), missing = CONFIG.UPSELLS.filter((u) => !owns(u.id));
  const row = (ic, t, s, attrs, tag = "button") => `<${tag} class="row" ${attrs}><span class="rowi">${ico(ic, 24)}</span><span class="grow"><b>${t}</b><small>${s}</small></span>${ico("next", 20)}</${tag}>`;
  return `<div class="scr">
    <div class="top">${backBtn("preview")}<span class="pill chip">Account</span><span class="spacer"></span></div>
    <h1 class="h1">Your plan</h1>
    <div class="card plan-card">
      <div class="top"><span class="eyebrow-w">${p ? "Active" : "Free plan"}</span><span class="pill" style="background:#fff;color:var(--ink)">${p ? "Glow" : "Free"}${mine.length ? " + " + mine.map((u) => u.name).join(" + ") : ""}</span></div>
      <span class="h1" style="font-size:36px">${p ? `${p.name} · $${p.price.toFixed(2)}` : `${left} free ${left === 1 ? "edit" : "edits"} left`}</span>
      <span style="font-size:13px;font-weight:700;opacity:.9">${p ? (S.billing?.customer ? "Change plan, update your card or cancel below." : "Manage or cancel from your payment receipt email.") : "Get unlimited retouch and HD download with Glow."}</span></div>
    <div class="col">
      ${!p ? row("crown", "Get Glow", "Unlimited edits, Studio and HD download", 'data-act="seePlans" data-v="glow"') : ""}
      ${p ? missing.map((u) => row(u.icon, `Add ${u.name}`, `One-time $${u.price.toFixed(2)} · ${esc(u.title)}`, `data-act="seePlans" data-v="${u.id}"`)).join("") : ""}
      ${p && S.billing?.customer ? row("settings", "Manage subscription", "Change plan, update card, cancel in 2 taps", 'data-act="manageSub"') : ""}
      ${row("shield", "Privacy and my data", "Photos stay in this browser. Delete anytime", 'data-go="privacy"')}
      ${row("mail", "Help", esc(CONFIG.SUPPORT_EMAIL), `href="mailto:${CONFIG.SUPPORT_EMAIL}"`, "a")}
    </div>
    <p class="small center">Face care and photo editing, not medical advice.</p></div>`;
}

R.account = {
  get needs() { return !S.flags.glow; }, // a Glow subscriber can always reach her plan and Manage subscription, even if her photos are gone
  app: true, glowOk: true,
  view: () => {
    if (S.flags.glow) return glowAccount();
    const p = S.paid ? planById(S.paid) : null;
    return `<div class="scr">
      <div class="top">${backBtn("progress")}<span class="pill chip">Settings</span><span class="spacer"></span></div>
      <h1 class="h1">Your plan</h1>
      <div class="card" style="background:var(--p);color:#fff">
        <div class="top"><span style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase">${p ? "Active" : S.waitlist ? "Early access" : "Free week"}</span><span class="pill" style="background:#fff;color:var(--ink)">Week ${week()}</span></div>
        <span class="h1" style="font-size:36px">${p ? `${p.name} · $${p.price}` : S.waitlist ? `Spot saved: ${planById(S.waitlist).name}` : `Day ${Math.min(freeDay(), CONFIG.FREE_DAYS)} of ${CONFIG.FREE_DAYS}`}</span>
        <span style="font-size:13px;font-weight:700;opacity:.85">${p ? (S.billing?.customer ? "Change plan, update card or cancel below." : "Manage or cancel from your payment receipt email.") : S.email ? `We'll email ${esc(S.email)}` : "No card on file"}</span></div>
      <div class="col">
        ${!p ? `<button class="row" data-go="paywall"><span><b>Get the full plan</b><small>Every look + full routine</small></span><span class="r">›</span></button>` : ""}
        ${p && S.billing?.customer ? `<button class="row" data-act="manageSub"><span><b>Manage subscription</b><small>Change plan, update card, cancel in 2 taps</small></span><span class="r">›</span></button>` : ""}
        <button class="row" data-go="reminders"><span><b>Reminders</b><small>${S.reminders ? `Every day at ${S.reminders.time}` : "Off"}</small></span><span class="r">›</span></button>
        <button class="row" data-go="skin"><span><b>Edit skin answers</b><small>${S.concerns.length} concerns · ${S.minutes} min a day</small></span><span class="r">›</span></button>
        <button class="row" data-go="privacy"><span><b>Privacy &amp; my data</b><small>Photos, twin, delete</small></span><span class="r">›</span></button>
        <a class="row" href="mailto:${CONFIG.SUPPORT_EMAIL}"><span><b>Help</b><small>${CONFIG.SUPPORT_EMAIL}</small></span><span class="r">›</span></a>
      </div>
      ${DEBUG ? `<div class="card"><b>Test tools (debug)</b><div class="wrap">
        <button class="chip sm" data-act="dbg" data-v="day">+1 day</button><button class="chip sm" data-act="dbg" data-v="week">+7 days</button>
        <button class="chip sm" data-act="dbg" data-v="reset">Real date</button><button class="chip sm" data-act="dbg" data-v="paid">Mark paid</button>
        <button class="chip sm" data-act="dbg" data-v="free">Back to free</button></div><span class="small">Today in app: ${dkey()}</span></div>` : ""}
      <p class="small center">Face care, not medical advice. For a skin condition, see a dermatologist.</p></div>`;
  },
};
ACT.dbg = (v) => {
  if (v === "day") S.dayOffset++; if (v === "week") S.dayOffset += 7; if (v === "reset") S.dayOffset = 0;
  if (v === "paid") S.paid = "twelve"; if (v === "free") S.paid = null;
  save(); render();
};

R.reminders = {
  needs: true,
  view: () => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    const t = S.reminders?.time || "08:00";
    return `<div class="scr">
      <div class="top">${backBtn()}<span class="pill chip">Reminders</span><span class="spacer"></span></div>
      <h1 class="h1 xl">Never miss <span class="hl">your 5 minutes</span></h1>
      <div class="card"><b style="font-size:15px">Remind me at</b><div class="seg">${["07:00", "08:00", "21:00"].map((x) => `<button class="${t === x ? "on" : ""}" data-act="remTime" data-v="${x}">${x}</button>`).join("")}</div></div>
      <button class="row" style="background:var(--peach);color:var(--ink)" data-act="ics"><span><b>📅 Add a daily reminder to my calendar</b><small>Works on any phone. One tap opens your plan.</small></span><span class="r">›</span></button>
      ${standalone ? `<div class="row"><span><b>FaceTwin is on your Home Screen</b><small>Open it from there each day</small></span><span class="r">✓</span></div>`
        : ios ? `<div class="card"><b style="font-size:15px">Put FaceTwin on your Home Screen</b>
          ${["Tap Share ⬆︎ in Safari", "Choose “Add to Home Screen”", "Open FaceTwin from your Home Screen"].map((s, i) => `<div class="top" style="justify-content:flex-start;font-weight:800;font-size:14px"><span class="dot on" style="width:26px;height:26px;font-size:12px">${i + 1}</span>${s}</div>`).join("")}</div>`
        : `<button class="row" data-act="install"><span><b>Install FaceTwin as an app</b><small>Opens like an app from your Home Screen</small></span><span class="r">›</span></button>`}
      <button class="cta" data-go="today">Done</button></div>`;
  },
};
ACT.remTime = (v) => { S.reminders = { ...(S.reminders || {}), time: v }; save(); render(); };
ACT.ics = () => {
  const t = (S.reminders?.time || "08:00").replace(":", ""), d = new Date(now().getTime() + DAY);
  const day = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const url = location.origin + location.pathname + "#/today";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FaceTwin//MVP//EN", "BEGIN:VEVENT", `UID:facetwin-routine-${Date.now()}@facetwin`, `DTSTAMP:${stamp}`,
    `DTSTART:${day}T${t}00`, "DURATION:PT5M", "RRULE:FREQ=DAILY", "SUMMARY:FaceTwin · your routine (5 min)", `DESCRIPTION:Open your plan: ${url}`, `URL:${url}`,
    "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:FaceTwin routine", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  download(new Blob([ics], { type: "text/calendar" }), "facetwin-reminder.ics");
  S.reminders = { ...(S.reminders || {}), time: S.reminders?.time || "08:00", calendar: true }; save();
  track("RemindersOn", { method: "calendar" });
};
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
ACT.install = async () => {
  if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; track("InstallPrompt", { outcome: r.outcome }); installEvt = null; }
  else toast("Use your browser menu → “Add to Home screen”");
  S.reminders = { ...(S.reminders || {}), time: S.reminders?.time || "08:00", home: true }; save();
};

R.privacy = {
  view: () => `<div class="scr">
    <div class="top">${backBtn()}<span class="pill chip">Privacy</span><span class="spacer"></span></div>
    <h1 class="h1 xl">Your face, <span class="hl">your rules</span></h1>
    <div class="card" style="background:var(--mint);color:var(--ink);font-size:13px;font-weight:700;line-height:1.5">
      <span>✓ Face detection runs on this phone.</span>
      <span>✓ A photo goes to Google's Gemini AI only when you tap Show me and agree. We don't store it.</span>
      <span>✓ Photos, edits and looks are saved only in this browser.</span>
      <span>✓ We only receive your email (if you gave it) and your plan choice.</span>
      <span>✓ Delete everything here anytime, in one tap.</span></div>
    <div class="col">
      <button class="row" data-act="exportData"><span><b>Download my data</b><small>Photos, scans and answers as a file</small></span><span class="r">↓</span></button>
      <a class="row" href="privacy.html"><span><b>Full Privacy Policy</b><small>What we collect and why</small></span><span class="r">›</span></a></div>
    <button class="cta danger" data-go="deletedata">Delete my photos and twin</button></div>`,
};
ACT.exportData = () => { download(new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }), "facetwin-my-data.json"); track("DataExported"); };
R.deletedata = {
  view: () => `<div class="scr"><div class="top">${backBtn("privacy")}<span class="spacer"></span></div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px">
      <div style="width:96px;height:96px;border-radius:50%;background:#3A1620;display:flex;align-items:center;justify-content:center;font-size:40px">🗑️</div>
      <h1 class="h1 xl">Delete everything?</h1>
      <p class="sub">This removes your photos, twin, saved looks, scans and routine history from this phone. It can't be undone.</p>
      <div class="row" style="background:var(--yel);color:var(--ink)"><span><b>Paid plan?</b><small>Deleting data doesn't cancel it. Cancel in Account, or from your receipt email.</small></span><span class="r">!</span></div>
      ${S.email ? `<p class="small">To also remove your email from our list, write to ${CONFIG.SUPPORT_EMAIL}. We do it within 30 days.</p>` : ""}</div>
    <button class="cta inline" style="background:var(--danger)" data-act="wipe">Yes, delete my data</button>
    <button class="ghost" data-go="privacy">Keep my twin</button></div>`,
};
ACT.wipe = () => { track("DataDeleted"); localStorage.removeItem(KEY); localStorage.removeItem(KEY_ENT); S = load(); toast("Deleted. Everything is gone from this phone."); go("landing"); };

// =============== BOOT ===============
function boot() {
  startIconPass(); // no emoji anywhere: glyphs become Hugeicons (iconpass.js)
  initPixel();
  // first-touch attribution for the lead form
  if (!S.utm.first_seen) {
    const u = {}; for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]) if (QS.get(k)) u[k] = QS.get(k);
    S.utm = { ...u, first_seen: dkey(), landing: location.pathname }; save();
  }
  // tester mode for your own testing: open the site with ?tester=1 (turn off with ?tester=0)
  if (QS.get("tester") === "1" && (CONFIG.ALLOW_TESTER || LOCAL || DEBUG)) { S.flags.tester = 1; S.startedAt = S.startedAt || (S.photos.front && !S.flags.glow ? now().toISOString() : null); save(); setTimeout(() => toast("Tester mode on: everything unlocked"), 600); }
  if (QS.get("tester") === "0") { S.flags.tester = 0; save(); }
  // return from Stripe Checkout: /?cs=<session id>. The server confirms the payment before anything unlocks.
  const cs = QS.get("cs");
  if (cs) confirmCheckout(cs);
  // Old unlock by URL (?paid=glow_y): anyone could type it, so it only works when CONFIG.ALLOW_PAID_PARAM or ?debug=1.
  const paid = (CONFIG.ALLOW_PAID_PARAM || DEBUG) ? QS.get("paid") : null;
  if (paid && [...CONFIG.PLANS_GLOW, ...CONFIG.PLANS].some((p) => p.id === paid)) {
    const p = planById(paid), isGlowPlan = CONFIG.PLANS_GLOW.some((q) => q.id === paid);
    if (isGlowPlan) S.flags.glow = 1;
    if (S.paid !== paid) { S.paid = paid; if (!isGlowPlan) S.startedAt = S.startedAt || now().toISOString(); save(); track("Purchase", { value: p.price, currency: CONFIG.CURRENCY, content_name: p.id }); track("Subscribe", { value: p.price, currency: CONFIG.CURRENCY }); }
    history.replaceState(null, "", location.pathname + (DEBUG ? "?debug=1" : "") + (isGlowPlan ? "#/preview" : "#/welcome"));
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  // warm up the face model while she answers the quiz
  setTimeout(() => V.loadFace().catch(() => {}), 1500);
  render();
}
window.addEventListener("hashchange", render);
boot();
