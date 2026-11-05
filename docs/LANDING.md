# FaceTwin landing and funnel: what we decided and what is left

Status as of 5 Nov 2026. This file is the memory of the landing work so nobody has to rediscover it.
It describes the **same product** as `docs/PRODUCT.md`, it does not change it.

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
| Landing (Framer, free `.framer.app` URL) | https://shiny-culture-616454.framer.app/ |
| App (Vercel branch preview, used by the landing buttons) | https://facetwin-git-claude-trustin-15191a-nurdaulet-akhmatovs-projects.vercel.app/?utm_source=framer&utm_medium=landing |
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

### What the Server API can and cannot do (so nobody repeats the research)
- Can: read and write text on the page, set controls of component instances (tags, numbers, buttons, links, FAQ items, pricing cards), create / remove / move nodes (`setParent`), publish.
- Cannot: read or change text **inside master components** (header, footer, logo, the FAQ and pricing masters). `getText` says "Node is not a text node", `getNode` returns null.
- Workaround that works: `addDetachedComponentLayers({url: component.insertURL, layout: true})` inserts an editable copy; edit its instances, `setParent` it into place, remove the original.
- Gotcha: that insert also leaves a **stray copy at the root of each breakpoint frame** (Desktop / Tablet / Phone). Remove them after every detach, or sections show twice (this happened with the FAQ).
- Gotcha: a rule like "any value starting with `/` is a link" also matches the price suffix `/month`. Match link keys explicitly.
- `publish()` goes live at the project's `.framer.app` URL; there is no private preview.
- The page header / footer are not reachable from the home page nodes at all, so they must be edited in the editor.

## 4. Open items (owner in brackets)

- [ ] Run the three Framer agent prompts (section 5) in order. (owner)
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

Design: keep the dark layout and the section structure. Accent color: replace the pink with purple #7C4DFF. Headings Bricolage Grotesque, body Manrope. Set these in Assets (styles), not on single layers.

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

## 6. Security notes
- A Framer API key was pasted into a chat. Treat it as exposed: revoke it in the Framer project settings (API Keys) when the work is done. Never commit keys; this repo has none (checked).
- The session network allow-list was extended with Framer hosts for reading references; it lives in the author's Claude environment, not in this repo.
