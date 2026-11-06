# Landing design review (6 Nov 2026)

Based on the owner's screenshots of the live site and on the project read through the Server API. Text is already fixed on all three breakpoints (`tools/framer/improve.mjs`, `faq3.mjs`). This file lists the **design** problems, what was done, and the prompt for the Framer agent for what the API cannot touch (anything inside a master component: cards, footer, step cards, header).

## 1. Problems seen

| # | Where | Problem | Fix | Who |
|---|---|---|---|---|
| 1 | Feature cards (3 in a row) | Different heights; the phone mock in the middle card runs past the card's bottom border; the left card's photo strip is cropped into slivers; stock close-ups are not our results; "Soft glow" repeats "One-tap retouch" | equal height, mock fully inside, one clean crop, our own before/after in card 1, card 3 becomes the add-ons card (Looks / Coach) | agent |
| 2 | Same cards | The wordmark "facetwin." inside the phone mock is the template's **serif** font and a stock avatar sits next to it | sans (Instrument Serif), no avatar | agent |
| 3 | Numbers strip | "10s" renders larger than "8" and "4", labels wrap to two lines, a lonely "+" and a paragraph float on the right; the numbers did not decide anything | three numbers that decide whether she taps: **10s** typical edit, **2** free edits, **12** edits to choose from; short labels; same size and baseline; paragraph under the strip, no "+" | texts and numbers done (API); sizes: agent |
| 4 | Steps cards ("Step 2" ...) | Title and text sit in a **darker rectangle** inside the grey card (the text frames have their own fill) | no fill on those frames, same color as the card | agent |
| 5 | FAQ | Template questions ("neural scan", "98% precision"); oversized all-caps heading with the `[FAQ]` tag far left; big empty gap | questions replaced (done); heading smaller, tag directly above it | texts done; sizes: agent |
| 6 | Footer | **Pink marquee strip** (template accent, not our purple) with NEURAL MAPPING / DERMAL ANALYSIS; serif "Sensoria"; "Sensoria combines advanced neural mapping"; `hello@sensoria.com`; newsletter field with **no backend**; links to About / Careers / Journal / Threads / Instagram / LinkedIn that are not ours; right column overflows the viewport edge; blurred stock portrait behind | one compact footer, see 3.2 | agent |
| 7 | Whole page | Two accent colors (pink + purple), two wordmark fonts (serif + sans), three heading styles (huge caps, sentence case, small) | one accent `#7C4DFF`, one wordmark, one type scale (section 2) | agent |
| 8 | Hero to first section | Hard cut from the full-bleed photo to flat black | gradient fade into `#0E0E14` over the last 160 px | agent |

## 2. Design system to enforce

- Colors: background `#0E0E14`, card `#16161F`, line `rgba(255,255,255,.08)`, text `#F5F3F7`, muted `#A8A3B3`, accent `#7C4DFF` (hover `#8F69FF`). No pink anywhere.
- Type: headings Instrument Serif 400 (accent words in italic), buttons and prices Inter Display 600-700, body Inter 500. Section heading: sentence case, 48 px desktop / 40 tablet / 32 phone, line height 1.05. Card title 20 px, body 16 px (never below 16 on phone). The big all-caps look stays only for the hero word.
- Spacing: section padding 120 / 96 / 72 px (desktop / tablet / phone); gap between cards 24 / 20 / 16; one container width (1200).
- Cards: radius 24, 1 px line, no inner colored boxes.
- Buttons: primary = accent fill, white text, 52 px high (44 minimum); secondary = outline. One primary button per screen.

## 3. Where the important numbers go

1. **Hero chips** under the main button: `2 free edits` · `About 10 seconds` · `No sign-up`. These three decide the first tap.
2. **Numbers strip** right under the hero (move it up from after the cards): 10s / 2 / 12.
3. **Pricing**: `$9.99` and `$22.49` big, `then $19.99` / `then $44.99` in the same card, in readable size (not a footnote).
4. **Final band**: `2 free edits. About 10 seconds.` repeated under the last button.
Do not add numbers we cannot back (users, ratings, percent).

### 3.2 Footer (target)
Left: `facetwin.` wordmark (sans) and one line `Natural selfie retouch.` Middle: `Privacy` · `Terms`. Right: `hello@facetwin.app`. Below, one line `© 2026 facetwin. Face care and photo editing, not medical advice.` No marquee, no newsletter, no social links, no background photo (flat `#0E0E14` with a 1 px top line).

## 4. Transitions and motion

- Between sections: no empty black gaps; use the section padding above and a 1 px line only between unrelated blocks.
- Scroll reveal: fade up 16 px, 450 ms ease-out, once, stagger 60 ms between cards. Off for `prefers-reduced-motion`. Nothing animates above the fold except the before/after handle.
- Header: transparent on top; after 80 px a blurred dark background and a 1 px line. Anchor links scroll with an offset equal to the header height.
- Mobile: sticky bottom button `Upload a selfie`, shown after the hero, hidden near the footer.
- Hover (desktop): primary button lifts 2 px and gets a soft purple glow; cards raise their line to `rgba(255,255,255,.16)`.
- Before/after slider: the handle nudges once (10 px left-right) when it enters the viewport so people see it is draggable.
- Counters in the numbers strip count up once when visible; final values must equal the real ones (10 / 2 / 12).

## 5. Prompt for the Framer agent (design pass; run after the four prompts in LANDING.md)

```
Design pass for facetwin. Do not change any copy, number, price or link. Fix layout and style only. Work on Desktop, Tablet and Phone.

Design system (set in Assets, not on single layers):
- Colors: background #0E0E14, card #16161F, line rgba(255,255,255,.08), text #F5F3F7, muted #A8A3B3, accent #7C4DFF. Remove every pink element (the footer marquee strip too).
- Fonts: headings Instrument Serif 400 (accent words in italic), buttons and prices Inter Display 600-700, body Inter 500. Section headings sentence case: 48 px desktop, 40 tablet, 32 phone. Body never below 16 px on Phone. Keep all-caps only for the hero word.
- Section padding 120 / 96 / 72 px. Card radius 24, 1 px line border, no colored boxes inside cards.

Fix these problems:
1. The three feature cards: same height; nothing may overflow a card's border (the phone mock in the middle card currently runs past the bottom edge); the left card's photo strip must be one clean crop, not slivers.
2. The wordmark "facetwin." inside the phone mock uses a serif font and has a stock avatar: use the sans heading font, remove the avatar.
3. Numbers strip: the three numbers use the same size and baseline, labels fit on one line, remove the floating "+" and put the paragraph below the strip. Move the strip to sit directly under the hero.
4. Steps cards: the title and text sit in a darker rectangle inside the grey card. Remove the fill from those text frames.
5. FAQ: smaller heading (see type scale), put the [FAQ] tag directly above it, remove the large empty space.
6. Footer: replace with one compact footer: wordmark "facetwin." (sans) and the line "Natural selfie retouch.", links Privacy and Terms, email hello@facetwin.app, last line "© 2026 facetwin. Face care and photo editing, not medical advice." Delete the pink marquee, the newsletter field, all social links, the About / Careers / Journal links and the background photo.
7. Hero: add a gradient fade into the page background over the last 160 px so there is no hard cut.

Motion: scroll reveal on cards and headings (fade up 16 px, 450 ms ease-out, once, 60 ms stagger), disabled for reduced motion; header gets a blurred dark background and a 1 px line after 80 px scroll; anchor links offset by the header height; on Phone a sticky bottom button "Upload a selfie" that appears after the hero; primary button hover lifts 2 px with a soft purple glow.

When done, list every layer you changed and check there is no horizontal scroll at 390, 768 and 1360 px.
```

## 6. The "Three steps" block: what happens on click (tested on the live page, Desktop and Phone)

Clicking Step 1 / 2 / 3 works technically: the card gets a purple border and the picture on the right changes (3 variants of the `How it works` component, 3 illustrations). The problems are in how it looks and feels:

| # | Problem | Fix |
|---|---|---|
| S1 | **Phone: the picture is below the three cards.** After a tap on Step 2 the picture that changed is only half on screen, so the tap seems to do nothing | on Phone put the picture **above** the cards (fixed 4:3 area), cards below; or make the block a swipe carousel |
| S2 | The three illustrations differ in scale and composition: step 1 a small window, step 2 a tall card that is much bigger, step 3 a window again. The text inside the mock-ups is about 7-8 px (chips "Skin / Eyes / Smile / Freckles / Glow / Backdrop", the "Download" button), unreadable on a phone | redo all three at the same card size and position, same glow; UI text at least 14 px at 390 px width (crop tighter) |
| S3 | Selected and unselected cards look almost the same: all three badges are purple, all texts equally bright, only a 1 px purple border differs | unselected: grey badge `#2A2A36` with muted text, text at 60%; selected: accent badge, `#1A1A26` fill, 1 px accent border, 3 px accent bar on the left |
| S4 | The change is abrupt, and card heights shift by about 10 px when the selection moves (the unselected card is shorter) | crossfade the picture 250 ms; same min-height for selected and unselected cards; 200 ms ease-out on the card state |
| S5 | Content does not match the app: chip names are not the app's names; step 3 shows a plain **Download** although the HD file is paid | label it **Download HD**; after the first real Gemini run replace the three pictures with real app screenshots (not before: mock results are identical to the input) |
| S6 | Nothing moves unless she clicks | optional: auto-advance every 4 s once visible, stop after the first tap |
| S7 | Phone: the "Made in Framer" badge sits on the text of Step 3 | removed only by a paid Framer plan |

Also checked: the header on the live page is now `facetwin.` + menu + **Upload a selfie** (good). **Addresses:** `https://shiny-culture-616454.framer.app/` serves the current site; `https://facetwin.framer.website/` returned "Site not found" on 6 Nov although the API lists it as the production URL: check Framer -> Site Settings -> Domains and publish again.

### Prompt for the Framer agent (steps block)

```
Fix the "How it works" block (the three steps with the picture). Do not change any copy.

1. On Phone, put the picture above the three step cards (fixed 4:3 area), cards below. On Desktop keep the cards left and the picture right.
2. Selected card: accent badge (#7C4DFF), fill #1A1A26, 1 px accent border, 3 px accent bar on the left edge. Unselected cards: grey badge #2A2A36 with muted text, text at 60% opacity, no accent. Same min-height for every card in every state so nothing jumps.
3. Transitions: crossfade the picture 250 ms, card state change 200 ms ease-out.
4. The three pictures must have the same card size and position and the same glow. Make the text inside them at least 14 px when the picture is 358 px wide (zoom/crop the mock-up). Replace the text "Download" in the third picture with "Download HD".
5. Optional: when the block is visible, advance to the next step every 4 seconds; stop after the user taps a step.

Check Desktop (1360), Tablet (768) and Phone (390): no jumping, no clipped text, tapping a step on Phone shows the changed picture on screen without scrolling.
```
