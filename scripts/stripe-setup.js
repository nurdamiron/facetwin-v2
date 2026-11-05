// One-time Stripe setup for FaceTwin: 3 products, 6 prices, 2 first-period coupons and a customer-portal configuration.
// Safe to run again: it reuses what already exists (by lookup key / id).
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.js [https://your-site.vercel.app]
//
// Every amount comes from config.js (PLANS_GLOW and UPSELLS), so the app and Stripe cannot drift apart:
//   Glow monthly and quarterly (recurring), Looks and Coach (one-time, each with a second-chance price),
//   and one coupon per plan that takes the price down to its first-period price once.
// Test mode only by default. Add --live to run it with a live key later.
// Prints the env vars to paste into Vercel -> Settings -> Environment Variables. The key itself is never printed.
import { CONFIG } from "../config.js";

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
const cents = (usd) => Math.round(usd * 100);

const PRODUCTS = [
  { key: "glow", name: "FaceTwin Glow", description: "Natural selfie retouch in one tap, Studio backgrounds, HD download without watermark." },
  { key: "looks", name: "FaceTwin Looks", description: "One-time add-on: your 3D twin and hair, color, brows and beard looks on your own face." },
  { key: "coach", name: "FaceTwin Coach", description: "One-time add-on: a 12-week face plan, live camera coach and weekly re-scan." },
];
const INTERVAL = { month: { interval: "month", interval_count: 1 }, quarter: { interval: "month", interval_count: 3 } };
const PRICES = [
  ...CONFIG.PLANS_GLOW.map((p) => ({
    plan: p.id, product: "glow", amount: cents(p.then), recurring: INTERVAL[p.period], env: "STRIPE_PRICE_" + p.id.toUpperCase(),
    couponId: "FACETWIN_FIRST_" + p.period.toUpperCase(), couponOff: cents(p.then) - cents(p.price), couponEnv: "STRIPE_COUPON_FIRST_" + p.period.toUpperCase(),
  })),
  ...CONFIG.UPSELLS.flatMap((u) => [
    { plan: u.id, product: u.id, amount: cents(u.price), env: "STRIPE_PRICE_" + u.id.toUpperCase() },
    { plan: u.id + "_skip", product: u.id, amount: cents(u.skipPrice), env: "STRIPE_PRICE_" + u.id.toUpperCase() + "_SKIP" },
  ]),
];

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
  // prices (found by lookup_key; if a price with that key exists at another amount, it is moved to the new one)
  for (const p of PRICES) {
    const lk = `facetwin_${p.plan}`;
    const found = (await api("prices", { lookup_keys: [lk], active: "true", limit: 1 }, "GET")).data[0];
    const same = found && found.unit_amount === p.amount;
    const price = same ? found : await api("prices", {
      product: prodId[p.product], currency: "usd", unit_amount: p.amount, recurring: p.recurring,
      lookup_key: lk, transfer_lookup_key: found ? "true" : undefined, nickname: p.plan, metadata: { plan: p.plan },
    });
    env[p.env] = price.id;
    console.log(`${same ? "found  " : found ? "updated" : "created"} price ${p.plan} $${(p.amount / 100).toFixed(2)}${p.recurring ? ` every ${p.recurring.interval_count} month(s)` : " one-time"} (${price.id})`);
  }
  // first-period coupons: a fixed amount off, once (applied by /api/checkout to the matching plan)
  for (const p of PRICES.filter((x) => x.couponId)) {
    let coupon;
    try { coupon = await api(`coupons/${p.couponId}`, null, "GET"); console.log(`found   coupon ${p.couponId}`); }
    catch (e) {
      if (e.status !== 404) throw e;
      coupon = await api("coupons", { id: p.couponId, amount_off: p.couponOff, currency: "usd", duration: "once", name: `First ${p.plan.endsWith("_q") ? "quarter" : "month"} price` });
      console.log(`created coupon ${p.couponId} ($${(p.couponOff / 100).toFixed(2)} off, once)`);
    }
    env[p.couponEnv] = coupon.id;
  }
  // customer portal: cancel at period end, update card, switch between the Glow plans, invoices
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
        products: [{ product: prodId.glow, prices: CONFIG.PLANS_GLOW.map((p) => env["STRIPE_PRICE_" + p.id.toUpperCase()]) }],
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
