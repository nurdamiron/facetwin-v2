// Icon pass: the UI uses Hugeicons (icons.js), never emoji. Screens written with explicit ico() calls need nothing
// from this file. It is the safety net for the long tail: any emoji or glyph (check, chevron, plus...) that lands in
// the page as text, from a template or a later textContent change, becomes the matching SVG icon. Unknown emoji are removed.
import { ico } from "./icons.js";

const GLYPH = {
  "✓": "check", "✔": "check", "›": "next", "→": null, "↔": "compare", "⟷": "compare", "＋": "plus", "✕": "close", "⚙": "settings",
  "▶": "play", "♡": "heart", "➤": "share", "⬆": "upload", "↗": "share", "↓": "download",
  "🔥": "fire", "🔒": "lock", "🎉": "sparkles", "✨": "sparkles", "🌟": "sparkles", "🧴": "perfume", "📷": "camera", "🔊": "volume", "🔇": "mute",
  "📈": "chart", "☀": "sun", "👓": "glasses", "💇": "scissors", "💪": "dumbbell", "✍": "pencil", "🔔": "bell", "📅": "calendar", "🗑": "trash",
  "❤": "heart", "🧡": "heart", "🤍": "heart", "🖤": "heart", "📸": "camera",
};
// emoji (with optional variation selector / ZWJ sequences) or one of the plain glyphs above
const RE = /(?:\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)|[✓✔›↔⟷＋✕⚙▶♡➤⬆↗↓]︎?/gu;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CANVAS", "SVG", "NOSCRIPT"]);

function convert(node) {
  const text = node.nodeValue;
  RE.lastIndex = 0;
  if (!text || !RE.test(text)) return;
  RE.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let last = 0, m;
  while ((m = RE.exec(text))) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const g = m[0].replace(/️|︎/g, "");
    const name = GLYPH[g];
    if (name === null) frag.append(g); // plain arrows stay as text
    else if (name) {
      const s = document.createElement("span");
      s.className = "ico-i"; s.innerHTML = ico(name, "1.1em");
      frag.append(s);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  // a space left next to a removed emoji looks odd; collapse double spaces made by removals
  node.replaceWith(frag);
}
function walk(root) {
  if (root.nodeType === 3) { if (!SKIP.has(root.parentNode?.nodeName?.toUpperCase())) convert(root); return; }
  if (root.nodeType !== 1 || SKIP.has(root.nodeName.toUpperCase()) || root.hasAttribute("data-noicon")) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (!SKIP.has(n.parentNode.nodeName.toUpperCase()) && !n.parentNode.closest("[data-noicon]")) list.push(n);
  list.forEach(convert);
}
export function startIconPass(root = document.body) {
  walk(root);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") { if (m.target.isConnected) walk(m.target); }
      else m.addedNodes.forEach((n) => walk(n));
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
