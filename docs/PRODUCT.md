# FaceTwin: product case (short)

> **V2 update (5 Nov 2026).** The product is now **Glow**: natural selfie retouch in one tap (8 retouches + 4 Studio background edits), sold on the web with Stripe. The text below is the V1 case and is kept for history. What changed:
>
> - **Offer (pitch deck and Excel v5):** Glow monthly $9.99 first month then $19.99, Glow quarterly $22.49 first quarter then $44.99, no weekly or annual plan. Two one-time add-ons right after checkout: **Looks** (3D twin and hair/brow/beard looks) $29.99, **Coach** (12-week plan, camera coach, re-scan) $24.99; one second chance at $23.99 / $19.99 if she says no.
> - **Model (deck, base case):** paid CAC $40, net LTV (12 months) $52.33, ROI on paid CAC +31%, LTV/CAC 1.31 paid and 1.54 blended; Year 1 gross $1.61M. Source of truth: `FaceTwin_Unit_Economics` (Excel v5), not the V1 numbers in this file.
> - **Validation plan:** step 1 is now the Glow prompts in `PROMPTS.md` (regenerated from `previews.js`); step 2 (concierge) and step 3 (Meta test) should sell Glow, not the V1 "5 looks + report" bundle.
> - **Claims to keep honest in ads and deck:** the face scan runs on the phone, but an edit sends the photo to Google's Gemini (with consent); the twin from 3 selfies is 180° and face-only, not 360°.

## Who and what problem

- **For:** women 28–45 in the US/UK who spend on skincare and beauty but feel unsure what suits their face.
- **Problem:** changing your look (a cut, a color, brows, glasses) is a gamble you live with for months, and skincare is guesswork across endless products.
- **Positioning:** for women tired of guessing what suits their face, FaceTwin shows changes on her own face first and gives her a plan that fits, instead of a stylist, endless products and expensive mistakes.

## Jobs to be done

| Job | When… I want… so I can… | Feature |
|---|---|---|
| 1. Try before I change | When I'm thinking about a new haircut, brows, glasses or makeup, I want to see it on my own face first, so I don't make a mistake I'll live with for months. | **See it on your face** (realistic AI preview) |
| 2. A routine that fits me | When I don't know what my skin needs, I want a simple routine made for my face, so I stop wasting money and see results. | **Face report + plan** (with product picks) |
| 3. See that it's working | When I've followed a routine for weeks, I want proof my face is improving, so I stay motivated. | **Proof it works** (weekly re-scan, before/after) |

## The 3 core features (MVP scope)

1. **See it on your face:** one photo + one instruction to an AI image editor (Gemini), identity-preserving prompts in `previews.js`. 1 free preview, then the paywall. About $0.04 per preview.
2. **Face report + plan:** 478 face points on-device (MediaPipe): face shape, facial thirds, eye spacing, symmetry, a skin guide; advice on frames, hair and brows; a rules-based routine (`plans.js`) with product picks in 3 price levels (`shelf.js`).
3. **Proof it works:** the weekly re-scan uses the same analysis, plus a before/after slider and score trend; the plan adjusts week by week.

Parked (still in the code as extras): drawn try-on overlays, 3D face mask, share card, streak extras.

## Business model (from the Zimran IT School homework)

- **Plans (web checkout):** 1-week trial $6.93 → $39.99 / 4 weeks; 4-week plan $19.99 intro → $39.99; 12-week plan $39.99 → $79.99.
- **Average case (12 months):** net LTV about $89 per paying user; paid CAC about $51 (Meta); ROI about +77%, under the 100% target. Levers: CAC ≤ $45, ~30% organic, fewer cancels before the first renewal.
- **Money Map (US, Stripe):** 2,435 payers/month in forecast month 12; Gross $91,020; cost of revenue 9.8%; Net Revenue $82,100/month.

## Competitor

**QOVES**: 6 photos → facial analysis, protocol and realistic before/after visualizations, human-reviewed, up to 28 days, annual membership, 80,000+ members. FaceTwin's angle: instant (seconds, not weeks), focused on women 28–45, previews of everyday changes plus a routine she follows weekly.

## Validation plan

1. **Free:** run `PROMPTS.md` in Google AI Studio on your own and friends' photos (with consent) and score realism.
2. **Paid concierge test:** 10–15 women, 1 free preview, then $19 for 5 looks + report + plan. 3 or more payers means build it.
3. **Meta test:** $150–300, women 28–45 US/UK, optimize for Lead; read cost per Lead and InitiateCheckout against the $51 CAC.

Face care and style guidance, not medical advice.
