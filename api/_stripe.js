// Shared Stripe helpers for the Vercel functions. No npm packages: plain fetch to the Stripe REST API.
// Keys live only in Vercel's Environment Variables, never in the code or the browser:
//   STRIPE_SECRET_KEY            sk_test_... (test mode for the capstone) or sk_live_...
//   STRIPE_PRICE_GLOW_M / _GLOW_Q           price_... ids of the 2 recurring Glow prices (monthly, every 3 months)
//   STRIPE_PRICE_LOOKS / _LOOKS_SKIP        one-time add-on "Looks": full price and the second-chance price
//   STRIPE_PRICE_COACH / _COACH_SKIP        one-time add-on "Coach": full price and the second-chance price
//   STRIPE_COUPON_FIRST_MONTH / _QUARTER    optional coupon ids: a fixed amount off the first period only (duration "once")
//   STRIPE_MOCK=1                           fake checkout for local tests and preview deployments (never honoured in production)
import crypto from "node:crypto";

// The mock grants access without paying, so it must never run on the production deployment.
export const mockOn = () => process.env.STRIPE_MOCK === "1" && process.env.VERCEL_ENV !== "production";
export const secret = () => (process.env.STRIPE_SECRET_KEY || "").trim();
const PRICE_ENV = { glow_m: "STRIPE_PRICE_GLOW_M", glow_q: "STRIPE_PRICE_GLOW_Q" };
const COUPON_ENV = { glow_m: "STRIPE_COUPON_FIRST_MONTH", glow_q: "STRIPE_COUPON_FIRST_QUARTER" };
const UPSELL_ENV = {
  looks: "STRIPE_PRICE_LOOKS", looks_skip: "STRIPE_PRICE_LOOKS_SKIP",
  coach: "STRIPE_PRICE_COACH", coach_skip: "STRIPE_PRICE_COACH_SKIP",
};
export const PLAN_IDS = Object.keys(PRICE_ENV);
export const UPSELL_IDS = ["looks", "coach"];
export const priceFor = (plan) => (process.env[PRICE_ENV[plan]] || "").trim();
export const couponFor = (plan) => (process.env[COUPON_ENV[plan]] || "").trim();
export const upsellPrice = (item, skip) => (process.env[UPSELL_ENV[skip ? item + "_skip" : item]] || "").trim();
export const tierOf = (plan) => (String(plan).startsWith("glow") ? "glow" : null);
export const configured = () => mockOn() || (!!secret() && PLAN_IDS.every((p) => priceFor(p)));
export const upsellsConfigured = () => mockOn() || (!!secret() && Object.values(UPSELL_ENV).every((k) => (process.env[k] || "").trim()));

// Stripe wants form encoding with bracket keys: line_items[0][price]=...
function form(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}
export async function stripe(path, params, method = "POST") {
  const url = `https://api.stripe.com/v1/${path}` + (method === "GET" && params ? `?${form(params)}` : "");
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : form(params || {}),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || `Stripe error ${r.status}`);
  return j;
}

// Signed token so only the buyer's browser can open the billing portal for her customer id.
const tokenKey = () => crypto.createHash("sha256").update("facetwin-portal:" + (secret() || "mock")).digest();
export const sign = (customer) => crypto.createHmac("sha256", tokenKey()).update(String(customer)).digest("base64url");
export const checkSign = (customer, token) => {
  const a = Buffer.from(sign(customer)), b = Buffer.from(String(token || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// The site's own origin, for success / cancel / return URLs.
export function originOf(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || (/^(localhost|127\.)/.test(host || "") ? "http" : "https");
  return `${proto}://${host}`;
}
export const bodyOf = (req) => {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = null; } }
  return b && typeof b === "object" ? b : {};
};
export const queryOf = (req) => new URL(req.url, "http://x").searchParams;

