// Tells the page what is available (the page calls api/status on load): the AI editor, Stripe payments and the add-ons.
import * as S from "./_stripe.js";
import { aiProvider } from "./_ai.js";
import { mailConfigured } from "./_mail.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const ai = aiProvider();
  res.status(200).json({
    ai: Boolean(ai) || (process.env.AI_MOCK === "1" && !process.env.VERCEL),
    mock: process.env.AI_MOCK === "1" && !process.env.VERCEL,
    provider: ai ? ai.name : null,
    model: ai ? ai.model : "gemini-2.5-flash-image",
    payments: S.configured(),
    upsells: S.configured() && S.upsellsConfigured(),
    paymentsMock: S.mockOn(),
    restore: S.mockOn() || (S.configured() && mailConfigured()), // "Restore purchase" by email code needs Stripe + RESEND_API_KEY + MAIL_FROM
  });
}
