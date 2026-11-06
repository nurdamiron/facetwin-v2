// Sets the two Glow pricing cards on the Framer landing from config.js, so the page never drifts from the app.
//   FRAMER_API_KEY=... NODE_USE_ENV_PROXY=1 node tools/framer/set-prices.mjs        (add DRY=1 to only print)
// Cards are found by their title ("Glow monthly" / "Glow quarterly"), on every breakpoint. Does not publish.
import { connect } from "framer-api";
import { CONFIG } from "../../config.js";
const DRY = process.env.DRY === "1";
const money = (n) => "$" + n.toFixed(2);
const per = { month: ["first month", (p) => `Then ${money(p.then)} a month. Unlimited natural retouch and Studio backgrounds. Cancel anytime.`],
  quarter: ["first quarter", (p) => `Then ${money(p.then)} every 3 months, that is ${money(p.then / 3)} a month. Same Glow plan, ${Math.round((1 - p.then / 3 / CONFIG.PLANS_GLOW[0].then) * 100)}% cheaper per month.`] };
const want = Object.fromEntries(CONFIG.PLANS_GLOW.map((p) => [p.name, { fc0xWhwjw: money(p.price), HuTeItTSZ: per[p.period][0], r8Ufyvcw8: per[p.period][1](p) }]));
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
let n = 0;
try {
  for (const i of await framer.getNodesWithType("ComponentInstanceNode")) {
    const t = i.controls && i.controls.Wlwq_6h4L, w = want[t]; if (!w) continue;
    const diff = Object.fromEntries(Object.entries(w).filter(([k, v]) => i.controls[k] !== v));
    if (!Object.keys(diff).length) continue;
    n++; console.log(`${i.id} ${t}:`, JSON.stringify(diff));
    if (!DRY) await i.setAttributes({ controls: diff });
  }
} finally { await framer.disconnect(); }
console.log(n ? `${n} card(s) ${DRY ? "would change" : "updated"}` : "all cards already match config.js");
