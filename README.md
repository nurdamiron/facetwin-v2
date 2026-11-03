# FaceTwin

## V2 (Capstone): Glow, natural retouch in one tap

The landing is now the editor: **upload a selfie → pick a retouch → see before/after → download in HD behind the paywall.** The 3D twin, hair/brow/beard looks and the exercise coach from V1 stay in the code as **Pro**.

| What | Where |
|---|---|
| **Glow**: 8 retouches (one-tap natural, acne & spots, under-eye bags, wrinkles, teeth whitening, freckles on / off, glow). Each is one instruction to Gemini with an identity-preserving prompt. | `previews.js` (group `Glow`, base text `BASE_RETOUCH`) |
| New landing (upload or demo face) and the fast path straight into Glow | `app.js` (`R.landing`, `useGlowPhoto`); the V1 3D flow is `R.meet3d` |
| 2 free edits, then **Download in HD** is gated (`prevSave`), 3D twin is Pro (`prev3d`) | `config.js` `FREE_PREVIEWS`, `app.js` |
| **V2 plans**: Glow $7.99 first month then $9.99 / $49.99 a year, Pro $15.99 then $19.99 / $99.99 a year. Renewal terms shown above the button, unticked consent box | `config.js` `PLANS_GLOW`, `app.js` `glowPaywall` |
| **Consent before a photo leaves the device** (unticked box, remembered, logged as `AIConsent`) | `app.js` `askAIConsent`; text mirrored in `privacy.html`, `terms.html` |
| **Hosted AI proxy** (replaces `server.py` on a public URL): prompt built on the server from the edit id, size and type checks, same-origin only, best-effort rate limit | `api/edit.js`, `api/status.js`, `vercel.json`, `package.json` |

### Deploy on Vercel (about 10 minutes)

1. Import the repo in Vercel. No build step; framework preset "Other".
2. Project → Settings → Environment Variables: `GEMINI_API_KEY` (Google AI Studio key **with billing**, image models have no free API tier). Optional: `RATE_LIMIT_PER_HOUR` (default 20), `DAILY_CAP` (default 500), `GEMINI_IMAGE_MODEL`.
3. Deploy. Open the URL, upload a selfie, tap Show me. Test in an incognito window.
4. In `config.js` fill `LEAD_ENDPOINT` (Formspree) and `META_PIXEL_ID`; set `PAYMENT_LINKS` (`glow_m`, `glow_y`, `pro_m`, `pro_y`) with your checkout links and their success URL to `https://YOUR-SITE/?paid=glow_y#/preview` (use the plan id). While a link is empty the paywall shows the honest "payments open soon" screen.
5. For a demo without paying: add `?tester=1` to the URL (everything unlocked, including HD and 3D).

Local test without a key: `MOCK=1 python3 server.py` (the edit returns your photo unchanged).

### Known limits (not done yet)

- `?tester=1` and `?paid=` unlock on the client only; real access control needs a backend and webhooks.
- The rate limit in `api/edit.js` is per server instance. For a hard cap use Upstash or Vercel KV and a Google spend limit.
- `models/depth_anything_v2_vits.onnx` is ~99 MB: check your host's file limits (only the Pro 3D twin needs it).
- `privacy.html` and `terms.html` still have `[brackets]` (legal name, address, refund policy) and need a lawyer's review before paid ads.
- The example image on the landing is the V1 demo head; replace `assets/demo/front.jpg` usage with your own before/after pair.

---

**Your realistic 3D twin from one selfie, a camera coach for face exercises, and any hair or face change shown on your own face in 3D.** (V1 description, still in the code)

FaceTwin is a mobile web app. Its core is a **realistic 3D twin**. With the front and two side selfies it builds a **180° twin** (`head3d.js`): the 478 face points find how far the head turned in each photo, the depth surfaces are merged around the head, and each spot is coloured from the photo that saw it best. With only one photo it falls back to the one-photo twin: a depth AI (Depth Anything V2 Small) lifts the whole photo, including hair, ears and neck, into 3D, scaled to true face proportions with 478 face points. It runs on the device; turn it by dragging.

Two features sit on top of the twin:

1. **Face exercise coach** (`exercises.js`, Exercise tab). Competes with Jawline Exercises and Face Yoga apps, which only show videos and timers. Here the front camera reads 52 facial muscle scores live (MediaPipe blendshapes), **counts every rep, times each hold and checks form** ("face the camera", "keep your lips together", "even out both sides"). It learns her relaxed face first, adapts the target to her range, and tracks "reach" (range of motion) over time in Progress. 7 exercises (jaw opener, fish face, ceiling kiss, A–O vowels, cheek puff, smile hold, forehead lift); a 5-exercise daily workout of about 4 minutes. Nothing is recorded or uploaded.
2. **Face and hair changes in 3D** (`previews.js`, Looks tab): hair color, hairstyles, braids, brows, mustache and beard (26 options), or her own idea in words. A realistic AI edit of her photo, shown first on her 3D twin, then with a before/after slider. Changes can be stacked ("＋ Add a change on top", e.g. mustache + braid).

Status: MVP for testing with real users and Meta ads. See [`docs/PRODUCT.md`](docs/PRODUCT.md) for the product case and [`PROMPTS.md`](PROMPTS.md) for the free manual preview test.

## Quick start

```bash
git clone <this repo> facetwin && cd facetwin
python3 server.py            # then open http://localhost:8080/?tester=1
```

- No build step and no dependencies beyond Python 3. The face AI runs in the browser.
- Realistic previews need a Gemini API key in `gemini_key.txt` (git-ignored). See "Realistic previews" below.
- `?tester=1` unlocks everything for your own testing; `?debug=1` adds tracking popups and time-travel tools.

## Screens

- **Exercise** tab: today's workout, all exercises, live camera session with rep counter, hold ring, range meter and voice count (sound toggle), result per exercise, workout summary.
- **Looks** tab: groups of changes, generate, view in 3D, compare, stack, save photo. 1 free look, then the paywall.
- **Progress** tab: workout reach chart and per-exercise "first → now", plus re-scans.
- Older extras are still in the code (face report, skincare routine, drawn try-on, share card).

## Realistic previews: turn them on (about $5 covers ~125 previews)

1. Go to **aistudio.google.com** → **Get API key** → **Create API key**. Copy it.
2. Image models have **no free API tier**, so add billing to that Google Cloud project (pay as you go, about $0.04 per preview). Testing by hand in the AI Studio website stays free: see `PROMPTS.md`.
3. Create a file named `gemini_key.txt` in this folder and paste the key into it (one line). The page never sees the key; only `server.py` reads it. Don't share or upload this file.
4. Start the app with `python3 server.py` (below). The terminal should say **"AI key found"**.

To change the AI model: `GEMINI_IMAGE_MODEL=model-name python3 server.py`. To test without a key: `MOCK=1 python3 server.py` (returns your photo unchanged).

## 1. Run it on your computer (localhost)

```bash
cd FaceTwin_MVP
python3 server.py
```

(`python3 -m http.server 8080` also works, without realistic previews.)

Open **http://localhost:8080** in Chrome. Browsers allow the camera on localhost.

- Add `?tester=1` to unlock everything for your own testing (`?tester=0` turns it off). Add `?debug=1` to the address (`http://localhost:8080/?debug=1`) to see every tracking event pop up. It also adds test tools in Settings: "+1 day", "+7 days", "Mark paid".
- To start over: Settings → Privacy → Delete, or clear the site data in your browser.

A phone can't use the camera from your computer's local address, because a phone needs **https**. So use step 2 to test on a phone.

## 2. Put it online for free (Netlify Drop, about 2 minutes)

1. Go to **app.netlify.com/drop** and sign up free.
2. Drag the whole `FaceTwin_MVP` folder onto the page.
3. You get a link like `https://something.netlify.app`. Open it on your phone: camera, Home Screen install and sharing all work.
4. Optional: in Site settings → Domain, connect a domain such as `facetwin.app` (~$10–15/year). Ads look more trustworthy on your own domain.

Alternatives: Vercel or Cloudflare Pages (also free). The folder is plain HTML, CSS and JavaScript, with no build step.

## 3. Settings: edit `config.js` before the ad test

| Setting | What to put there |
|---|---|
| `META_PIXEL_ID` | Meta Events Manager → Connect data → Web → Pixel. Copy the number. |
| `LEAD_ENDPOINT` | Free option: create a form at formspree.io and paste its URL. Each signup sends email, quiz answers, face shape, chosen plan and UTM tags. **No photos.** |
| `PAYMENT_LINKS` | Checkout links from your payment provider. While empty, the paywall shows an honest "Payments open in a few days, 50% off early access" screen and starts the free week, so you still measure who tries to pay. |
| `SHARE_URL` | The link printed on share cards. |

**When you add payments:** set the provider's *success / redirect URL* to `https://YOUR-SITE/?paid=twelve#/welcome`, using `trial`, `four` or `twelve` to match the plan. The app then unlocks the full plan and fires `Purchase`.

- If the link contains `{email}`, the app fills in her email.
- Stripe doesn't open accounts for Kazakhstan. Check that your provider pays out to you (Paddle, Lemon Squeezy and Gumroad act as the seller for you).
- The `?paid=` unlock lives only in the browser. That's fine for a test, but real access checks need a small backend later.

## 4. Events sent to Meta (your funnel)

| Event | When | Use it for |
|---|---|---|
| `PageView` | Site opens | Click → landing rate |
| `FunnelStart` (custom) | "Make my twin" tapped | Hook strength |
| `QuizStart` / `QuizComplete` (custom) | Goal answered / skin quiz done | Quiz drop-off |
| `CameraAllowed` / `CameraDenied` (custom) | Camera permission | Trust problem? |
| `SelfiesDone` (custom) | Photos taken or uploaded | Capture drop-off |
| `TwinViewed` (custom) | First sight of her twin (**the aha**) | Aha rate |
| `Lead`, `CompleteRegistration` | Email saved | **Optimize ads for this first** |
| `PaywallView` / `Day7PaywallView` (custom) | Paywall seen | |
| `InitiateCheckout` (value = plan price) | "Start my plan" tapped | **Willingness to pay**, even before payments exist |
| `JoinWaitlist` (custom) | Early-access spot saved | |
| `StartTrial` | Free week started | |
| `RoutineStep`, `DayComplete`, `WeeklyScan` (custom) | Daily use | Activation and retention |
| `LookTried`, `AddToWishlist`, `UpsellShown` | Try-on use | |
| `Share` (custom, method) | Share card sent | Organic loop |
| `ReportViewed`, `PreviewScreen` (custom) | Report / preview screen seen | Aha funnel |
| `PreviewGenerated`, `PreviewFailed`, `PreviewSaved` (custom) | Realistic preview made / failed / saved | Core value |
| `Twin3DViewed` (custom) | 3D face shown | Aha |
| `ShelfView`, `ShelfTier`, `ShelfOwn`, `ShelfListCopied`, `ShelfListSaved` (custom) | My shelf use | Job 2 engagement |
| `ShelfBuyClick` (custom, value = product price) | "Find it" tapped | Affiliate revenue potential |
| `Purchase`, `Subscribe` | Back from checkout with `?paid=` | Real revenue |

`Screen` (custom, with `screen` name) fires on every screen, so you can build any funnel in Events Manager → Custom conversions.

## 5. First Meta test (suggested)

- **Budget:** $150–300 over 5–7 days.
- **Audience:** women 28–45 in the US/UK, broad targeting (Advantage+ audience).
- **Placements:** Instagram Reels, Stories and Feed.
- **Optimize for:** `Lead`. A brand-new pixel has no purchases to learn from.
- **Creatives:** 3 hooks, one per job from HW2:
  1. *"I tried copper hair on my own face before the salon"*: a screen recording of the try-on.
  2. *"My 5-minute routine, built from 3 selfies"*: the quiz → twin → plan.
  3. *"Week 0 vs week 3"*: the share card style.
- **UTM tags on every ad:** `?utm_source=meta&utm_campaign=ft_test1&utm_content={{ad.name}}`. They're saved with each lead.
- **Read the results against the HW1 metric tree:**
  - CTR and cost per click
  - Landing → `QuizComplete` → `TwinViewed` → `Lead` → `InitiateCheckout`
  - Cost per Lead and cost per InitiateCheckout. Compare them with the $51 paid CAC assumption.
- **Before spending:** fill in the [brackets] in `privacy.html` and `terms.html` and get them reviewed. Meta also asks for a privacy policy link.

## 6. Honest limits of this MVP

- **The 3D twin is the face only** (forehead to chin). Hair colors show in photo view. A full 3D head with hair needs a paid photo-to-3D service later. In ads, say "3D face", not "3D head".
- **My shelf prices are approximate** US retail. Check them, and have a cosmetologist review the picks, before launch.
- **Hair color:** pick from 7 shades, an ombré or any color from a color picker; a strength slider works for hair, skin, brows and lips. A hair model downloads from Google's model storage on first use (a small file). To self-host it, download `hair_segmenter.tflite` into `models/` and change `HAIR_MODEL_URL`. If it can't load, hair tiles say "offline" and the other looks still work.
- **Skin score** is a rough guide from one photo (texture, tone, redness, under-eyes). Light changes it, which the app says on screen. It's face care, not a diagnosis.
- **Reminders:** a daily calendar alert (.ics) plus "Add to Home Screen". Real morning push needs a push service (for example OneSignal's free plan) as a next step.
- **Data per device:** her plan lives in one browser. A second phone means starting over, until there's a backend (Supabase's free tier is the usual next step).

## Files

| File | What it does |
|---|---|
| `index.html`, `styles.css` | App shell and the canvas design system: dark, purple #7C4DFF, pastel cards |
| `app.js` | All screens, state, the free week and paywall logic, tracking, share card |
| `vision.js` | Face AI: landmarks, quality checks, face shape and skin guide, try-on drawing |
| `server.py` | Local server: serves the app and sends previews to the AI editor with your key |
| `previews.js` | The preview list and the exact AI instructions (same as `PROMPTS.md`) |
| `PROMPTS.md` | Free manual test in AI Studio + the paid test with real women |
| `plans.js` | Routine library and rules (edit the texts with a cosmetologist) |
| `shelf.js` | Product picks per routine step, 3 price levels |
| `depth3d.js` | Depth AI (ONNX Runtime Web, WebGPU or WASM): photo → depth map, saved as a 16-bit PNG |
| `head3d.js` | 180° twin: aligns the 3 selfies, merges their depth into one head, view-dependent colouring |
| `tests/` | `batch.html` (10-face test) and `head.html` (180° test against rendered 3D heads) |
| `exercises.js` | Face exercise coach: exercise library, workout, and the rep counter (calibration, hold timing, form checks, adaptive range) |
| `twin3d.js` | The rotating 3D face (Three.js r128 in `vendor/three/`, MIT) |
| `config.js` | **Your settings** |
| `privacy.html`, `terms.html` | Draft legal pages to fill in |
| `manifest.webmanifest`, `sw.js`, `assets/` | Installable app, icons, share preview image |
| `models/depth_anything_v2_vits.onnx` | Depth Anything V2 Small (Apache-2.0), ~99 MB, downloaded once then cached |
| `vendor/ort/` | ONNX Runtime Web 1.22 (MIT) |
| `vendor/mediapipe/`, `models/face_landmarker.task` | Google MediaPipe Tasks Vision 0.10.20 and the face model (Apache 2.0) |
