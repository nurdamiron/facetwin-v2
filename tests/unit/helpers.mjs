// Tiny helpers for the API tests: fake req/res, env switching, and a fetch stub (no network, no Stripe/Gemini account).
let n = 0;
export const fresh = (rel) => import(new URL(rel, import.meta.url).href + "?t=" + ++n + Date.now()); // new module instance, new in-memory state

export function mkRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.body = o; return res; };
  return res;
}
export const mkReq = ({ method = "POST", body, headers = {}, url = "/api/x" } = {}) =>
  ({ method, body, url, headers: { host: "facetwin.test", ...headers }, socket: { remoteAddress: "10.0.0.1" } });

const KEYS = ["GEMINI_API_KEY", "GEMINI_IMAGE_MODEL", "AI_MOCK", "AI_EDITS_PER_HOUR", "RATE_LIMIT_PER_HOUR", "DAILY_CAP", "VERCEL", "VERCEL_ENV", "PUBLIC_URL",
  "STRIPE_MOCK", "STRIPE_SECRET_KEY", "STRIPE_PRICE_GLOW_M", "STRIPE_PRICE_GLOW_Q", "STRIPE_PRICE_LOOKS", "STRIPE_PRICE_LOOKS_SKIP",
  "STRIPE_PRICE_COACH", "STRIPE_PRICE_COACH_SKIP", "STRIPE_COUPON_FIRST_MONTH", "STRIPE_COUPON_FIRST_QUARTER", "STRIPE_PORTAL_CONFIG"];
export const STRIPE_ENV = {
  STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_GLOW_M: "price_gm", STRIPE_PRICE_GLOW_Q: "price_gq",
  STRIPE_PRICE_LOOKS: "price_l", STRIPE_PRICE_LOOKS_SKIP: "price_ls", STRIPE_PRICE_COACH: "price_c", STRIPE_PRICE_COACH_SKIP: "price_cs",
  STRIPE_COUPON_FIRST_MONTH: "cpn_m", STRIPE_COUPON_FIRST_QUARTER: "cpn_q",
};
// Runs fn with exactly these env vars set (all the app's other vars cleared), then restores everything.
export async function withEnv(env, fn) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try { return await fn(); } finally { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}
// Replaces global fetch for the duration of fn. handler(url, init) -> {status?, json}. Returns the recorded calls.
export async function withFetch(handler, fn) {
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || "GET", body: init.body, headers: init.headers || {} };
    calls.push(call);
    const out = (await handler(call)) || { json: {} };
    return { ok: (out.status || 200) < 400, status: out.status || 200, json: async () => out.json };
  };
  try { await fn(calls); } finally { globalThis.fetch = real; }
  return calls;
}
export const formOf = (call) => Object.fromEntries(new URLSearchParams(String(call.body || "")));
export const IMG = "A".repeat(300);
