# Handoff for the next chat (read this first)

State at the end of 6 Nov 2026. Everything here is a fact checked in the previous chat unless marked "unverified". **No secrets are in this file or in the repo.**

## 1. Who, what, language

- Owner: Nurdaulet (GitHub `nurdamiron`). Team: Nurdaulet, Zhasulan, Iskander (Zimran IT School capstone, **demo is imminent**).
- Product: **FaceTwin = Glow**. A web app: upload a selfie, one tap retouch (8 retouches + 4 Studio background edits), before/after, HD download behind a paywall. Add-ons after checkout: **Looks** (3D twin, hair/brow/beard looks) and **Coach** (face report, 12-week plan, camera coach, weekly re-scan).
- Offer and prices (source of truth: pitch deck + Excel v5, implemented in `config.js`): Glow monthly $9.99 first month then $19.99; Glow quarterly $22.49 then $44.99; Looks $29.99 (second chance $23.99); Coach $24.99 (second chance $19.99); free = 2 edits, no download.
- Talk to the owner in **Russian**, short and concrete. Repo docs are in English.
- Read first: `docs/PRODUCT.md`, `docs/LANDING.md` (decisions, state, plan, Framer prompts), `docs/LANDING_SPEC.md` (the finished landing), `README.md`.

## 2. Repo and deploy state

| Thing | State |
|---|---|
| Repo | `nurdamiron/facetwin-v2`. `main` = Stripe payments + deck pricing + add-ons + Studio + tests + landing docs (PR #1 merged, then docs fast-forwarded) |
| Work branch | `claude/trusting-sagan-e7t7hi` (ahead of `main`: landing plan/spec docs, camera fix, e2e scripts, this file). **Not in `main` yet** |
| Rules | Develop and push on the work branch. **Push to `main` only when the owner says so explicitly.** Open a PR only when asked. Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: <session url>` |
| Vercel | project `facetwin`, team `nurdaulet-akhmatovs-projects`, connected to the repo (every push builds a preview; `main` = production). Branch preview: `https://facetwin-git-claude-trustin-15191a-nurdaulet-akhmatovs-projects.vercel.app`. **Production domain (found 6 Nov): `https://facetwin-demo.vercel.app`** (public; `facetwin-topaz.vercel.app`, the repo homepage, redirects to it). On 6 Nov it serves the old `main` and `/api/status` was `ai:false, payments:false, upsells:false`, so no Vercel env vars are set yet. Preview URLs of this branch sit behind a Vercel login |
| Env vars in Vercel | **On 6 Nov `/api/status` of `facetwin-demo.vercel.app` returned `ai: false, payments: false, upsells: false`: the Gemini key and the Stripe variables are NOT set there.** It must say `true` for all three before any demo |
| Gemini | **Never run for real.** Only the mock was used. This is the biggest risk |
| Stripe | Only the mock was used. `scripts/stripe-setup.js` creates products, prices, coupons, portal from `config.js` |
| Framer landing | https://shiny-culture-616454.framer.app/ (public). Header, footer and top logo are still the template's, including the template author's affiliate link |

## 3. Tests you can run (all pass at the end of the previous chat)

```bash
npm test                                   # 28 unit tests (prompts, prices, /api/*, token signing); no network
STRIPE_MOCK=1 AI_MOCK=1 node scripts/dev-server.mjs &    # local app on :8080 with mock Gemini and mock Stripe
NODE_PATH=$(npm root -g) node tests/e2e/funnel.cjs       # headless funnel: free user, buys Looks, buys Coach + onboarding
NODE_PATH=$(npm root -g) node tests/e2e/camera.cjs       # camera screen, blocked camera, fake webcam -> report
```

Playwright and Chromium are preinstalled in the Claude cloud sandbox. The dev server only reloads the API file you changed, not its imports: restart it after editing `api/_stripe.js`.

## 4. The product audit (in progress)

Found and fixed: **`selfieView` was never defined**, so the camera screen and the weekly re-scan (Coach) crashed from the first commit. Restored in `app.js`; camera e2e passes.

Still to do in the audit, in this order:
1. **Design: make the whole app look like the landing ("startup design").** The owner's message was cut off after "like on our landing, on ..." (probably "on every screen / on the phone"). Ask one short question to confirm, then screenshot every app screen at 390 px (landing, editor, results, paywall, add-on offers, account, Coach screens, camera) and align: dark `#0E0E14`, purple `#7C4DFF`, Instrument Serif + Inter Display, big confident headings, generous spacing, one primary button per screen, no emoji (icons from `icons.js`).
2. Re-scan flow end to end (Coach): `#/scan` -> upload or camera -> `scanresult` (not yet tested after the fix).
3. Storage stress: 12 edits with large images; `save()` quota handling; what the user sees when storage is full.
4. Bad input: unreadable photo (HEIC on Chrome), 20 MP photo, no face, two faces. `bindGlowUpload` has no try/catch around `fileToDataURL`.
5. Mobile save: use the Web Share API with the file where available ("Save image"), fall back to download.
6. Limits on Vercel: request and response bodies are capped at about 4.5 MB (a large PNG from Gemini could exceed it); only `api/edit.js` has `maxDuration` set.
7. Cleanup from ESLint: unused `defaultLooks`, `lookChips`, `hairOn`, `daysDone`.
8. Real access control (Stripe webhooks, hard rate limit) is a known open item (README "Known limits").

## 4b. Funnel fixes of 6 Nov (afternoon)

- **Waiting screens never look frozen** (`crawler`, `waitScreen`, `fetchT` in `app.js`): the ring and bars always creep forward, status lines rotate, after 12 s an honest "keep this page open" hint, hard timeouts. The 3D AI download (`depth3d.js`) has a stall watchdog and one retry, shows MB instead of a stuck 0%, and is prefetched while she takes the selfie; a stuck 3D step is skipped, the twin still works. Used on: building the twin, AI edit, opening Stripe, confirming payment. Tests: `tests/e2e/waiting.cjs`.
- **No photo on the add-on offer screens** (it was her last edit, cropped and pointless there).
- **Photos instead of cartoon/mismatched icons**: 13 routine step photos in `assets/routine/` (`scripts/gen-routine-photos.mjs`) and 26 option photos for hair colour, hairstyle, braids, brows, beard in `assets/looks/` (`scripts/gen-look-photos.mjs`), both made with OpenAI Images (`gpt-image-2.6-sunburst`, override with `OPENAI_IMAGE_MODEL`). They are AI-generated examples, not customers: never present them as users or results. Tests: `tests/e2e/steps.cjs`, `tests/e2e/looktiles.cjs`.
- Still cartoon / icon-only: the exercise coach screens (`exercises.js`, animated face) and the V1 "Meet your 3D twin" tiles (`faceArt`). Next candidates for photos.
- The OpenAI key for these scripts was entered through the secure form (host `api.openai.com`); it is not in the repo. Locally use `OPENAI_API_KEY=...`.

## 5. Framer: how it was built, and what the API can do

- Project: "Sensoria Template // Luna UI (copy)". URL: `https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y`. Home page node `augiA20Il`; breakpoint frames Desktop / Tablet / Phone.
- Access was through the **Server API**: `npm i framer-api` (Node 22), `FRAMER_API_KEY` env var, WebSocket to `api.framer.com`. In the Claude sandbox run Node with `NODE_USE_ENV_PROXY=1` so the WebSocket uses the proxy. An official **Framer MCP connector** also exists in the Claude connector registry (OAuth, no key); it was never connected.
- Works: read/write text and component-instance controls on the page, `addDetachedComponentLayers`, `setParent`, `removeNodes`, `publish`. Master components (header, footer, cards) are NOT reachable with the normal node API, but ARE with `framer.agent.applyChanges(dsl, {pagePath})` (commands `+Variable`, `+FrameNode`, `+IconNode`, `SET`, `DEL`, `MOVE`, `DUPE`; reference in `tools/framer/agent-dsl.txt`). The nine highlight-card icons were done this way (6 Nov); the remaining design fixes (hero, footer, steps, FAQ heading, orange dots) in `docs/LANDING_DESIGN_REVIEW.md` can be done the same way. **Nothing from 6 Nov is published yet.** Details and pitfalls (stray copies at breakpoint roots, mirrored breakpoint nodes) are in `docs/LANDING.md` section 3.
- `publish()` goes live immediately at the `.framer.app` URL.
- The scripts that built the page are in `tools/framer/` (README there). `set-prices.mjs` keeps the pricing cards equal to `config.js`; the Framer content itself lives in the Framer project, not in git.

## 6. Credentials: names only, never values

Do **not** ask the owner to paste secrets into chat and do not commit them. Use the secure form (`request_credential`: host, header `Authorization`, prefix) for API hosts, or ask the owner to enter values in the Vercel dashboard.

| Need | What | Who sets it | Status |
|---|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio key **with billing** | owner, Vercel env (Production + Preview) | unverified |
| `STRIPE_SECRET_KEY` | `sk_test_...` for now | owner, Vercel env; also used once locally for `scripts/stripe-setup.js` | unverified |
| `STRIPE_PRICE_*`, `STRIPE_COUPON_*`, `STRIPE_PORTAL_CONFIG` | printed by `stripe-setup.js` | owner pastes into Vercel | unverified |
| Framer API key | per project, Site Settings -> API Keys | **the old key was pasted in chat: it must be revoked.** For new work ask for a new one via the secure form (host `api.framer.com`, `Authorization: Token <key>`; injection into the WebSocket handshake was never tested). Fallback: the owner runs a script locally | **revoke** |
| Vercel token | not needed (GitHub integration deploys) | | an earlier request was declined |
| GitHub | repo-scoped through the GitHub tools | none | works |
| Google Drive | Claude connector (OAuth), not a key | owner connects in claude.ai | was connected last chat |
| `META_PIXEL_ID`, `LEAD_ENDPOINT` | IDs, not secrets | owner gives, put in `config.js` | empty |
| Production domain | app address | owner gives | unknown |

Claude cloud environment used: personal environment `facetwin-v2` (`env_017n6NiecekMtpiDCU5G7JAM`) with allowed hosts: `bloomeskincare.framer.website`, `sensoria.framer.website`, `faceshift.framer.website`, `api.framer.com`, `shiny-culture-616454.framer.app`, `framerusercontent.com`. `*.vercel.app` and `drive.google.com` are **not** allowed (use the Drive connector, and ask the owner to allow the production host if you need to open it). A new chat must run on that environment or ask to add hosts again.

## 7. Google Drive (team folder "FaceTwin - V2", id `1sYmKkPozgdNwSRh1q092YXpzDDj3aT61`)

Subfolders: 01 Capstone presentation, 02 Working Product, 03 Product Demo, 04 GitHub link, 05 Landing Page (the last four were empty), 06 Marketing Creatives (2 statics, 2 videos, competitor ads review), 07 Unit Economics.
Files used: pitch deck (Slides `1RKtIudIazVX_gtmEv3CxE4PM4yie92C3DJve5XGciwU`, newer than the `.pptx` "v3 Final"), market and pricing doc `1YEOSJpItUdpir8XW_HCfub0pzqhXejCFqIE4SIcFaXQ` (older, 2 Nov: do not trust its prices), unit economics sheet `1c8uPhyxTCdu3O6VbepssqipPtnTDr3auokIO6aypizI`, competitor ads review `1dYNhALgfT4X7DaL_5dYPK0XKEeR6nZpK`.
Deck claims the app contradicts (owner must fix the slides): "photos never leave her phone" (the photo goes to Gemini with consent), "360 degree twin" (it is 180, face only), crossed-out $59.99 / $49.99, $22.49 vs $22.50, two different "net" figures (89% vs 81.2%).

## 8. Ordered plan for the next chat

1. Ask the owner: (a) the end of the cut-off design message, (b) is `/api/status` all `true` on the live app, (c) production domain, (d) do they have real before/after photos.
2. Finish the audit in section 4, starting with the design alignment. Test every change with `npm test` and the two e2e scripts; fix what breaks; commit on the work branch.
3. Get a real Gemini run (owner supplies the key in Vercel), score `PROMPTS.md` results, fix prompts if needed. Nothing else matters more.
4. Framer: owner runs the four agent prompts in `docs/LANDING.md`; then rebuild the four Faceshift ideas and put real photos in the sliders (`docs/LANDING_SPEC.md`).
5. Production domain into the landing buttons, `PUBLIC_URL`, `SHARE_URL`.
6. Remind the owner to revoke the old Framer key and to fill the `[brackets]` in `privacy.html` / `terms.html`.
7. Ask whether to fast-forward `main` with the branch.

## 9. Guardrails (do not create a different product)

Never claim: photos stay on the phone, 360 degrees, neural / dermal / clinical / science-backed, any medical effect, invented users, reviews, ratings, counts or people. Never show a price that was not charged. Keep prices identical in Excel, `config.js` and Framer. The product is selfie retouch with natural results; Looks and Coach are optional one-time add-ons.
