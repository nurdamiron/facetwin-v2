// Tells the page what is available (the page calls api/status on load): the AI editor and Stripe payments.
import * as S from "./_stripe.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ai: Boolean((process.env.GEMINI_API_KEY || "").trim()) || (process.env.AI_MOCK === "1" && !process.env.VERCEL),
    mock: process.env.AI_MOCK === "1" && !process.env.VERCEL,
    model: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
    payments: S.configured(),
    paymentsMock: S.MOCK,
  });
}
