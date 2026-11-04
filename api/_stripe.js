// Shared Stripe helpers for the Vercel functions. No npm packages: plain fetch to the Stripe REST API.
// Keys live only in Vercel's Environment Variables, never in the code or the browser:
//   STRIPE_SECRET_KEY            sk_test_... (test mode for the capstone) or sk_live_...
//   STRIPE_PRICE_GLOW_M / _GLOW_Y / _PRO_M / _PRO_Y   price_... ids of the 4 recurring prices
//   STRIPE_COUPON_FIRST_MONTH    optional coupon id: 20% off, duration "once", applied to monthly plans
//   STRIPE_MOCK=1                fake checkout for local tests (no Stripe account needed)
import crypto from "node:crypto";

export const MOCK = process.env.STRIPE_MOCK === "1";
export const secret = () => (process.env.STRIPE_SECRET_KEY || "").trim();
const PRICE_ENV = { glow_m: "STRIPE_PRICE_GLOW_M", glow_y: "STRIPE_PRICE_GLOW_Y", pro_m: "STRIPE_PRICE_PRO_M", pro_y: "STRIPE_PRICE_PRO_Y" };
export const PLAN_IDS = Object.keys(PRICE_ENV);
export const priceFor = (plan) => (process.env[PRICE_ENV[plan]] || "").trim();
export const isMonthly = (plan) => plan.endsWith("_m");
export const tierOf = (plan) => (String(plan).startsWith("pro") ? "pro" : String(plan).startsWith("glow") ? "glow" : null);
export const configured = () => MOCK || (!!secret() && PLAN_IDS.every((p) => priceFor(p)));

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

