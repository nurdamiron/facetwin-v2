# FaceTwin: product case (short)

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
