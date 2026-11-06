# FaceTwin funnel: product and performance-marketing view

Written 6 Nov 2026. No real traffic yet, so every number below is arithmetic or a target to test, not a benchmark. Prices and claims follow `docs/HANDOFF.md` section 9.

## 1. The funnel and what each step measures

| # | Step | Screen | Event (Meta) | Healthy signal to look for |
|---|---|---|---|---|
| 0 | Ad click | Framer landing | PageView (pixel must be on Framer too) | CTR, CPC |
| 1 | Landing -> app | `#/` | PageView, `FunnelStart` fires on the photo | landing -> upload rate |
| 2 | Photo accepted | `#/preview` | `PhotoUploaded`, `NoFace` (failure) | share of uploads with a face |
| 3 | First result seen | before/after | `PreviewGenerated`, **`ViewContent`** (once, new) | upload -> result rate; this is the event to optimise ads on |
| 4 | Wants the HD file | Download in HD | **`HDTapped`** (new) | result -> HD tap rate = intent |
| 5 | Sees the price | `#/paywall` | `PaywallView` (once), **`PaywallShown`** (every view, with plan, new) | HD tap -> paywall |
| 6 | Starts paying | Stripe | `InitiateCheckout` (value, currency) | paywall -> checkout rate |
| 7 | Paid | `#/welcome` | `Purchase` (value, eventID = session) | checkout -> paid |
| 8 | Add-ons | `#/up/looks`, `#/up/coach` | `UpsellShown`, `AddOnPurchased` | add-on take rate, second-chance rate |

Known gaps: no server-side (CAPI) Purchase yet, so ad-blockers lose events (README, "Known limits"); the `Screen` custom event fires on every route and is noise for ad optimisation; the Framer landing has no pixel or UTM hand-off verified.

## 2. What it takes to be profitable (arithmetic only)

`CAC = CPC / click-to-purchase rate`. Target CAC from `docs/PRODUCT.md` is at most $45.

| CPC | Click -> purchase needed for CAC $45 |
|---|---|
| $0.80 | 1.8% |
| $1.20 | 2.7% |
| $1.60 | 3.6% |

Chained example (assumptions to test, not benchmarks): landing -> upload 35%, upload -> result 85%, result -> HD tap 50%, HD tap -> checkout 15%, checkout -> paid 60% gives 35% x 85% x 50% x 15% x 60% = 1.3%. Each step's target is set after the first 200 clicks.

## 3. What was changed on this basis

| Hypothesis | Change | Status |
|---|---|---|
| The extra sheet "Download in HD with Glow -> See plans" loses people at peak intent | Locked Download goes straight to the paywall | shipped |
| The paywall hid her own result (a 170 px crop of the eyes) and the price sat below the fold | Before/after side by side on top; plans first; renewal line, checkbox and the pay button with the price are one sticky block, all visible on a 390 x 844 screen | shipped |
| The result screen had five buttons, two of them "Download" | One primary button under the before/after, the rest are chips | shipped |
| Privacy fear is the main brake on uploading a face | Under the upload button: "2 free edits, no sign-up, photo stays in this browser until you tap Show me" (true: the photo leaves only after consent) | shipped |
| Ads cannot be optimised without a result-level event | `ViewContent` (first result), `HDTapped`, `PaywallShown` | shipped |

## 4. Next, in order of expected impact

1. **Before/after in the hero** (app landing): shipped with five owner-supplied pairs in `assets/examples/` (skin, under-eyes, smile, freckles, glow), labelled "Example results" and not as customers. **Open question for the owner:** the files look like generated portraits (same grey backdrop, same black T-shirt, 1024x1536 PNG). If they are generated, keep the label "Example results" and never call them customers or real users; if they are real people, keep the written consent on file. Still blocked: a real Gemini run on real selfies, so the examples show what the product really does.
2. **Real Gemini run.** If the result is not visibly better but still the same person, none of the funnel matters.
3. **Consent step.** The AI consent modal appears right after "Show me" with an unticked box. Option: an inline consent line next to the button instead of a modal. Legal wording must be confirmed first, so it was not changed.
4. **Default plan test.** Quarterly is pre-selected ("Best value"). Test monthly vs quarterly as the default once there is traffic (about 100 paywall views per variant before reading anything).
5. **Add-on order and price.** Looks ($29.99) costs more than the Glow plan itself ($22.49 for the first quarter). Test Coach first, and read the take rate before changing any price (prices must stay equal in Excel, `config.js` and Framer).
6. **Server-side Purchase (CAPI) and a Stripe webhook**, so measurement and access do not depend on the browser.

## 5. Rules for tests

One change at a time, one primary metric (paywall -> checkout), same audience and budget, at least 100 events per variant before a decision. Never show a price that is not charged and never use a claim from HANDOFF section 9.
