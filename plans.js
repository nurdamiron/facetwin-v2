// Rules that turn quiz answers + the face scan into a daily routine.
// Each block is one routine step. "days" uses 0=Sun ... 6=Sat. Reviewed text, not medical advice.

export const CONCERNS = [
  { id: "texture", label: "Uneven texture" },
  { id: "dryness", label: "Dryness" },
  { id: "dark_circles", label: "Dark circles" },
  { id: "oily", label: "Oily T-zone" },
  { id: "redness", label: "Redness" },
  { id: "brows", label: "Thin brows" },
  { id: "lines", label: "Fine lines" },
  { id: "breakouts", label: "Breakouts" },
];

const DAILY = [0, 1, 2, 3, 4, 5, 6];

export const BLOCKS = {
  cleanse_am: { name: "Gentle cleanse", when: "am", min: 1, days: DAILY, free: true, color: "#FFD9C9",
    how: "Lukewarm water and a gentle, fragrance-free cleanser. Massage for 30 seconds, then pat dry. No hot water." },
  spf: { name: "SPF 30+", when: "am", min: 0.5, days: DAILY, free: true, color: "#CFE8FF",
    how: "Two finger-lengths for face and neck, every morning, even when it's cloudy. It's the step that protects everything else." },
  moisturizer: { name: "Moisturizer", when: "am", min: 0.5, days: DAILY, color: "#E5DBFF",
    how: "A pea-size amount on slightly damp skin, before SPF." },
  gel_moisturizer: { name: "Light gel moisturizer", when: "am", min: 0.5, days: DAILY, color: "#E5DBFF",
    how: "Oily skin still needs water. A light gel keeps the T-zone calm without shine." },
  eye_care: { name: "Eye care", when: "am", min: 1, days: DAILY, color: "#FFF1B8",
    how: "Tap a caffeine eye cream under the eyes with your ring finger. A cold spoon for 30 seconds helps puffiness. Sleep counts more than any cream." },
  cleanse_pm: { name: "Evening cleanse", when: "pm", min: 1, days: DAILY, color: "#FFD9C9",
    how: "Remove SPF and makeup first (micellar water or a cleansing balm), then your gentle cleanser." },
  hydrate: { name: "Hydrating serum", when: "pm", min: 0.5, days: DAILY, color: "#C9F2DE",
    how: "Hyaluronic acid or glycerin serum on damp skin, then seal it with moisturizer." },
  exfoliate: { name: "Exfoliate (texture)", when: "pm", min: 2, days: [2, 5], color: "#FFF1B8",
    how: "A gentle exfoliating acid (AHA or BHA) on cheeks and forehead. Skip the eye area. If it stings, rinse and skip next time." },
  soothe: { name: "Soothing serum", when: "pm", min: 0.5, days: DAILY, color: "#C9F2DE",
    how: "Niacinamide or centella serum. Avoid scrubs, hot water and fragrance while redness calms down." },
  brow_serum: { name: "Brow serum", when: "pm", min: 1, days: DAILY, color: "#FFC9DE",
    how: "Brow serum along the brow line, then brush brows up. Results take 6-8 weeks, so the weekly scan matters here." },
  retinoid: { name: "Retinol (start slow)", when: "pm", min: 1, days: [1], color: "#E5DBFF",
    how: "A pea-size amount of gentle retinol on dry skin, away from eyes. Never on exfoliation nights. Skip if pregnant or breastfeeding." },
  spot: { name: "Spot care", when: "pm", min: 0.5, days: DAILY, color: "#FFC9DE",
    how: "Salicylic acid or benzoyl peroxide only on active spots. Hands off: picking leaves marks that last longer than the spot." },
  moist_pm: { name: "Night moisturizer", when: "pm", min: 0.5, days: DAILY, color: "#E5DBFF",
    how: "A slightly richer moisturizer as the last step of the night." },
};

const CONCERN_BLOCKS = {
  texture: ["exfoliate"], dryness: ["hydrate"], dark_circles: ["eye_care"], oily: [],
  redness: ["soothe"], brows: ["brow_serum"], lines: ["retinoid"], breakouts: ["spot"],
};

// Concerns suggested by the scan are added when the user didn't pick them herself.
export function scanConcerns(analysis) {
  const out = [];
  if (!analysis) return out;
  if (analysis.texture >= 0.55) out.push("texture");
  if (analysis.redness >= 0.6) out.push("redness");
  if (analysis.darkCircles >= 0.6) out.push("dark_circles");
  return out;
}

export function buildPlan({ concerns = [], minutes = 5, analysis = null, week = 1 }) {
  const picked = [...concerns];
  const fromScan = scanConcerns(analysis).filter((c) => !picked.includes(c));
  const all = [...picked, ...fromScan];

  const ids = ["cleanse_am", all.includes("oily") ? "gel_moisturizer" : "moisturizer", "spf"];
  const extras = [];
  for (const c of all) for (const b of CONCERN_BLOCKS[c] || []) if (!extras.includes(b)) extras.push(b);

  // Budget: average minutes per day. 2 min = essentials + 1 focus, 5 min = up to 3 focus steps.
  const maxExtras = minutes <= 2 ? 1 : minutes <= 5 ? 3 : 6;
  const chosen = extras.slice(0, maxExtras);
  if (minutes >= 5 || chosen.length) ids.push("cleanse_pm");
  ids.push(...chosen);
  if (minutes >= 10) ids.push("moist_pm");

  const steps = ids.map((id) => {
    const b = { id, ...BLOCKS[id] };
    // Week-by-week progression and safe combinations.
    if (id === "exfoliate") b.days = all.includes("redness") ? [5] : week === 1 ? [3] : [2, 5];
    if (id === "retinoid") b.days = week <= 2 ? [1] : week <= 6 ? [1, 4] : [0, 1, 4]; // never on exfoliation nights (Tue/Wed/Fri)
    b.focus = fromScan.some((c) => (CONCERN_BLOCKS[c] || []).includes(id)) ? "from your scan" : "";
    return b;
  });
  return { steps, concerns: all, fromScan };
}

export function stepsForDay(plan, date, free) {
  const dow = date.getDay();
  return plan.steps
    .filter((s) => s.days.includes(dow))
    .map((s) => ({ ...s, locked: free && !s.free }));
}
