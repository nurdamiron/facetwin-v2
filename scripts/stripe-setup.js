// One-time Stripe setup for FaceTwin: 2 products, 4 recurring prices, the first-month coupon and a
// customer-portal configuration. Safe to run again: it reuses what already exists (by lookup key / id).
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.js [https://your-site.vercel.app]
//
// Test mode only by default. Add --live to run it with a live key later.
// Prints the env vars to paste into Vercel -> Settings -> Environment Variables. The key itself is never printed.
const KEY = (process.env.STRIPE_SECRET_KEY || "").trim();
const LIVE = process.argv.includes("--live");
const SITE = (process.argv.slice(2).find((a) => /^https?:\/\//.test(a)) || "").replace(/\/$/, "");

if (!KEY) { console.error("Set STRIPE_SECRET_KEY first (Stripe Dashboard -> Developers -> API keys, test mode)."); process.exit(1); }
if (!KEY.startsWith("sk_test_") && !(LIVE && KEY.startsWith("sk_live_"))) {
  console.error(KEY.startsWith("sk_live_") ? "That's a LIVE key. Use a test key (sk_test_...), or pass --live on purpose." : "Key must start with sk_test_.");
  process.exit(1);
}

function form(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out); else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}
async function api(path, params, method = "POST") {
  const url = `https://api.stripe.com/v1/${path}` + (method === "GET" && params ? `?${form(params)}` : "");
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: method === "GET" ? undefined : form(params || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || `Stripe ${r.status}`); e.status = r.status; throw e; }
  return j;
}

const PRODUCTS = [
  { key: "glow", name: "FaceTwin Glow", description: "Natural selfie retouch in one tap, HD download without watermark." },
  { key: "pro", name: "FaceTwin Pro", description: "Everything in Glow + 360° twin, AI looks, face plan and coach." },
];
// Prices from the Unit Economics sheet (Inputs tab, section 4).
const PRICES = [
  { plan: "glow_m", product: "glow", amount: 999, interval: "month", env: "STRIPE_PRICE_GLOW_M" },
  { plan: "glow_y", product: "glow", amount: 4999, interval: "year", env: "STRIPE_PRICE_GLOW_Y" },
  { plan: "pro_m", product: "pro", amount: 1999, interval: "month", env: "STRIPE_PRICE_PRO_M" },
  { plan: "pro_y", product: "pro", amount: 9999, interval: "year", env: "STRIPE_PRICE_PRO_Y" },
];
const COUPON_ID = "FACETWIN_FIRST20";

(async () => {
  const env = {};
  // products (found by metadata so re-runs don't duplicate)
  const existing = (await api("products", { limit: 100, active: "true" }, "GET")).data;
  const prodId = {};
  for (const p of PRODUCTS) {
    const hit = existing.find((x) => x.metadata && x.metadata.facetwin === p.key);
    prodId[p.key] = hit ? hit.id : (await api("products", { name: p.name, description: p.description, metadata: { facetwin: p.key } })).id;
    console.log(`${hit ? "found  " : "created"} product ${p.name} (${prodId[p.key]})`);
  }
  // prices (found by lookup_key)
  for (const p of PRICES) {
    const lk = `facetwin_${p.plan}`;
    const found = (await api("prices", { lookup_keys: [lk], active: "true", limit: 1 }, "GET")).data[0];
    const price = found || await api("prices", {
      product: prodId[p.product], currency: "usd", unit_amount: p.amount, recurring: { interval: p.interval },
      lookup_key: lk, nickname: p.plan, metadata: { plan: p.plan },
    });
    env[p.env] = price.id;
    console.log(`${found ? "found  " : "created"} price ${p.plan} $${(p.amount / 100).toFixed(2)}/${p.interval} (${price.id})`);
  }
  // first-month coupon: 20% off once (applied by /api/checkout to monthly plans only)
  let coupon;
  try { coupon = await api(`coupons/${COUPON_ID}`, null, "GET"); console.log(`found   coupon ${COUPON_ID}`); }
  catch (e) {
    if (e.status !== 404) throw e;
    coupon = await api("coupons", { id: COUPON_ID, percent_off: 20, duration: "once", name: "First month 20% off" });
    console.log(`created coupon ${COUPON_ID} (20% off, once)`);
  }
  env.STRIPE_COUPON_FIRST_MONTH = coupon.id;
  // customer portal: cancel at period end, update card, switch between the 4 plans, invoices
  const oldPortal = (await api("billing_portal/configurations", { limit: 100, active: "true" }, "GET")).data.find((c) => c.metadata && c.metadata.facetwin === "portal");
  const portal = await api(oldPortal ? `billing_portal/configurations/${oldPortal.id}` : "billing_portal/configurations", {
    business_profile: { headline: "FaceTwin: manage your plan" },
    default_return_url: SITE ? `${SITE}/#/account` : undefined,
    features: {
      customer_update: { enabled: "true", allowed_updates: ["email"] },
      invoice_history: { enabled: "true" },
      payment_method_update: { enabled: "true" },
      subscription_cancel: { enabled: "true", mode: "at_period_end", cancellation_reason: { enabled: "true", options: ["too_expensive", "unused", "missing_features", "other"] } },
      subscription_update: {
        enabled: "true", default_allowed_updates: ["price"], proration_behavior: "create_prorations",
        products: PRODUCTS.map((p) => ({ product: prodId[p.key], prices: PRICES.filter((x) => x.product === p.key).map((x) => env[x.env]) })),
      },
    },
    metadata: { facetwin: "portal" },
  });
  env.STRIPE_PORTAL_CONFIG = portal.id;
  console.log(`${oldPortal ? "updated" : "created"} portal configuration (${portal.id})`);
  if (SITE) env.PUBLIC_URL = SITE;

  console.log("\nPaste these into Vercel -> Settings -> Environment Variables (Production + Preview),");
  console.log("together with STRIPE_SECRET_KEY = your sk_test_ key. Then redeploy.\n");
  for (const [k, v] of Object.entries(env)) console.log(`${k}=${v}`);
  console.log("\nOne more click in the Stripe Dashboard (no API for it):");
  console.log("  Settings -> Billing -> Subscriptions and emails -> turn on emails about upcoming renewals.");
  console.log("Test card: 4242 4242 4242 4242, any future date, any CVC.");
})().catch((e) => { console.error("Stripe setup failed:", e.message); process.exit(1); });
