# Framer landing tools

Scripts that built and maintain the Framer landing (Server API, `framer-api`). They never contain a key.

```bash
cd tools/framer && npm install            # installs framer-api (Node 22)
export FRAMER_API_KEY=...                 # per project: Framer -> Site settings -> API Keys. Never commit it. Revoke when done.
export NODE_USE_ENV_PROXY=1               # only needed inside the Claude cloud sandbox (WebSocket via the proxy)
export FRAMER_PROJECT=https://framer.com/projects/<your project>   # optional, default is the capstone copy
```

| Script | What it does | Reusable? |
|---|---|---|
| `set-prices.mjs` | writes the two Glow pricing cards from `../../config.js` (`DRY=1` to preview). Does not publish | **yes, run after every price change** |
| `apply.mjs` | page copy + component controls + links to the app + FAQ replacement (`DRY=1` to preview, `APP_URL=` for the button link) | yes, idempotent: it only changes texts that still match the old template wording |
| `links.mjs` | points every CTA button at the funnel `https://facetwin-demo.vercel.app/?utm_source=framer&utm_medium=landing` (`DRY=1` to preview, `APP_URL=` to override). Header/footer masters must be fixed by hand | **yes, run after any domain change** |
| `verify.mjs` | reads the page and lists leftover template wording, link-like values, FAQ items per breakpoint | yes |
| `faqdiag.mjs`, `fixfaq.mjs` | find and remove duplicate / stray FAQ Block frames | yes, after any detach |
| `leftovers.mjs` | scans every page for template wording (Sensoria, neural, face swap, app-store, ...) in text and component controls | yes |
| `polish.mjs` | removes the "Custom Plan" block, fixes stray mailto / face-swap wording; `DRY=1` to preview | yes, idempotent |
| `custom-code.mjs` | puts the UTM / `fbclid` passthrough script in the site's body-end custom code (refuses to overwrite someone else's code) | yes |
| `improve.mjs` | the 6 Nov copy pass (headings, benefit lines, pricing renewal wording, FAQ heading) on all three breakpoints; `DRY=1` to preview | yes, idempotent |
| `faq3.mjs` | FAQ questions / answers and the three numbers in the Numbers block | yes, idempotent |
| `copy.mjs` | dumps every text per breakpoint to `copy.json` (to compare Desktop / Tablet / Phone) | yes |
| `cards.mjs` | sets the 9 words of the "Selfie touch-up highlights" ticker cards | yes |
| `mobile-audit.cjs` | Playwright audit of the live page at 320 / 360 / 390 / 430 / 768 px: overflow, tiny text and tap targets, contrast, colors, fonts, alt texts (`node mobile-audit.cjs <outdir> <url>`) | yes |
| `pub.mjs` | `publish()`: **goes live immediately** at the project's `.framer.app` URL | yes, use deliberately |
| `pricing.mjs`, `logo.mjs` | one-off replacements of the Pricing Table and the logo in one card (they target node ids that no longer exist) | no, kept as examples of the detach -> edit -> `setParent` -> remove technique |

Gotchas are in `docs/LANDING.md` section 3. Masters can NOT be edited with the normal node API, but they CAN with the agent API (`framer.agent.applyChanges`, DSL in `agent-dsl.txt`; see `icons-component.mjs`). Also: the detached insert leaves a stray copy at the root of each breakpoint, and breakpoint nodes are mirrored.

## Icons and the agent API

| Script | What it does |
|---|---|
| `icons-build.mjs` | builds the nine SVGs from the Hugeicons Free package (mapping card -> icon is in the file) |
| `icons-upload.mjs` | uploads `assets/landing-icons/*.svg` to Framer, writes `icon-urls.json` |
| `icons-component.mjs` | edits the master "Problem card" (image variable, chip, icon frame) with `framer.agent.applyChanges` |
| `icons-set.mjs` | sets `$control__iconImage` on the nine instances and reads it back |
| `agent-dsl.txt` | the agent DSL reference printed by `framer.agent.getSystemPrompt()` |

## Link audit (6 Nov)

Every link in the project, including the masters (Navbar, Footer, Footer 2, CTA, cards), is reachable with `framer.agent.serialize`. `link-audit-dump.mjs` + `link-audit-report.mjs` list them, `link-fix-example.mjs` shows the fix. Rules now in the project: every button, logo and "Try it free" opens exactly `https://facetwin-demo.vercel.app/` (the custom code adds `utm_source=framer`, `utm_medium=landing`, the ad's params and `from=lp` at click time); Privacy and Terms open `/privacy.html` and `/terms.html` on the same domain; menu items jump to the page anchors `home`, `how-it-works`, `pricing`, `faq`, `privacy`; mail is `hello@facetwin.app`. Footer 2: template items About / Careers / Journal became How it works / Pricing / FAQ, the Instagram / LinkedIn / Threads items were deleted (no such accounts). A rich-text node: `SET <id> text=...` resets its formatting and link, so set the attributes again afterwards.
