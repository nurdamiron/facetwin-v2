// Transactional email through Resend (https://resend.com), plain fetch, no package. Used only for the "Restore purchase" code.
//   RESEND_API_KEY  the Resend API key (Vercel env var, never in the repo)
//   MAIL_FROM       e.g. "FaceTwin <hello@your-domain>" (the domain must be verified in Resend; the test sender onboarding@resend.dev
//                   can only mail the Resend account owner)
export const mailConfigured = () => !!(process.env.RESEND_API_KEY || "").trim() && !!(process.env.MAIL_FROM || "").trim();

export async function sendMail({ to, subject, text }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM.trim(), to: [to], subject, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`mail ${r.status}`);
}
