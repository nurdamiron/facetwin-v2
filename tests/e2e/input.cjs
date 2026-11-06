// Robustness e2e (headless Chromium, mock Gemini + mock Stripe): bad uploads, a purchase surviving a wiped photo store,
// and a full browser storage. Needs the dev server:  STRIPE_MOCK=1 AI_MOCK=1 node scripts/dev-server.mjs &
//   NODE_PATH=$(npm root -g) node tests/e2e/input.cjs
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs"), os = require("os");
const ROOT = path.resolve(__dirname, "../.."), BASE = process.env.BASE || "http://localhost:8080/";
let fails = 0;
const ok = (c, m) => { console.log((c ? "  OK   " : "  FAIL ") + m); if (!c) fails++; };
const newPage = async (b) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }), p = await ctx.newPage(); p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message.slice(0, 140))); return p; };
const toastText = async (p) => (await p.innerText(".toast").catch(() => "")) || "";
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

  console.log("A. bad uploads get a clear message and the app stays usable");
  let p = await newPage(b); await p.goto(BASE, { waitUntil: "load" });
  const txt = path.join(os.tmpdir(), "not-a-photo.txt"); fs.writeFileSync(txt, "hello");
  await p.setInputFiles("#glowUpl", { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await p.waitForTimeout(500);
  ok(/isn't a photo/.test(await toastText(p)), "a text file -> \"That isn't a photo\"");
  await p.setInputFiles("#glowUpl", { name: "broken.jpg", mimeType: "image/jpeg", buffer: Buffer.from("this is not really a jpeg") });
  await p.waitForTimeout(1500);
  ok(/couldn't open that photo/.test(await toastText(p)), "a broken .jpg -> \"We couldn't open that photo\"");
  ok(/#\/?$|^[^#]*$/.test(p.url()) || !/#\/preview/.test(p.url()), "still on the first screen");
  await p.setInputFiles("#glowUpl", ROOT + "/tests/faces/face03.jpg");
  await p.waitForURL(/#\/preview/, { timeout: 20000 }); ok(true, "a real selfie still works afterwards (same input reused)");
  ok(p.errors.length === 0, "no page errors" + (p.errors[0] ? ": " + p.errors[0] : "")); await p.context().close();

  console.log("B. a purchase survives losing the photo store");
  p = await newPage(b); await p.goto(BASE, { waitUntil: "load" });
  await p.setInputFiles("#glowUpl", ROOT + "/tests/faces/face03.jpg"); await p.waitForURL(/#\/preview/, { timeout: 20000 });
  await p.click('[data-act="prevGen"]'); await p.waitForTimeout(400);
  if (await p.$("#aiOk")) { await p.check("#aiOk"); await p.click('[data-act="aiAgree"]'); }
  await p.waitForSelector(".cmp", { timeout: 40000 });
  await p.click('[data-act="prevSave"]'); await p.waitForSelector('[data-act="checkout"]'); await p.click('[data-act="choose"][data-v="glow_q"]'); await p.check("#renewOk"); await p.click('[data-act="checkout"]');
  await p.waitForURL(/#\/up\/looks/, { timeout: 15000 });
  const ent = await p.evaluate(() => JSON.parse(localStorage.getItem("facetwin.ent") || "{}"));
  ok(ent.paid === "glow_q" && ent.glow === 1, "entitlements are stored on their own: " + JSON.stringify({ paid: ent.paid, glow: ent.glow }));
  await p.evaluate(() => localStorage.removeItem("facetwin.v1")); // the photo store is gone (cleared, corrupted, evicted)
  await p.goto(BASE + "#/account"); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(800);
  const t = (await p.innerText("#app")).replace(/\n+/g, " | ");
  ok(/Glow quarterly/.test(t) && /ACTIVE/i.test(t), "after a reload with no photo store the account still shows the active plan");
  ok(p.errors.length === 0, "no page errors" + (p.errors[0] ? ": " + p.errors[0] : "")); await p.context().close();

  console.log("C. storage full: she is told, and the app keeps working");
  p = await newPage(b);
  await p.addInitScript(() => { const s = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === "facetwin.v1" && String(v).length > 5000) throw new DOMException("quota", "QuotaExceededError"); return s.call(this, k, v); }; });
  await p.goto(BASE, { waitUntil: "load" });
  await p.setInputFiles("#glowUpl", ROOT + "/tests/faces/face03.jpg"); await p.waitForURL(/#\/preview/, { timeout: 20000 }); await p.waitForTimeout(1200);
  ok(/storage is full/.test(await toastText(p)), "the user sees \"Your phone's storage is full\"");
  await p.click('[data-act="prevGen"]'); await p.waitForTimeout(400);
  if (await p.$("#aiOk")) { await p.check("#aiOk"); await p.click('[data-act="aiAgree"]'); }
  await p.waitForSelector(".cmp", { timeout: 40000 }); ok(true, "an edit still works in memory");
  ok(p.errors.length === 0, "no page errors" + (p.errors[0] ? ": " + p.errors[0] : "")); await p.context().close();

  await b.close();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log("SCRIPT ERROR:", e.message.split("\n")[0]); process.exit(1); });
