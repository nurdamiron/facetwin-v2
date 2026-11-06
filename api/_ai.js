// Which AI image provider is configured. Shared by /api/edit and /api/status. Keys live only in Vercel env vars.
//   GEMINI_API_KEY  -> Google Gemini (default model gemini-2.5-flash-image, GEMINI_IMAGE_MODEL to change)
//   OPENAI_API_KEY  -> OpenAI Images "edits" (default model gpt-image-1, OPENAI_IMAGE_MODEL to change)
//   AI_PROVIDER     -> "gemini" | "openai" to force one when both keys exist; with no value Gemini wins if both are set.
export function aiProvider() {
  const g = (process.env.GEMINI_API_KEY || "").trim(), o = (process.env.OPENAI_API_KEY || "").trim();
  const want = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (want === "openai") return o ? { name: "openai", key: o, model: openaiModel() } : null;
  if (want === "gemini") return g ? { name: "gemini", key: g, model: geminiModel() } : null;
  if (g) return { name: "gemini", key: g, model: geminiModel() };
  if (o) return { name: "openai", key: o, model: openaiModel() };
  return null;
}
export const geminiModel = () => process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
export const openaiModel = () => process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
