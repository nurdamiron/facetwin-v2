// Tells the page whether the AI editor is available (the page calls api/status on load).
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ai: Boolean((process.env.GEMINI_API_KEY || "").trim()), mock: false, model: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image" });
}
