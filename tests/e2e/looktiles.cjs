// Looks option tiles with example photos. (Based on funnel.cjs.)
// End-to-end funnel test (headless Chromium, mock Gemini and mock Stripe). Needs: node 22, playwright (global), ffmpeg not needed.
//   STRIPE_MOCK=1 AI_MOCK=1 node scripts/dev-server.mjs &
//   NODE_PATH=$(npm root -g) node tests/e2e/funnel.cjs
// Three scenarios: A free user + paywall + decline all add-ons, B buys Looks, C buys Coach and runs the onboarding.
const { chromium } = require("playwright");
const path = require("path"); const SP = path.join(require("os").tmpdir(), "ft-e2e"); require("fs").mkdirSync(SP + "/shots", { recursive: true }); const ROOT = path.resolve(__dirname, "../.."), BASE = process.env.BASE || "http://localhost:8080/";
let fails = 0;
const ok = (c, m) => { console.log((c ? "  OK   " : "  FAIL ") + m); if (!c) fails++; };
const txt = async (p) => (await p.innerText("#app")).replace(/\n+/g, " | ");
async function fresh(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }), p = await ctx.newPage();
  p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message.slice(0, 160)));
  await p.goto(BASE, { waitUntil: "load" });
  await p.setInputFiles("#glowUpl", ROOT + "/tests/faces/face03.jpg");
  await p.waitForURL(/#\/preview/, { timeout: 20000 }); await p.waitForTimeout(800);
  return p;
}
async function gen(p) {
  await p.click('[data-act="prevGen"]'); await p.waitForTimeout(400);
  if (await p.$("#aiOk")) { await p.check("#aiOk"); await p.click('[data-act="aiAgree"]'); }
  await p.waitForSelector(".cmp", { timeout: 40000 });
}
async function payGlow(p, plan) {
  await p.click('[data-act="prevSave"]'); await p.waitForURL(/#\/paywall/);
  await p.waitForSelector('[data-act="checkout"]');
  await p.click(`[data-act="choose"][data-v="${plan}"]`); await p.check("#renewOk"); await p.click('[data-act="checkout"]');
  await p.waitForURL(/#\/up\/looks/, { timeout: 15000 }); await p.waitForTimeout(500);
}
(async () => {
  // Routine step screens show a real photo (assets/routine/<id>.jpg), not the cartoon face.
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await fresh(b);
  await gen(p); await payGlow(p, "glow_m");
  await p.click('[data-act="upNo"]'); await p.waitForURL(/looks-2/); await p.click('[data-act="upNo"]'); await p.waitForURL(/up\/coach$/);
  await p.click('[data-act="upBuy"]'); await p.waitForURL(/#\/goal/, { timeout: 15000 });
  await p.click('[data-act="goal"][data-v="skin"]'); await p.click('[data-act="goalNext"]'); await p.waitForURL(/#\/looks/);
  await p.waitForTimeout(800);
  const imgs = async () => p.$$eval("#app .tph img", (a) => a.map((i) => ({ ok: i.complete && i.naturalWidth > 100 })));
  let r = await imgs(); ok(r.length >= 7 && r.every((x) => x.ok), "pick screen: " + r.length + " option tiles, all with a photo");
  await p.screenshot({ path: SP + "/shots/22-looks-pick.png", fullPage: true });
  await p.click('[data-act="pickWant"]'); await p.click('[data-act="looksNext"]'); await p.waitForURL(/#\/skin/);
  await p.goto(BASE + "#/preview"); await p.waitForTimeout(600);
  for (const g of ["Hair color", "Hairstyle", "Braids", "Brows", "Beard & mustache"]) {
    await p.click(`[data-act="prevGroup"][data-v="${g}"]`).catch(() => {}); await p.waitForTimeout(500);
    r = await imgs(); ok(r.length > 0 && r.every((x) => x.ok), g + ": " + r.length + " tiles with photos");
    if (g === "Brows" || g === "Hairstyle") await p.screenshot({ path: SP + "/shots/23-group-" + g.replace(/\W/g, "") + ".png" });
  }
  ok(p.errors.length === 0, "no page errors" + (p.errors[0] ? ": " + p.errors[0] : ""));
  await p.context().close();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await b.close();
})().catch((e) => { console.log("SCRIPT ERROR:", e.message.split("\n")[0]); process.exit(1); });
