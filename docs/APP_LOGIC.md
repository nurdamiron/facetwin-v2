# FaceTwin: how the app works (logic, rules, edge cases)

State of 6 Nov 2026 (code on the work branch). Prices and claims: `docs/HANDOFF.md` section 9. Event names: `docs/FUNNEL.md`.
Everything below is what the code does now; "Gap" marks what it does not do yet.

## 1. The journey in one picture

```
ad -> Framer landing -> app "/" (examples slider, Upload a selfie)
   -> #/preview  pick a change (One-tap natural by default) -> "Show me"
   -> AI consent (once) -> /api/edit -> before/after result
   -> tap "Download in HD"
        free  -> #/paywall (plans) -> Stripe Checkout -> /?cs=... -> /api/verify -> unlocked
        paid  -> file is saved (share sheet on phones, download elsewhere)
   -> after the plan: add-on offers  #/up/looks -> #/up/coach  (each with a one-time "second chance" price)
   -> Looks owned: hair / brows / beard looks + 3D twin.  Coach owned: onboarding -> report -> 12-week plan -> camera coach -> weekly re-scan
```

The landing never takes payment. The first screen after the upload is the editor, so she sees her own result before she is asked for money.

## 2. What each person can do

| | Free | Glow (monthly or quarterly) | + Looks (one-time) | + Coach (one-time) |
|---|---|---|---|---|
| Edits | **2** AI edits in total (retouch or Studio), counted in `S.previewsUsed` | unlimited retouch (8) and Studio (4) | + hair colors, hairstyles, braids, brows, beard, "your idea" | no change |
| Result | before/after on screen | + **HD download** (no watermark) | + 3D twin | no change |
| Face report, plan, camera coach, re-scan | no | no | no | yes |

Gating rules in code: `isPaid()` = has a plan (or tester mode), `hasLooks()` / `owns("coach")` = bought the add-on. A Glow subscriber who opens a Coach screen without Coach gets the Coach offer (or the onboarding if she owns it), never the Glow paywall again.

## 3. Where her photo goes

1. She picks a photo. It is read in the browser, scaled to 1024 px, and a face check runs on the device (MediaPipe). No upload yet.
2. She taps **Show me**. First time only, a consent box (unticked) says the photo goes to the AI provider. Only after she ticks it does the browser send the photo (JPEG, base64) to our `/api/edit`.
3. `/api/edit` (Vercel function): checks the origin, the file type and size, builds the prompt **on the server** from the edit id (the browser cannot send its own prompt; the "Your idea" text is cleaned and capped at 200 characters), applies the limits, calls the provider and returns the image. Nothing is logged or stored.
4. The browser keeps the result in **localStorage** (720 px preview for each of the latest 12 edits; the 1600 px HD file only for the latest 4). Nothing about the photo is stored on our server.
5. Stripe holds her email, card and subscription (our server keeps nothing).

Provider: `GEMINI_API_KEY` or `OPENAI_API_KEY` (Vercel env vars, never in the repo); `AI_PROVIDER` forces one when both exist. `/api/status` shows `ai`, `provider`, `model`, `payments`, `upsells`.

## 4. Limits and protection (server side)

| Protection | Value | Where | Weakness |
|---|---|---|---|
| Per-IP edits per hour | 20 (`AI_EDITS_PER_HOUR`) | `api/edit.js`, in memory | resets on a cold start; shared Wi-Fi shares the limit |
| Daily cap | 500 (`DAILY_CAP`) | same | per server instance, not global |
| Photo size | about 6 MB, jpeg / png / webp | same | |
| Same-origin only | yes | same | not a secret, only blocks other sites |
| Free quota (2 edits) | counted in the browser | `app.js` | **Gap:** clearing site data gives 2 more free edits; only the per-IP limit stops abuse |

## 5. Payment logic

- Plans: Glow monthly $9.99 for the first month then $19.99; quarterly $22.49 for the first quarter then $44.99. First-period price = a Stripe coupon (`duration: once`).
- The pay button stays off until she ticks the renewal box; today's price, the renewal price and "we remind you 3 days before" sit above the button.
- `/api/checkout` creates the Stripe session (the secret key stays on the server). Stripe sends her back to `/?cs=<session>`; the app asks `/api/verify`, and **only if Stripe says the session is paid** does it set `S.paid` / `S.owned`. A typed URL unlocks nothing.
- Add-ons are separate one-time Stripe payments shown right after the plan; "No thanks" shows one second-chance price, then the next add-on, then the editor.
- Cancel: Account -> Manage subscription opens the Stripe customer portal (two taps).
- What she paid for is stored in its own small key (`facetwin.ent`), apart from the photo store, so a full or cleared photo store cannot erase a purchase. The account screen opens without a photo.

## 6. What happens when something goes wrong

| Situation | What she sees | Event |
|---|---|---|
| File is not an image | "That isn't a photo. Choose a JPG or PNG selfie." | `BadPhoto` (type) |
| File over 40 MB | "That photo is too big. Choose one under 40 MB." | `BadPhoto` (size) |
| Unreadable (for example HEIC on Chrome) | "We couldn't open that photo. Try a JPG or PNG..." | `BadPhoto` (unreadable) |
| No face | "We couldn't find a face. Try a clear, front-facing selfie." | `NoFace` |
| Two or more faces | "We see more than one face. Use a photo with only you in it." | `BadPhoto` (several_faces) |
| AI provider error / empty answer / no network | a short message and she can tap Try again; the free edit is **not** consumed on failure | `PreviewFailed` |
| Hourly or daily limit | "Too many edits in the last hour..." / "Daily limit reached..." | |
| Browser storage full | "Your phone's storage is full. Download your photo now..."; the app keeps working in memory; the purchase is still stored | |
| Older edit has no HD file | "Saved at standard size. Only your 4 newest edits keep the full HD file." | |
| Phone | Download opens the share sheet (Save Image) when the browser supports files; else a normal download | `PreviewSaved` (via) |
| Stripe return cannot be verified | toast with the support email, back to the paywall | |

## 7. Known gaps, in order of importance

1. **Access lives in the browser.** Payment is verified by Stripe, but the result (`S.paid`, `S.owned`) is stored in this browser. If she pays inside the Instagram or TikTok in-app browser and then opens the link in Safari or Chrome, or changes phone, or clears site data, the app does not know she paid and shows the paywall. There is no "Restore purchase". Proposed fix: a "Restore purchase" box (email) that calls a new `/api/restore`, which looks up the Stripe customer, checks for an active subscription or a paid add-on session, and returns signed tokens; protect it with a one-time code or a link sent by email (Stripe receipts can carry it), because an email alone must not unlock access. Until then a support reply by email is the manual fallback.
2. **No Stripe webhook.** A cancelled or failed renewal is not reflected in the app until a check is added; today the app trusts the stored plan. Fix: webhook `customer.subscription.deleted` / `invoice.payment_failed` plus a periodic `/api/verify` by customer token.
3. **No server-side Purchase event (Meta CAPI).** Ad-blockers and in-app browsers lose events. The event id is already the Stripe session id, so a later server event de-duplicates.
4. **Free quota can be reset** by clearing site data (section 4).
5. **Response size.** Vercel caps a function response at about 4.5 MB. Gemini returns PNG (usually 1 to 2 MB) and OpenAI is asked for JPEG, so this is fine in practice, but a very large Gemini PNG would fail with an error message.
6. **Real AI quality is unmeasured.** Only mocks were run. `scripts/test-ai.mjs` runs the real call; `PROMPTS.md` holds the prompts to score.
7. Legal text: `privacy.html` and `terms.html` still have `[brackets]` to fill and need a review before paid ads.

## 8. Tests that guard this

`npm test` (33 unit tests: prompts, prices, every `/api/*`, token signing, the OpenAI path) and three headless e2e scripts in `tests/e2e`: `funnel.cjs` (free user, paywall, add-ons, Looks, Coach), `camera.cjs` (camera screen, blocked camera, fake webcam) and `input.cjs` (bad uploads, a purchase surviving a wiped photo store, full storage). Run commands: `docs/HANDOFF.md` section 3.
