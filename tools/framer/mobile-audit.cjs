const { chromium } = require("playwright");
const SP = process.argv[2] || require("os").tmpdir(), URL_ = process.argv[3] || "https://shiny-culture-616454.framer.app/"; require("fs").mkdirSync(SP + "/aud", { recursive: true });
const WIDTHS = [320, 360, 390, 430, 768];
const fn = () => {
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const parse = (s) => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = (el) => { let e = el; while (e) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c && c.a > 0.5) return { c, img: false }; if (cs.backgroundImage && cs.backgroundImage !== "none") return { c: null, img: true }; e = e.parentElement; } return { c: { r: 14, g: 14, b: 20, a: 1 }, img: false }; };
  const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const out = { overflowX: document.documentElement.scrollWidth - innerWidth, wide: [], small: [], lowContrast: [], tiny: [], colors: {}, bgs: {}, fonts: {}, noAlt: 0, imgs: 0, buttons: 0 };
  const seenText = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.display === "none" || cs.visibility === "hidden" || r.width === 0 || r.height === 0) continue;
    if (r.right > innerWidth + 2 && r.width < 4000 && el.children.length < 2) out.wide.push(`${el.tagName.toLowerCase()} right=${Math.round(r.right)} "${(el.textContent || "").trim().slice(0, 30)}"`);
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (own.length > 1) {
      const fs = parseFloat(cs.fontSize), fg = parse(cs.color), bg = bgOf(el);
      const fam = cs.fontFamily.split(",")[0].replace(/["']/g, ""); out.fonts[fam] = (out.fonts[fam] || 0) + 1;
      if (fg) out.colors[hex(fg)] = (out.colors[hex(fg)] || 0) + 1;
      if (bg.c) out.bgs[hex(bg.c)] = (out.bgs[hex(bg.c)] || 0) + 1;
      const key = own.slice(0, 40) + fs; if (seenText.has(key)) continue; seenText.add(key);
      if (fs < 14) out.tiny.push(`${fs}px "${own.slice(0, 40)}"`); else if (fs < 16 && own.length > 25) out.small.push(`${fs}px "${own.slice(0, 40)}"`);
      if (fg && bg.c) { const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.c.r, bg.c.g, bg.c.b), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); const large = fs >= 24 || (fs >= 18.66 && parseInt(cs.fontWeight) >= 700); if (cr < (large ? 3 : 4.5)) out.lowContrast.push(`${cr.toFixed(2)}:1 ${fs}px ${hex(fg)} on ${hex(bg.c)} "${own.slice(0, 36)}"`); }
    }
    if (el.tagName === "IMG") { out.imgs++; if (!el.getAttribute("alt")) out.noAlt++; }
    if (el.tagName === "A" || el.tagName === "BUTTON" || el.getAttribute("role") === "button") { const t = (el.textContent || "").trim(); if (t) { out.buttons++; if (r.height < 44 || r.width < 44) out.tiny.push(`target ${Math.round(r.width)}x${Math.round(r.height)} "${t.slice(0, 28)}"`); } }
  }
  return out;
};
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } });
  const all = {};
  for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: w < 700, hasTouch: w < 700 }); const p = await ctx.newPage();
    await p.goto(URL_, { waitUntil: "load", timeout: 60000 }); await p.waitForTimeout(3000);
    const h = await p.evaluate(() => document.documentElement.scrollHeight); for (let y = 0; y < h; y += 400) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(100); }
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(800);
    all[w] = await p.evaluate(fn); all[w].height = h;
    if (w === 390 || w === 320) await p.screenshot({ path: `${SP}/aud/full-${w}.png`, fullPage: true });
    await ctx.close();
  }
  require("fs").writeFileSync(SP + "/aud/audit.json", JSON.stringify(all, null, 1)); console.log("done"); await b.close();
})();
