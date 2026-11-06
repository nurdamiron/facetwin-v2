# FaceTwin landing: full spec

Companion to `docs/LANDING.md` (state, decisions, prompts, plan). This file says **what the finished landing is**, section by section.
It describes the same product as `docs/PRODUCT.md` and the facts in `config.js`. It must never promise more than the app does.

## 1. The one job of the page

Get a tap on **Upload a selfie**. Nothing else on the page competes with it.

Funnel numbers in the pitch deck (base case): link click -> landing loaded 85%; landing loaded -> selfie uploaded 50%; paywall seen -> purchase 8%. With a separate landing the "landing -> selfie uploaded" step becomes two steps. Measure both and aim for the same product of the two:

| Step | Target |
|---|---|
| Landing loaded -> tap on Upload a selfie (opens the app) | at least 62% |
| App opened -> selfie uploaded | at least 80% |
| Together = landing -> selfie uploaded | at least 50% (the deck's number) |

If the first number is low, fix the page. If the second is low, fix the app's first screen (see section 8, `?from=lp`).

## 2. Who lands here and what they need to believe

Visitor: a woman 18-48 in the US or UK, on a phone, coming from an Instagram or TikTok video. She edits every selfie. She has used filters and dislikes the plastic look.

In 5 seconds she must understand: **what it does** (fixes my selfie), **that it will still look like me**, **that it is quick and free to try**. In 30 seconds: how it works, what it costs, what happens to my photo.

Message match: the page repeats the promise of the ad. Ads about acne, eye bags, wrinkles, teeth, freckles or backgrounds should land on the same page; later each can get its own variant (section 8).

## 3. Rules for every block

1. Phone first. Design at 390 px, then widen.
2. One primary action: **Upload a selfie** (hero, header, sticky bar, final band). Secondary: nothing else. No nav to other pages.
3. Show the result, do not describe it. Real before/after, our own photos, with consent.
4. Short sentences. Plain words. English, US spelling.
5. No invented proof: no fake users, reviews, ratings, counts, logos, awards, percent claims, people.
6. No medical or "AI magic" claims. No "neural", "dermal", "clinically proven", "science-backed".
7. Honest money: price, renewal and the add-ons are visible before she taps anything that costs money. No crossed-out price that was never charged.
8. Honest privacy: the photo goes to Google's Gemini only when she taps Show me and agrees; we do not keep it on our servers; her photos stay in her browser.
9. Our own photos only. No stock portraits that imply a result we did not make.
10. Everything that is a number on the page exists in `config.js` or was measured.

## 4. The page, section by section (final order)

Legend: **Keep** = already built in Framer. **Change** = built, needs edits. **Add** = new. **Delete** = remove.

| # | Section | Job | Copy | Visual | Framer |
|---|---|---|---|---|---|
| 0 | Header | brand + one button | logo `facetwin.`; button **Upload a selfie**; no menu (or 3 anchors max: How it works, Pricing, FAQ) | text wordmark, sticky | Change (masters: edit in the editor or with the agent) |
| 1 | Hero | promise + proof + action | H1 **Fix your selfie in one tap.** Sub: *Natural retouch that still looks like you. Real skin texture, no filter look.* Button **Upload a selfie**. Under it: *No sign-up · 2 free edits · About 10 seconds.* Small: *Use your own photo, or one you have permission to edit.* | **real before/after slider**, above the fold on a phone | Change: move the slider into the hero, replace the stock portrait |
| 2 | What it fixes | show the 8 retouches | H2 **One tap. Eight natural fixes.** Cards: Acne & spots, Under-eye bags, Wrinkles, Teeth whitening, Freckles on / off, Glow, One-tap natural. Each: one line + a tiny before/after | 6 small pairs or a tabbed slider | Change (cards exist, images are stock) |
| 3 | Why filters fail | name the pain | H2 **Why filters feel fake.** Four cards: *Plastic skin.* Pores and freckles vanish. / *Not you anymore.* Face shape gets changed. / *Watermarks.* The good part costs extra. / *Unclear privacy.* You never learn where your photo goes. Closing line: **facetwin. fixes the skin, keeps the face.** | icons, no photos | Add |
| 4 | How it works | remove fear of effort | H2 **Simple steps. Natural results.** 1 **Upload a selfie** One clear front-facing photo. No sign-up. 2 **Pick a retouch** Acne, bags, wrinkles, teeth, freckles, glow or a studio background. 3 **Compare** Drag the slider. Edit again or try another. 4 **Download in HD** Glow plan: unlimited edits, no watermark. | step 1 shows a mock of the upload box; step 3 shows the slider | Keep text; Add the upload mock |
| 5 | Results | proof | H2 **See it in seconds.** 3 real pairs (acne, under-eye, studio background) with a one-line label each: *Edited with facetwin. in about 10 seconds. Same person, same skin texture.* | BeforeAfter slider x3 | Change (slider exists, needs real photos) |
| 6 | Studio | second use | H2 **Clean background, same you.** White, grey studio, blur, passport / CV style. Your face stays untouched. | one pair | Change (the "Studio backgrounds" card) |
| 7 | Filters vs facetwin. | compare | Table, 5 rows: Skin texture (*Smoothed away* vs *Kept*), Your face (*Often reshaped* vs *Unchanged*), Speed (*Editing skills* vs *One tap*), Watermark (*Common on free* vs *None when you pay*), Price clarity (*Hidden renewals* vs *Renewal shown before you pay*) | table, 2 columns | Add |
| 8 | Pricing | clear, calm | H2 **Simple pricing. Cancel anytime.** First line: *2 free edits, no card needed.* Two cards: **Glow monthly** $9.99 first month, then $19.99 a month. **Glow quarterly** $22.49 first quarter, then $44.99 every 3 months ($15.00 a month). Below: *After checkout you can add Looks ($29.99 once) and Coach ($24.99 once). One-time payments, no renewal.* Footer line: *Prices in USD. Renews automatically until you cancel.* Buttons: **Try it free** | 2 pricing cards + 2 small add-on cards | Keep cards; Add free line, renewal line, add-on cards |
| 9 | Privacy | trust | H2 **Your photo, your call.** *We send your photo to Google's Gemini AI only when you tap Show me, and only with your OK. We don't keep it on our servers. Your photos stay in your browser and you can delete them anytime.* Links: Privacy Policy, Terms | lock icon | Add (text is in the FAQ today) |
| 10 | FAQ | last doubts | 6 Q&A: Will it look fake? Is my photo stored? How much does it cost? How do I cancel? Which photos work best? Can I edit someone else's photo? (*Only with their permission.*) | accordion | Keep 5, Add 1 |
| 11 | Final band | one more chance | H2 **Your best selfie, in one tap.** Button **Upload a selfie**. Small: *2 free edits. About 10 seconds.* | dark gradient | Change (the "Concept" band) |
| 12 | Footer | legal | `© 2026 facetwin.` · Privacy · Terms · hello@facetwin.app. Nothing else. | none | Change (master: editor / agent) |
| S | Sticky bar (phone) | keep the action in reach | **Upload a selfie**, appears after the hero, never covers text | bottom bar | Add |

**Delete** from the template: the "Looks and Coach" chart card (the "Example" progress chart is made-up data), the "Intelligence" numbers block unless folded into the hero line, the founder block ("FaceTwin / Add-ons are optional" with a stock avatar), the "Our rule" avatar, the "Custom Scale / hello@sensoria.com" block (already gone), all template pages.

## 5. Copy bank for hero tests (one change at a time)

| Variant | H1 | Use when the ad says |
|---|---|---|
| A (default) | Fix your selfie in one tap. | general retouch |
| B | Retouch that still looks like you. | "no filter look" |
| C | Your selfie, on a good day. | emotional / UGC |
| D | Clear skin in your selfie. Keep your face. | acne / eye bags |

Sub-line stays: *Natural retouch that still looks like you. Real skin texture, no filter look.*
Never test a variant that needs a claim we cannot back (percent, "doctor", "guaranteed").

## 6. Assets to collect (blockers for sections 1, 2, 5, 6)

| Asset | Spec |
|---|---|
| Real before/after pairs | at least 4 different people, 3 different edits + 1 background. Same crop, same light in before and after. Portrait 4:5, long side at least 1600 px, JPEG or WebP |
| Consent | written OK from each person to show their face on the site and in ads; keep the files |
| Edit proof | each "after" is a real output of the app (not retouched by hand); keep the originals and the edit id |
| Hero | one pair, optimized to under 150 KB per image (WebP), loaded first |
| Logo | text wordmark `facetwin.` only |
| Icons | one set, outline |

Until the pairs exist, section 1 and 5 show the slider with neutral dark placeholders, not stock models.

## 7. Phone details (390 px)

- Hero shows H1, sub-line, button and the first part of the slider without scrolling.
- Buttons at least 44 px high; body text at least 16 px; contrast AA on the dark background.
- No autoplay video or sound; no heavy animation above the fold.
- Targets: LCP under 2.5 s, CLS under 0.1, INP under 200 ms (check in PageSpeed after publishing).
- Fonts: Bricolage Grotesque for headings, Manrope for body, self-hosted or preloaded.
- Do not add cookie banners, popups or chat widgets.

## 8. Connection to the app and tracking

**Buttons -> app.** Every primary button goes to the app with `?utm_source=framer&utm_medium=landing`.

**Pass the ad's UTM and `fbclid` through.** Add in Framer (site settings, custom code, end of body), replacing `APP_DOMAIN`:

```html
<script>
document.addEventListener("click", function (e) {
  var a = e.target.closest("a[href^='https://APP_DOMAIN']"); if (!a) return;
  var u = new URL(a.href);
  new URLSearchParams(location.search).forEach(function (v, k) { if (!u.searchParams.has(k)) u.searchParams.set(k, v); });
  u.searchParams.set("from", "lp");
  a.href = u.toString();
}, true);
</script>
```

**Pixel on both sides.** Same `META_PIXEL_ID` on the landing (Framer custom code) and in the app (`config.js`). Landing events: `PageView`, `LPCtaClick` (custom, with `pos`: header, hero, steps, pricing, final, sticky), `LPScroll50`. App events already exist (`PhotoUploaded`, `PreviewGenerated`, `InitiateCheckout`, `Purchase`, `AddOnPurchased`).

**Small app change, not built yet (P1):** when the URL has `from=lp`, the app's first screen shows only the upload button and the demo-face link (no second hero), so the second step is as short as possible. Optionally `e=<edit id>` (for example `e=clearskin`) preselects the retouch the ad promised.

## 9. Compliance checklist (before any ad)

- [ ] Price, renewal and the add-ons visible before any payment step; "Renews automatically until you cancel" present
- [ ] No crossed-out prices; no fake counts, reviews or logos
- [ ] Privacy wording matches the app's consent text exactly
- [ ] "Only edit your own photo or one you have permission to edit" near the first button and in the FAQ
- [ ] Privacy Policy and Terms linked in the footer and filled in (no `[brackets]`)
- [ ] No medical claims; "face care and photo editing, not medical advice" in the footer line of the paywall (app) and Terms
- [ ] Every person shown has given written consent

## 10. Acceptance criteria (the landing is done when)

1. `/launch-check` (prompt 5.4 in `LANDING.md`) returns nothing about "Sensoria", "Luna UI", "template", "neural", or any unknown link.
2. On 390, 768 and 1360 px nothing overlaps and nothing scrolls sideways.
3. A before/after slider with a real pair is visible in the hero without scrolling on a 390 px phone.
4. Every button opens the app at the production domain with the UTM and `from=lp`.
5. Every number on the page matches `config.js` or a measured value.
6. Title, description, Open Graph and alt texts are ours; the page title is not "Sensoria".
7. The Pixel shows `PageView` and `LPCtaClick` in Events Manager from a test visit.
8. A person who has never seen the product can say, after 5 seconds, what it does.

## 11. Open decisions

1. **Build here or in the app?** Plan: Framer for this page (speed, design), the app stays the editor. Switch only if the first funnel step loses too many people.
2. **Light or dark?** Plan: dark with the purple accent, to match the app.
3. **Which hero variant first?** Plan: A, then test B and D against it.
4. **Navigation?** Plan: none, or three anchors.
5. **Who is in the photos?** Needs consent and a diverse set (skin tones, ages 20-45).
