// FaceTwin MVP settings. This is the only file you need to edit before a test.
export const CONFIG = {
  // Meta Pixel ID from Events Manager (Data sources -> your Pixel). Leave "" to turn the Pixel off.
  META_PIXEL_ID: "",

  // Where emails + quiz answers go. Any endpoint that accepts a JSON POST works,
  // e.g. a free Formspree form: "https://formspree.io/f/xxxxxxx". Photos are never sent.
  LEAD_ENDPOINT: "",

  // Checkout links from your payment provider (Paddle, Lemon Squeezy, Gumroad, Stripe...).
  // Leave "" and the paywall shows an honest "payments open soon / early access" screen instead.
  PAYMENT_LINKS: { trial: "", four: "", twelve: "", glow_m: "", glow_q: "" },
  // Main path is Stripe Checkout through /api/checkout (keys in Vercel env vars, see README "Payments").
  // PAYMENT_LINKS above are only the fallback. Old unlock by URL (?paid=glow_m) stays OFF: anyone can type it.
  ALLOW_PAID_PARAM: false,
  // ?tester=1 unlocks everything for the team. Works on localhost and with ?debug=1 only; set true to allow it on the public site (a demo, a review). Anyone who knows the URL can use it.
  ALLOW_TESTER: false,

  // V2 plans, as in the pitch deck and the unit-economics sheet (Excel v5). price = what she pays today,
  // then = the recurring price. The first month / quarter is $10 / $22.50 off (Stripe coupons), see scripts/stripe-setup.js.
  PLANS_GLOW: [
    { id: "glow_m", tier: "Glow", name: "Glow monthly", price: 9.99, then: 19.99, period: "month", note: "first month, then $19.99 a month" },
    { id: "glow_q", tier: "Glow", name: "Glow quarterly", price: 22.49, then: 44.99, period: "quarter", note: "first quarter, then $44.99 every 3 months · $15.00 a month", popular: true },
  ],
  // One-time add-ons offered right after checkout. price = first offer, skipPrice = the one second chance if she declined.
  // Both are real prices she can pay; the app never shows a crossed-out price that was never charged.
  UPSELLS: [
    { id: "looks", name: "Looks", icon: "cube", price: 29.99, skipPrice: 23.99, title: "See the change on your 3D twin",
      points: ["Your 3D twin, turn it to any angle", "Try haircuts, colors, braids, brows and beards on your face", "Describe any idea in your own words"] },
    { id: "coach", name: "Coach", icon: "dumbbell", price: 24.99, skipPrice: 19.99, title: "Train for the change",
      points: ["A 12-week plan for your face", "Live camera coach that counts reps and checks form", "Weekly re-scan to see your progress"] },
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
  SHARE_URL: "facetwin-demo.vercel.app",
  SUPPORT_EMAIL: "hello@facetwin.app",

  // On-device AI models. The face model ships inside /models. The hair model is loaded from
  // Google's public model storage; download it into /models and change the path to self-host.
  FACE_MODEL_URL: "./models/face_landmarker.task",
  // Depth AI for the realistic 3D twin (Depth Anything V2 Small, Apache-2.0, ~100 MB, cached after first load).
  DEPTH_MODEL_URL: "./models/depth_anything_v2_vits.onnx",
  FACE_MODEL_FALLBACK: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  HAIR_MODEL_URL: "./models/hair_segmenter.tflite", // MediaPipe hair segmenter (Apache 2.0), self-hosted
};
