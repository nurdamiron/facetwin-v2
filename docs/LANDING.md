# FaceTwin landing and funnel: what we decided and what is left

Status as of 5 Nov 2026. The ordered plan is in section 6. This file is the memory of the landing work so nobody has to rediscover it.
It describes the **same product** as `docs/PRODUCT.md`, it does not change it.

The full spec of the finished page (sections, copy, assets, tracking, acceptance criteria) is in [`docs/LANDING_SPEC.md`](LANDING_SPEC.md).

## 0. The product, in one place (do not drift from this)

FaceTwin = **Glow**: a web app that retouches a selfie in one tap and still looks like the person.

| Part | What it is | Price (source: pitch deck + Excel v5, in `config.js`) |
|---|---|---|
| Glow monthly | 8 retouches + 4 Studio background edits, unlimited, HD download | $9.99 first month, then $19.99 a month |
| Glow quarterly | same plan | $22.49 first quarter, then $44.99 every 3 months ($15.00 a month) |
| Looks (one-time add-on) | 3D twin, hair / braids / brows / beard looks | $29.99, second chance $23.99 |
| Coach (one-time add-on) | face report, 12-week plan, camera coach, weekly re-scan | $24.99, second chance $19.99 |
| Free | 2 edits with before/after, no download | |

Funnel: ad (Meta / TikTok) -> **landing (Framer)** -> app (`Upload a selfie`) -> edit + before/after -> paywall -> Stripe -> add-on offers.
The landing never takes payment. Payment happens after she has seen her own result.

### Claims we may and may not make
- OK: "natural retouch", "keeps your skin texture", "about 10 seconds", "2 free edits", "cancel anytime in Settings".
- OK (privacy): the photo goes to Google's Gemini only when she taps **Show me** and agrees; we do not keep it on our servers; photos stay in her browser.
- NOT OK: "photos never leave your phone" (false for Glow), "360 degree twin" (it is 180 degrees, face only), "neural / dermal / clinically proven / science-backed", any medical claim.
- NOT OK: crossed-out prices that were never charged (the deck's "shown $59.99" idea), invented users, reviews, ratings, press logos, "% improvement" numbers, fake people.

## 1. Links

| What | Link |
|---|---|
| Landing (Framer, published production URL since 6 Nov) | https://facetwin.framer.website/ (the older https://shiny-culture-616454.framer.app/ also exists) |
| App (production, used by the landing buttons) | https://facetwin-demo.vercel.app/?utm_source=framer&utm_medium=landing |
| App production domain | **TBD**: replace the buttons' link when known |
| Framer project | "Sensoria Template // Luna UI (copy)" in the owner's Framer account |

The landing is public at its `.framer.app` URL. Do not share it until section 4 is done.

## 2. Reference sites and the decision

We looked at four Framer sites. Decision: keep the Sensoria copy we already built, borrow ideas from the others.

| Site | Verdict | Take | Do not take |
|---|---|---|---|
| Sensoria (chosen base) | Closest look to our dark app, good skeleton | dark premium look, 4-step "how it works", results block, FAQ, repeated CTA | invented numbers ("94% accuracy"), "neural" wording, founder block, "send us your routine" form |
| Bloome | Skincare brand + shop, less relevant | "Others vs us" table idea, short FAQ | shop, team, blog, clinician / science claims, fake counters |
| Faceshift (closest in product type) | Best funnel logic: result visible in the hero | **before/after slider in the hero**, "problems with other apps" block, upload mock-up in "how it works", comparison table | fake logos ("Logoipsum"), fake stats and reviews, "photos never stored, guaranteed", API code block, the "face swap" category (deepfake association), light/orange theme |

Four ideas to add from Faceshift (not done yet):
1. Before/after slider in the **hero**, above the fold on a phone. Needs real photos.
2. A "Why filters fail" block: plastic skin, you turn into someone else, watermarks, unclear privacy.
3. An upload mock-up inside "How it works" step 1.
4. A "Filters vs facetwin." comparison table.

## 3. State of the Framer landing

Built through the Framer Server API (`framer-api`, key per project, WebSocket to `api.framer.com`).

**Done and checked on screenshots (phone, tablet, desktop):**
- hero, three feature cards, numbers (8 retouches, 4 studio edits, ~10 s), 4 steps, results block, FAQ (5 answers), add-ons text
- pricing: two cards (monthly, quarterly) with the "then ..." price in the text; toggle and "Custom Scale" block removed
- buttons "Upload a selfie" / "Try it free" -> app with UTM; "Email us" -> hello@facetwin.app
- logo inside the "Looks like you" card replaced with `facetwin.`

**Not done (needs the Framer editor or the Framer agent, see section 5):**
- header and footer are still the template's: logo "Sensoria", menu, **"Get template" button with the template author's affiliate link**, "© Sensoria", other people's social links, creator credit, contact form
- stock images: hero portrait, serum / dropper photo, "Our rule" and founder avatars, Before/After slider photos
- the "Made in Framer" badge (removed only by a paid Framer plan)
- the template's extra pages (About, Careers, Journal, Contact, Legal) still exist
- hero: on phone the small line "Natural retouch in seconds" touches the big word FACETWIN.

The scripts are in [`tools/framer/`](../tools/framer/README.md). **After any price change run `set-prices.mjs`** so the cards match `config.js`.

### Update 6 Nov: the Framer project moved on
The owner (or the Framer agent) restructured the project and published it at `facetwin.framer.website`. Findings from reading the **project** (not the published page, which is behind it):
- Home now has new sections (Problem cards, Bento / Benefit cards, "How it works", "CTA"), pages are `/`, `/page`, `/404`.
- Fixed through the API: removed the "Custom Plan" block again, `hello@facetwin.com` -> `hello@facetwin.app`, `mailto:contact@sensoria.com` -> `hello@facetwin.app`, the Phone heading "faceswap apps" -> "Why filters feel fake.", and added the UTM / `fbclid` passthrough script (site custom code, body end).
- **Not fixable through the API (inside master components), must be done in the editor or by the agent:** project name (still "Sensoria Template // Luna UI (copy)"), page title / description / favicon, the CTA block "Download the app" with **App Store and Google Play links (there is no native app)**, footer words (SENSORIA, NEURAL MAPPING, DERMAL ANALYSIS, "Created by Liana Tudakova", Threads / Instagram / LinkedIn of another person, lunaui.co, hello@sensoria.com, "© 2026 Sensoria"), image alt texts "Sensoria Hero" / "Sensoria visual".
- `/page` is a stray page with face swap / API wording ("Multi Face Swap", "Integrate face swap into your app with our simple API"). It is linked from a master component, so it was not hidden. Decide: relink, then delete or set to draft.
- The published site is older than the project. **Nothing was published in this step**; the owner presses Publish after checking.

### What the Server API can and cannot do (so nobody repeats the research)
- Can: read and write text on the page, set controls of component instances (tags, numbers, buttons, links, FAQ items, pricing cards), create / remove / move nodes (`setParent`), publish.
- Cannot: read or change text **inside master components** (header, footer, logo, the FAQ and pricing masters). `getText` says "Node is not a text node", `getNode` returns null.
- Workaround that works: `addDetachedComponentLayers({url: component.insertURL, layout: true})` inserts an editable copy; edit its instances, `setParent` it into place, remove the original.
- Gotcha: that insert also leaves a **stray copy at the root of each breakpoint frame** (Desktop / Tablet / Phone). Remove them after every detach, or sections show twice (this happened with the FAQ).
- Gotcha: a rule like "any value starting with `/` is a link" also matches the price suffix `/month`. Match link keys explicitly.
- `publish()` goes live at the project's `.framer.app` URL; there is no private preview.
- The page header / footer are not reachable from the home page nodes at all, so they must be edited in the editor.

## 4. Open items (owner in brackets)

- [ ] Run the four Framer agent prompts (section 5) in order. (owner)
- [ ] Production app domain, then replace the buttons' link on the landing. (owner gives, Claude replaces)
- [ ] 2-3 real before/after photos with consent, for the hero slider and the results slider. (owner)
- [ ] Add the four Faceshift ideas (section 2). (Claude, after photos)
- [ ] Real Gemini run on `PROMPTS.md` (identity kept, no plastic skin). **Biggest product risk.**
- [ ] Fill `[brackets]` in `privacy.html` and `terms.html` (legal name, address, refund policy). (owner / lawyer)
- [ ] Set `META_PIXEL_ID` and `LEAD_ENDPOINT` in `config.js`; add the Pixel in Framer site settings (custom code). (owner)
- [ ] Paid Framer plan only if the badge and a custom domain are needed. (owner)
- [ ] **Revoke the Framer API key** (it was shared in chat) and any Vercel token. (owner)
- [ ] Before any price change, change it in three places: the Excel model, `config.js` (then `node scripts/stripe-setup.js`), and the Framer cards. Tests only cover the app.

## 5. Prompts for the Framer agent (run in this order)

Replace `[APP_URL]` with the app address and `[APP_URL_BASE]` with the same without `?utm...`.
After each run check that the agent did not add testimonials, numbers or people, and did not touch the Pricing section.

### 5.1 `/rebrand`
```
/rebrand

Brand: facetwin. (lowercase, with the dot).
Product: a web app that retouches a selfie in one tap (acne, under-eye bags, wrinkles, teeth, freckles, glow, studio backgrounds) and still looks like the person.
Audience: women 18-48 in the US and UK who edit every selfie before posting.
This site is the landing page of an ad funnel: ad -> this page -> the app. The one goal of the page is to get a tap on "Upload a selfie".

Voice: calm, direct, premium. Short sentences, plain words. Never use "neural", "dermal", "biometric", "clinically proven", "science-backed", "AI magic" or any medical claim.

Design: keep the dark layout and the section structure. Accent color: replace the pink with purple #7C4DFF. Headings Instrument Serif, body Inter. Set these in Assets (styles), not on single layers.

Logo: replace "Sensoria" everywhere (header, footer, cards) with the text wordmark "facetwin." in the heading font. No image logo.

Links:
- Every primary button: label "Upload a selfie" (hero, header) or "Try it free" (below), link [APP_URL].
- Email hello@facetwin.app. Privacy Policy [APP_URL_BASE]/privacy.html. Terms [APP_URL_BASE]/terms.html.
- Remove every link to the template author, "Get template", Luna UI, and any person's Threads / Instagram / LinkedIn.

DO NOT CHANGE: the prices and plan text in the Pricing section, the numbers 8 / 4 / 10s, and the FAQ answers. Keep them exactly as written.

DO NOT INVENT: testimonials, customer names, reviews, star ratings, user counts, press logos, awards, team members, before/after claims in percent. If a block needs one, delete the block.

When done, list every place where you changed a link or removed something.
```

### 5.2 Header, footer, pages, images
```
Finish cleaning the site for facetwin.

Header: logo "facetwin.", menu items "Home", "How it works", "Pricing", "FAQ", "Privacy". Menu items scroll to the sections on this page (Home -> top). The header button says "Upload a selfie" and links to [APP_URL]. Delete the "Get template" button.

Footer: one line "© 2026 facetwin. All rights reserved." plus links Privacy Policy, Terms, and the email hello@facetwin.app. Delete: the creator credit, all social links, the "Start scanning your skin today" form and every form field in the footer, and the marquee of skincare words.

Pages: delete About, Careers, Journal, Contact and the template Legal pages, and remove every link to them. Keep only the home page and a 404 page.

Hero: on Phone and Tablet the small line "Natural retouch in seconds" overlaps the big word "FACETWIN.". Fix the spacing so nothing overlaps at 390, 768 and 1360 px.

Images: replace the stock photos that show serums, droppers or product shots with neutral dark gradient placeholders. Leave the hero image and the Before / After slider as they are, I will upload my own photos. Do not generate or insert AI portraits of people.

Do not touch the Pricing section.
```

### 5.3 Mobile conversion, SEO, accessibility
```
Optimize the page for people arriving from Instagram and TikTok on a phone.

Mobile first: on a 390 px screen the hero shows the headline, one line of text and one big button "Upload a selfie" without scrolling. Add a sticky bottom button "Upload a selfie" on Phone and Tablet that appears after the hero and links to [APP_URL]. It must not cover text or the FAQ.

Order of sections: Hero, What it fixes, How it works, Before / After, Pricing, FAQ. Keep the "[Numbers]" block after "What it fixes".

SEO: page title "facetwin. - Fix your selfie in one tap". Meta description (max 155 chars): "Natural selfie retouch that still looks like you. Acne, under-eye bags, wrinkles, teeth and studio backgrounds in about 10 seconds. 2 free edits." Add Open Graph title and description with the same text. Set the favicon to the text "f." on #7C4DFF.

Accessibility and speed: every image gets meaningful alt text; body text at least 16 px on Phone; buttons at least 44 px high; contrast AA on the dark background; no autoplaying sound; no heavy animation above the fold.

Do not add cookie banners, popups, chat widgets or tracking scripts. I will add the Meta Pixel myself.
```

### 5.4 `/launch-check`
```
/launch-check

Check the whole site before I publish. Report as a table (problem, where, severity). Look for:
1. Leftover words: "Sensoria", "Luna UI", "template", "neural", "dermal", "Framer promo".
2. Any link that is empty, broken, goes to a template author, or is not [APP_URL], mailto:hello@facetwin.app, or the two legal URLs.
3. Missing title, description, Open Graph, alt text.
4. Overflow, overlap or text under 16 px on Phone (390), Tablet (768) and Desktop (1360).
5. Any number, quote, name or claim that I did not write (anything about percent, "users", "reviews").
Then let me pick what to fix. Do not publish.
```

## 6. Plan: what to do next, in order

Priorities: **P0** = before the demo and before anyone outside sees the landing. **P1** = before paid ads. **P2** = after launch.
"Done when" is the check that tells you the step is really finished. Nothing here changes the product (section 0).

### P0: make the demo real

| # | Step | Owner | Done when |
|---|---|---|---|
| 1 | In Vercel (Production and Preview) set `GEMINI_API_KEY` and `STRIPE_SECRET_KEY` (test key). Run `STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.js <site url>` and paste the printed `STRIPE_PRICE_*`, `STRIPE_COUPON_*`, `STRIPE_PORTAL_CONFIG`. Redeploy. In the Stripe Dashboard turn on "emails about upcoming renewals" (the paywall promises a 3-day reminder). | owner | `<app>/api/status` shows `"ai": true, "payments": true, "upsells": true` |
| 2 | Run the prompts of `PROMPTS.md` in Google AI Studio on 5-10 real photos (with consent), then in the app. Score each: looks real, still clearly her, teeth / freckles edits are not no-ops, no plastic skin. | owner, Claude reads results | At least 6 of 8 Glow edits score 4+ of 5 on realism and "still me". If not, fix the prompts or the model (`GEMINI_IMAGE_MODEL`) before anything else |
| 3 | Keep 2-3 of the best before/after pairs (with consent) for the landing. | owner | Pairs exist as files; Claude puts them in the hero slider and the results slider |
| 4 | Real Stripe test payment, end to end: selfie -> edit -> paywall -> card `4242 4242 4242 4242` -> Looks offer -> decline -> second-chance price -> Coach. Also try Settings -> Manage subscription. | owner, Claude can re-check | Every screen works on a phone; the right amounts appear in Stripe |
| 5 | Run the Framer agent prompts 5.1 to 5.4. | owner | `/launch-check` returns no leftover "Sensoria" / "template" and no author or stranger links |
| 6 | Give Claude the production app domain; Claude replaces the link on every landing button, in `PUBLIC_URL`, and in `SHARE_URL`. | owner, Claude | Landing buttons, Stripe return URL and share card all point to the production domain |
| 7 | Fill the `[brackets]` in `privacy.html` and `terms.html`. | owner / lawyer | No `[` left in both files |
| 8 | **Revoke the Framer API key** and any Vercel token. | owner | Keys removed in Framer settings and Vercel |

### P1: before paid ads

| # | Step | Owner | Done when |
|---|---|---|---|
| 9 | Meta Pixel: set `META_PIXEL_ID` in `config.js` and add the Pixel in Framer site settings (custom code). Set `LEAD_ENDPOINT`. | owner | Events Manager shows `PageView`, `PhotoUploaded`, `PreviewGenerated`, `InitiateCheckout`, `Purchase` from a test run |
| 10 | The four Faceshift ideas on the landing (section 2): hero before/after slider, "Why filters fail", upload mock-up in "How it works", "Filters vs facetwin." table. Add Looks / Coach as two small cards using the existing Pricing Card. | Claude | Phone screenshots show the slider above the fold and nothing overlaps |
| 11 | Real-device test: iPhone Safari and Android Chrome for upload, camera permission, the compare slider, the paywall, and (Looks) the 3D twin (first load downloads ~95 MB; check on mobile data). | owner | No blocker on either phone; 3D twin opens or is clearly marked as optional |
| 12 | Fix the pitch deck claims: replace "photos never leave her phone" with the real consent wording; "360°" to "180°, face"; drop the crossed-out $59.99 / $49.99; one value for the first quarter ($22.49 or $22.50); make the two "net" definitions (89% and 81.2%) say what each is. | owner | Deck and `docs/PRODUCT.md` say the same thing as the app |
| 13 | Real access control: Stripe webhooks plus a small backend so entitlements are not only in the browser (`S.paid`, `S.owned`). Hard rate limit (Upstash or Vercel KV) and a Google spend cap. | Claude | A user who edits local storage cannot unlock HD or Looks; spend cannot exceed the cap |
| 14 | Delete unused Framer pages and decide on a paid Framer plan (removes the badge, allows a custom domain). | owner | Only the landing and a 404 exist; custom domain set if wanted |

### P2: after launch

- Replace placeholders with real social proof only when it exists (real quotes with permission, real counts). Never before.
- Weekly paywall and funnel tests, as in the deck: one change at a time on CTR, selfie upload rate, paywall-to-purchase.
- Stripe live mode: US LLC, Vercel Pro, live keys, then re-run `scripts/stripe-setup.js --live`.
- Roadmap from the deck: Coach with the live camera (M4), video retouch (M7), UK / CA / AU (M10).
- Re-measure edit time on real Gemini and update "about 10 seconds" if it differs.

## 7. Demo-day order and fallback

1. Open the landing on a phone (not a desktop window): hero, scroll once, tap **Upload a selfie**.
2. Upload a real selfie (not the demo face), tap **Show me**, accept the consent, show before/after.
3. Try one Studio edit (white background) to show a second type of edit.
4. Tap **Download in HD** -> paywall -> pay with the test card -> show the Looks offer -> decline -> show the second-chance price.
5. Show Settings -> Manage subscription (cancel in two taps).
6. Fallback: a recorded Loom of steps 1-5 (put the link on the demo slide next to the live link). Do the live path once in an incognito window the day before.

## 8. Risks, ranked

1. **Gemini quality is unverified.** Everything else is built on it. Step 2 decides whether the product works.
2. **Landing is public with template leftovers.** Do not share the link before step 5.
3. **Prices live in three places** (Excel, `config.js`, Framer). Drift is silent. Change all three together.
4. **Entitlements live in the browser** until step 13. Fine for a demo, not for ads.
5. **Framer badge and shared key.** The badge needs a paid plan; the key must be revoked.
6. **Claims.** The deck still has two claims the app contradicts (step 12).

## 9. Security notes
- A Framer API key was pasted into a chat. Treat it as exposed: revoke it in the Framer project settings (API Keys) when the work is done. Never commit keys; this repo has none (checked).
- The session network allow-list was extended with Framer hosts for reading references; it lives in the author's Claude environment, not in this repo.
