// Camera test: the camera screen renders, a blocked camera gives a clear message, and a fake webcam with a face
// auto-captures the front selfie, skips the side photos and builds the report.
// Needs: node 22, playwright (global), ffmpeg (builds the fake webcam file from tests/faces/face09.jpg).
//   STRIPE_MOCK=1 AI_MOCK=1 node scripts/dev-server.mjs &
//   NODE_PATH=$(npm root -g) node tests/e2e/camera.cjs
const { chromium } = require("playwright");
const path = require("path"), os = require("os"), fs = require("fs"), { execSync } = require("child_process");
const SP = path.join(os.tmpdir(), "ft-cam"); fs.mkdirSync(SP + "/cam", { recursive: true });
const FACE = path.resolve(__dirname, "../faces/face09.jpg");
execSync(`ffmpeg -loglevel error -y -i ${FACE} -vf "crop=720:540:0:40,scale=640:480" -q:v 3 -frames:v 1 ${SP}/cam/f.jpg`);
const jpg = fs.readFileSync(SP + "/cam/f.jpg"); fs.writeFileSync(SP + "/cam/face.mjpeg", Buffer.concat(Array(60).fill(jpg)));
let fails = 0;
const ok = (c, m) => { console.log((c ? "  OK   " : "  FAIL ") + m); if (!c) fails++; };
(async () => {
  // A) camera denied (no fake device): the screen must render and explain, not crash
  let b = await chromium.launch(); let ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); let p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));
  await p.goto("http://localhost:8080/#/selfie", { waitUntil: "load" }); await p.waitForTimeout(1200);
  // selfie route needs a photo? it has no 'needs', so it renders directly
  const t = await p.innerText("#app").catch(() => "");
  ok(/Selfie 1 of 3/.test(t) && /Take photo/.test(t) && /Upload 1-3 photos/.test(t), "A. onboarding camera screen renders");
  await p.waitForTimeout(4000);
  const hint = await p.innerText("#hint").catch(() => ""); const note = await p.innerText("#snote").catch(() => "");
  ok(/blocked|Face AI|Loading/i.test(hint) || /Allow the camera|upload/i.test(note), "A. camera blocked/slow -> clear message: " + JSON.stringify(hint.slice(0, 40)) + " " + JSON.stringify(note.slice(0, 60)));
  ok(errs.length === 0, "A. no page errors" + (errs[0] ? ": " + errs[0] : "")); await b.close();

  // B) fake camera with a face: onboarding front shot, skip sides, builds the report
  b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-video-capture=" + SP + "/cam/face.mjpeg", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera"] }); p = await ctx.newPage(); const e2 = [];
  p.on("pageerror", (e) => e2.push(e.message.slice(0, 140)));
  await p.goto("http://localhost:8080/#/selfie", { waitUntil: "load" });
  let got = false;
  try { await p.waitForFunction(() => !!document.querySelector('[data-th="0"]')?.style.backgroundImage, null, { timeout: 60000 }); got = true; } catch {}
  await p.screenshot({ path: SP + "/cam/onboard.png" });
  ok(got, "B. front selfie auto-captured from the camera (hint: " + JSON.stringify(await p.innerText("#hint").catch(() => "")) + ")");
  if (got) {
    ok(!(await p.$eval("#skipside", (n) => n.classList.contains("hidden"))), "B. 'Skip the side photos' appears after the first shot");
    await p.click("#skipside"); await p.waitForURL(/#\/building/, { timeout: 10000 }).catch(() => {});
    ok(/#\/building/.test(p.url()), "B. skip -> building the report");
    await p.waitForURL(/#\/twin/, { timeout: 170000 }).catch(() => {});
    ok(/#\/twin/.test(p.url()), "B. report built -> " + p.url().split("#")[1]);
  }
  ok(e2.length === 0, "B. no page errors" + (e2[0] ? ": " + e2[0] : "")); await b.close();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
})().catch((e) => { console.log("SCRIPT ERROR", e.message.split("\n")[0]); process.exit(1); });
