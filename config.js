// FaceTwin MVP settings. This is the only file you need to edit before a test.
export const CONFIG = {
  // Meta Pixel ID from Events Manager (Data sources -> your Pixel). Leave "" to turn the Pixel off.
  META_PIXEL_ID: "",

  // Where emails + quiz answers go. Any endpoint that accepts a JSON POST works,
  // e.g. a free Formspree form: "https://formspree.io/f/xxxxxxx". Photos are never sent.
  LEAD_ENDPOINT: "",

  // Checkout links from your payment provider (Paddle, Lemon Squeezy, Gumroad, Stripe...).
  // Leave "" and the paywall shows an honest "payments open soon / early access" screen instead.
  PAYMENT_LINKS: { trial: "", four: "", twelve: "", glow_m: "", glow_y: "", pro_m: "", pro_y: "" },
  // Main path is Stripe Checkout through /api/checkout (keys in Vercel env vars, see README "Payments").
  // PAYMENT_LINKS above are only the fallback. Old unlock by URL (?paid=glow_y) stays OFF: anyone can type it.
  ALLOW_PAID_PARAM: false,

  // V2 plans (Glow editor + Pro). price = what she pays today, then = the recurring price.
  // Monthly plans start with a 20% first-month discount (Offer tab of the unit-economics sheet).
  PLANS_GLOW: [
    { id: "glow_m", tier: "Glow", name: "Glow monthly", price: 7.99, then: 9.99, period: "month", note: "first month, then $9.99 a month" },
    { id: "glow_y", tier: "Glow", name: "Glow annual", price: 49.99, then: 49.99, period: "year", note: "$4.17 a month · save 58% vs monthly", popular: true },
    { id: "pro_m", tier: "Pro", name: "Pro monthly", price: 15.99, then: 19.99, period: "month", note: "first month, then $19.99 · adds 3D twin + 12-week plan" },
    { id: "pro_y", tier: "Pro", name: "Pro annual", price: 99.99, then: 99.99, period: "year", note: "$8.33 a month · 3D twin, plan, weekly re-scan" },
  ],

  // Plans shown on the paywall of the older V1 flow (prices from the HW2 LTV model).
  PLANS: [
    { id: "trial", name: "1-week trial", price: 6.93, note: "then $19.99 every 4 weeks" },
    { id: "four", name: "4-week plan", price: 19.99, note: "$0.71 a day" },
    { id: "twelve", name: "12-week plan", price: 39.99, note: "$0.48 a day · full program", popular: true },
  ],
  CURRENCY: "USD",
  FREE_DAYS: 7,
  FREE_LOOKS: 3,
  FREE_PREVIEWS: 2, // realistic AI previews before the paywall (HD download is behind the paywall)

  // "My shelf" buy buttons open a store search for the product. Add your Amazon Associates tag
  // (or swap the URL for another store) to earn a commission. {q} = product name.
  SHOP_SEARCH_URL: "https://www.amazon.com/s?k={q}",
  AFFILIATE_TAG: "",

  // Link printed on share cards.
  SHARE_URL: "facetwin.app",
  SUPPORT_EMAIL: "hello@facetwin.app",

  // On-device AI models. The face model ships inside /models. The hair model is loaded from
  // Google's public model storage; download it into /models and change the path to self-host.
  FACE_MODEL_URL: "./models/face_landmarker.task",
  // Depth AI for the realistic 3D twin (Depth Anything V2 Small, Apache-2.0, ~100 MB, cached after first load).
  DEPTH_MODEL_URL: "./models/depth_anything_v2_vits.onnx",
  FACE_MODEL_FALLBACK: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  HAIR_MODEL_URL: "./models/hair_segmenter.tflite", // MediaPipe hair segmenter (Apache 2.0), self-hosted
};
