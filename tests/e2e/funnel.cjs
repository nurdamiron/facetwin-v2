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
  await p.click('[data-act="prevSave"]'); await p.click('.sheet-bg [data-act="seePlans"]');
  await p.waitForSelector('[data-act="checkout"]');
  await p.click(`[data-act="choose"][data-v="${plan}"]`); await p.check("#renewOk"); await p.click('[data-act="checkout"]');
  await p.waitForURL(/#\/up\/looks/, { timeout: 15000 }); await p.waitForTimeout(500);
}
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

  console.log("A. free user: Studio free, hair locked, paywall shows deck prices");
  let p = await fresh(b);
  await p.click('[data-act="prevGroup"][data-v="Studio"]'); await p.waitForTimeout(300);
  let t = await txt(p); ok(/White background/.test(t) && /Passport/.test(t), "Studio group lists background + passport edits");
  await p.click('[data-act="prevSel"][data-v="bgwhite"]'); await gen(p); ok(true, "Studio edit runs for a free user (mock AI)");
  await p.click('[data-act="prevGroup"][data-v="Hair color"]'); await p.click('[data-act="prevGen"]'); await p.waitForTimeout(500);
  ok(/part of Looks/.test(await p.innerText("body")), "hair look is gated: 'part of Looks'");
  await p.keyboard.press("Escape");
  await p.click('.cta[data-go="paywall"]'); await p.waitForSelector('[data-act="checkout"]');
  t = await txt(p);
  ok(/\$9\.99/.test(t) && /\$22\.49/.test(t) && /\$19\.99 a month/.test(t) && /\$44\.99 every 3 months/.test(t), "paywall: Glow $9.99→$19.99 monthly and $22.49→$44.99 quarterly");
  ok(!/Pro/.test(t) && !/\$49\.99|\$99\.99|\$7\.99|\$15\.99/.test(t), "no old Pro / annual prices left");
  ok(/Looks: \$29\.99 once/.test(t) && /Coach: \$24\.99 once/.test(t), "paywall discloses the add-ons up front");
  await p.screenshot({ path: SP + "/shots/10-paywall-new.png", fullPage: true });
  ok(/From month 4: \$44\.99 every 3 months/.test(t), "renewal line for the default quarter plan");
  await p.click('[data-act="choose"][data-v="glow_m"]'); await p.waitForTimeout(200);
  ok(/From day 31: \$19\.99 a month/.test(await txt(p)), "renewal line updates for monthly");
  await p.check("#renewOk"); await p.click('[data-act="checkout"]'); await p.waitForURL(/#\/up\/looks/, { timeout: 15000 }); await p.waitForTimeout(500);
  t = await txt(p); ok(/\$29\.99/.test(t) && /3D twin/.test(t) && !/\$59|\$49\.99/.test(t), "after checkout: Looks offered at $29.99, no fake anchor price");
  await p.screenshot({ path: SP + "/shots/11-up-looks.png" });
  await p.click('[data-act="upNo"]'); await p.waitForURL(/up\/looks-2/); await p.waitForTimeout(300);
  t = await txt(p); ok(/One more offer: \$23\.99/.test(t), "decline once -> second chance $23.99");
  await p.click('[data-act="upNo"]'); await p.waitForURL(/up\/coach$/); await p.waitForTimeout(300);
  ok(/\$24\.99/.test(await txt(p)), "then Coach at $24.99");
  await p.click('[data-act="upNo"]'); await p.waitForURL(/up\/coach-2/); await p.waitForTimeout(400); ok(/\$19\.99/.test(await txt(p)), "Coach second chance $19.99");
  await p.click('[data-act="upNo"]'); await p.waitForURL(/#\/preview/, { timeout: 8000 }); ok(true, "decline all -> back to the editor");
  await p.click('[data-act="prevShow"]'); await p.click('[data-act="prev3d"]'); await p.waitForTimeout(600);
  ok(/part of Looks/.test(await p.innerText("body")), "Glow only: 3D twin still locked");
  ok(p.errors.length === 0, "no page errors" + (p.errors[0] ? ": " + p.errors[0] : ""));
  await p.context().close();

  console.log("B. buys Looks, declines Coach");
  p = await fresh(b); await gen(p); await payGlow(p, "glow_q");
  await p.click('[data-act="upBuy"]'); await p.waitForURL(/#\/up\/coach/, { timeout: 15000 });
  ok(true, "Looks paid (mock Stripe) -> next offer is Coach");
  await p.click('[data-act="upNo"]'); await p.waitForURL(/coach-2/); await p.click('[data-act="upNo"]'); await p.waitForURL(/#\/preview/);
  await p.click('[data-act="prevGroup"][data-v="Hair color"]'); await p.click('[data-act="prevGen"]'); await p.waitForTimeout(500);
  ok(!(await p.$(".sheet-bg [data-act=\"seePlans\"]")), "hair look no longer gated after buying Looks");
  await p.waitForSelector(".cmp", { timeout: 40000 }); ok(true, "hair look generated");
  await p.click('[data-act="prev3d"]'); let c3 = true; await p.waitForSelector("#pv3 canvas", { timeout: 120000 }).catch(() => (c3 = false)); ok(c3, "3D twin opens for Looks owner");
  await p.goto(BASE + "#/account"); await p.waitForTimeout(500); t = await txt(p);
  ok(/Glow \+ Looks/.test(t) && /Add Coach/.test(t) && !/Add Looks/.test(t), "account: 'Glow + Looks', offers Coach only");
  ok(p.errors.length === 0, "no page errors" + (p.errors[0] ? ": " + p.errors[0] : ""));
  await p.context().close();

  console.log("C. buys Coach -> onboarding from the Glow photo");
  p = await fresh(b); await gen(p); await payGlow(p, "glow_m");
  await p.click('[data-act="upNo"]'); await p.waitForURL(/looks-2/); await p.click('[data-act="upNo"]'); await p.waitForURL(/up\/coach$/);
  await p.click('[data-act="upBuy"]'); await p.waitForURL(/#\/goal/, { timeout: 15000 }); ok(true, "Coach paid -> goal screen");
  await p.click('[data-act="goal"][data-v="skin"]'); await p.click('[data-act="goalNext"]'); await p.waitForURL(/#\/looks/);
  await p.click('[data-act="pickWant"]'); await p.click('[data-act="looksNext"]'); await p.waitForURL(/#\/skin/);
  await p.click('[data-act="skinNext"]'); await p.waitForURL(/#\/building/, { timeout: 5000 }); ok(true, "skin quiz -> builds the report from the existing photo (no new selfies)");
  await p.waitForURL(/#\/(today|coach|preview)/, { timeout: 170000 }); ok(/#\/today/.test(p.url()), "ends in her plan: " + p.url().split("#")[1]);
  await p.screenshot({ path: SP + "/shots/12-coach-home.png" });
  ok(p.errors.length === 0, "no page errors" + (p.errors[0] ? ": " + p.errors[0] : ""));
  await p.context().close();

  console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await b.close();
})().catch((e) => { console.log("SCRIPT ERROR:", e.message.split("\n")[0]); process.exit(1); });
