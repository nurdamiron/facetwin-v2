// Waiting-screen test: stuck 3D download. (Based on funnel.cjs.)
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
  // The 3D AI download stalls forever: the build screen must keep moving, say something honest, then skip 3D and finish.
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await fresh(b);
  await p.context().route("**/models/depth_anything_v2_vits.onnx", () => {}); // never answers
  await gen(p); await payGlow(p, "glow_m");
  await p.click('[data-act="upNo"]'); await p.waitForURL(/looks-2/); await p.click('[data-act="upNo"]'); await p.waitForURL(/up\/coach$/);
  await p.click('[data-act="upBuy"]'); await p.waitForURL(/#\/goal/, { timeout: 15000 });
  await p.click('[data-act="goal"][data-v="skin"]'); await p.click('[data-act="goalNext"]'); await p.waitForURL(/#\/looks/);
  await p.click('[data-act="pickWant"]'); await p.click('[data-act="looksNext"]'); await p.waitForURL(/#\/skin/);
  await p.click('[data-act="skinNext"]'); await p.waitForURL(/#\/building/, { timeout: 5000 });
  const pct = async () => parseInt(await p.innerText("#bpct"), 10);
  await p.waitForTimeout(4000); const a = await pct();
  await p.waitForTimeout(6000); const c = await pct();
  console.log("  ring:", a + "% ->", c + "%");
  ok(c > a, "progress keeps moving while the download is stuck");
  ok((await p.innerText("#bmsg")).length > 3, "status line is shown: " + (await p.innerText("#bmsg")));
  await p.waitForTimeout(6000);
  ok(/First time can take up to a minute/.test(await p.innerText("#bhint")), "after 12 s an honest 'keep this page open' hint appears");
  await p.screenshot({ path: SP + "/shots/20-building-wait.png" });
  await p.waitForURL(/#\/(today|coach|preview)/, { timeout: 120000 });
  ok(/#\/today/.test(p.url()), "stuck 3D step is skipped and she lands in her plan: " + p.url().split("#")[1]);
  ok(p.errors.length === 0, "no page errors" + (p.errors[0] ? ": " + p.errors[0] : ""));
  await p.context().close();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await b.close();
})().catch((e) => { console.log("SCRIPT ERROR:", e.message.split("\n")[0]); process.exit(1); });
