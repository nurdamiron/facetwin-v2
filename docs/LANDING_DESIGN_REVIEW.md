# Landing design review (6 Nov 2026)

Based on the owner's screenshots of the live site and on the project read through the Server API. Text is already fixed on all three breakpoints (`tools/framer/improve.mjs`, `faq3.mjs`). This file lists the **design** problems, what was done, and the prompt for the Framer agent for what the API cannot touch (anything inside a master component: cards, footer, step cards, header).

## 1. Problems seen

| # | Where | Problem | Fix | Who |
|---|---|---|---|---|
| 1 | Feature cards (3 in a row) | Different heights; the phone mock in the middle card runs past the card's bottom border; the left card's photo strip is cropped into slivers; stock close-ups are not our results; "Soft glow" repeats "One-tap retouch" | equal height, mock fully inside, one clean crop, our own before/after in card 1, card 3 becomes the add-ons card (Looks / Coach) | agent |
| 2 | Same cards | The wordmark "facetwin." inside the phone mock is the template's **serif** font and a stock avatar sits next to it | sans (Bricolage Grotesque), no avatar | agent |
| 3 | Numbers strip | "10s" renders larger than "8" and "4", labels wrap to two lines, a lonely "+" and a paragraph float on the right; the numbers did not decide anything | three numbers that decide whether she taps: **10s** typical edit, **2** free edits, **12** edits to choose from; short labels; same size and baseline; paragraph under the strip, no "+" | texts and numbers done (API); sizes: agent |
| 4 | Steps cards ("Step 2" ...) | Title and text sit in a **darker rectangle** inside the grey card (the text frames have their own fill) | no fill on those frames, same color as the card | agent |
| 5 | FAQ | Template questions ("neural scan", "98% precision"); oversized all-caps heading with the `[FAQ]` tag far left; big empty gap | questions replaced (done); heading smaller, tag directly above it | texts done; sizes: agent |
| 6 | Footer | **Pink marquee strip** (template accent, not our purple) with NEURAL MAPPING / DERMAL ANALYSIS; serif "Sensoria"; "Sensoria combines advanced neural mapping"; `hello@sensoria.com`; newsletter field with **no backend**; links to About / Careers / Journal / Threads / Instagram / LinkedIn that are not ours; right column overflows the viewport edge; blurred stock portrait behind | one compact footer, see 3.2 | agent |
| 7 | Whole page | Two accent colors (pink + purple), two wordmark fonts (serif + sans), three heading styles (huge caps, sentence case, small) | one accent `#7C4DFF`, one wordmark, one type scale (section 2) | agent |
| 8 | Hero to first section | Hard cut from the full-bleed photo to flat black | gradient fade into `#0E0E14` over the last 160 px | agent |

## 2. Design system to enforce

- Colors: background `#0E0E14`, card `#16161F`, line `rgba(255,255,255,.08)`, text `#F5F3F7`, muted `#A8A3B3`, accent `#7C4DFF` (hover `#8F69FF`). No pink anywhere.
- Type: headings Bricolage Grotesque 700, body Manrope 500. Section heading: sentence case, 48 px desktop / 40 tablet / 32 phone, line height 1.05. Card title 20 px, body 16 px (never below 16 on phone). The big all-caps look stays only for the hero word.
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
- Fonts: headings Bricolage Grotesque 700, body Manrope 500. Section headings sentence case: 48 px desktop, 40 tablet, 32 phone. Body never below 16 px on Phone. Keep all-caps only for the hero word.
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
