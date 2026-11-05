// Face exercise coach: the exercise library and a rep counter that reads facial muscle scores
// (MediaPipe blendshapes) from the live camera. Pure logic, no DOM, so it can be tested.

// Raw signals, read from one camera frame { lm, bs }.
const SIG = {
  jaw: (f) => f.bs.jawOpen || 0,
  pucker: (f) => f.bs.mouthPucker || 0,
  puff: (f) => f.bs.cheekPuff || 0,
  brow: (f) => ((f.bs.browInnerUp || 0) + ((f.bs.browOuterUpLeft || 0) + (f.bs.browOuterUpRight || 0)) / 2) / 2,
  smile: (f) => ((f.bs.mouthSmileLeft || 0) + (f.bs.mouthSmileRight || 0)) / 2,
  // head tilted back: the nose tip moves up toward the eye line on screen
  up: (f) => { const l = f.lm, ey = (l[33][1] + l[263][1]) / 2; return 1 - (l[1][1] - ey) / Math.max(1e-3, l[152][1] - ey); },
};
// How far above her relaxed face each signal must rise to count as "full range".
const AMP = { jaw: 0.42, pucker: 0.45, puff: 0.3, brow: 0.38, smile: 0.5, up: 0.09 };

export const EXERCISES = [
  { id: "jaw", name: "Jaw opener", icon: "face", area: "Jawline", muscles: "Jaw and chin",
    how: "Open your mouth as wide as is comfortable, then close it slowly. Keep your head still.",
    phases: [{ parts: ["jaw"], hold: 0 }], reps: 10, checks: ["front", "level"],
    cues: { low: "Open wider", hold: "", relax: "Close slowly" } },
  { id: "fish", name: "Fish face", icon: "smile", area: "Cheeks", muscles: "Cheeks and lips",
    how: "Suck your cheeks in and push your lips forward like a fish. Hold, then relax.",
    phases: [{ parts: ["pucker"], hold: 3000 }], reps: 5, checks: ["front", "level", "closed"],
    cues: { low: "Lips forward, cheeks in", hold: "Hold it", relax: "Relax" } },
  { id: "kiss", name: "Ceiling kiss", icon: "heart", area: "Jawline", muscles: "Neck, jaw and chin",
    how: "Tilt your head back, look at the ceiling and push your lips up as if kissing it. Hold, then come back.",
    phases: [{ parts: ["up", "pucker"], hold: 4000 }], reps: 5, checks: ["front"],
    cues: { low: "Chin up, lips forward", hold: "Hold, feel your neck", relax: "Come back to the start" } },
  { id: "vowels", name: "A – O vowels", icon: "mic", area: "Jawline", muscles: "Mouth, jaw and cheeks",
    how: "Say a big \"A\" (mouth wide open), then a big \"O\" (lips round and forward). That's one rep.",
    phases: [{ parts: ["jaw"], hold: 0, say: "Big A" }, { parts: ["pucker"], hold: 0, say: "Big O" }], reps: 8, checks: ["front", "level"],
    cues: { low: "", hold: "", relax: "Relax your lips" } },
  { id: "puff", name: "Cheek puff", icon: "droplet", area: "Cheeks", muscles: "Cheeks",
    how: "Close your lips and fill your cheeks with air. Hold, then let it out.",
    phases: [{ parts: ["puff"], hold: 3000 }], reps: 5, checks: ["front", "level", "closed"],
    cues: { low: "Fill your cheeks with air", hold: "Hold the air", relax: "Let it out" } },
  { id: "smile", name: "Smile hold", icon: "smile", area: "Cheeks", muscles: "Cheeks and smile lines",
    how: "Smile wide with your lips closed, lifting both corners evenly. Hold, then relax.",
    phases: [{ parts: ["smile"], hold: 3000 }], reps: 6, checks: ["front", "level", "even"],
    cues: { low: "Smile wider", hold: "Hold the smile", relax: "Relax" } },
  { id: "brow", name: "Forehead lift", icon: "scan", area: "Forehead", muscles: "Forehead and brows",
    how: "Raise your eyebrows as high as you can, hold for a second, then relax.",
    phases: [{ parts: ["brow"], hold: 1000 }], reps: 10, checks: ["front", "level"],
    cues: { low: "Brows higher", hold: "Hold", relax: "Relax" } },
];
export const exById = (id) => EXERCISES.find((e) => e.id === id);

// Daily workout, about 5–6 minutes. Rotates the extra exercise by weekday.
export function workoutFor(date = new Date()) {
  const extra = ["brow", "puff", "smile"][date.getDay() % 3];
  return ["jaw", "fish", "kiss", "vowels", extra];
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const yawOf = (lm) => (lm[1][0] - lm[234][0]) / (lm[454][0] - lm[234][0]) - 0.5;

// One exercise session. Feed frames with update(frame, ms); read the returned state for the screen.
export class RepCounter {
  constructor(ex, { calibFrames = 20 } = {}) {
    this.ex = ex; this.calibFrames = calibFrames;
    this.parts = [...new Set(ex.phases.flatMap((p) => p.parts).concat(["jaw", "up"]))];
    this.samples = Object.fromEntries(this.parts.map((p) => [p, []]));
    this.base = null; this.amp = Object.fromEntries(this.parts.map((p) => [p, AMP[p]]));
    this.reps = 0; this.phase = 0; this.holdMs = 0; this.relaxing = false;
    this.peak = 0; this.repPeak = 0; this.peaks = []; this.sinceProgress = 0; this.adjusted = 0;
    this.good = 0; this.active = 0; this.elapsed = 0; this.lastCue = "";
  }
  get calibrating() { return !this.base; }
  norm(f, part, amp = this.amp[part]) { return (SIG[part](f) - this.base[part]) / amp; }
  update(f, dt = 66) {
    if (!f) return { face: false, cue: "Show your face to the camera", reps: this.reps, calibrating: this.calibrating, norm: 0, holdPct: 0 };
    // 1. calibrate on her relaxed face
    if (!this.base) {
      // after ~6 s of waiting, accept a slightly turned face instead of blocking her
      this.calibWait = (this.calibWait || 0) + dt;
      const front = Math.abs(yawOf(f.lm)) < (this.calibWait > 6000 ? 0.35 : 0.12);
      if (front) { for (const p of this.parts) this.samples[p].push(SIG[p](f)); (this.yaws = this.yaws || []).push(yawOf(f.lm)); }
      const n = this.samples[this.parts[0]].length;
      if (n >= this.calibFrames) { this.base = Object.fromEntries(this.parts.map((p) => [p, median(this.samples[p])])); this.baseYaw = median(this.yaws); }
      return { face: true, calibrating: true, calibPct: n / this.calibFrames, cue: front ? "Relax your face and look at the camera" : "Face the camera", reps: 0, norm: 0, holdPct: 0 };
    }
    this.elapsed += dt;
    const ex = this.ex, ph = ex.phases[this.phase];
    const v = Math.min(...ph.parts.map((p) => this.norm(f, p)));
    const vTrue = Math.min(...ph.parts.map((p) => this.norm(f, p, AMP[p])));
    // 2. form checks
    let form = "";
    const usesUp = ph.parts.includes("up");
    if (ex.checks.includes("front") && Math.abs(yawOf(f.lm) - this.baseYaw) > 0.13) form = "Face the camera";
    else if (ex.checks.includes("level") && !usesUp && Math.abs(this.norm(f, "up", AMP.up)) > 0.8) form = "Keep your chin level";
    else if (ex.checks.includes("closed") && this.norm(f, "jaw", AMP.jaw) > 0.6) form = "Keep your lips together";
    else if (ex.checks.includes("even") && v > 0.5 && Math.abs((f.bs.mouthSmileLeft || 0) - (f.bs.mouthSmileRight || 0)) > 0.25) form = "Even out both sides";
    const working = v > 0.25 || this.holdMs > 0;
    if (working) { this.active++; if (!form) this.good++; }
    // 3. rep state machine: reach full range (and hold) in each phase, then relax
    let cue = "", repDone = false;
    if (this.relaxing) {
      cue = ex.cues.relax;
      if (v < 0.35) {
        this.relaxing = false; this.reps++; repDone = true; this.sinceProgress = 0;
        this.peaks.push(this.repPeak); this.repPeak = 0; this.phase = 0;
      }
    } else {
      this.repPeak = Math.max(this.repPeak, vTrue);
      this.peak = Math.max(this.peak, v);
      if (v >= 1 && !form) {
        this.holdMs += dt;
        cue = ph.hold ? `${ex.cues.hold} · ${Math.max(1, Math.ceil((ph.hold - this.holdMs) / 1000))}` : "";
        if (this.holdMs >= ph.hold) {
          this.holdMs = 0; this.sinceProgress = 0; this.peak = 0;
          if (this.phase < ex.phases.length - 1) this.phase++; else this.relaxing = true;
        }
      } else {
        if (v < 0.8 || form) this.holdMs = 0;
        cue = form || ph.say || (v > 0.6 && v < 1 ? "Almost there" : ex.cues.low);
        this.sinceProgress += dt;
        // 4. too hard for her right now? fit the target to her range (at most twice, never below 55%)
        if (this.sinceProgress > 12000 && this.peak > 0.45 && this.adjusted < 2) {
          for (const p of ph.parts) this.amp[p] = Math.max(AMP[p] * 0.55, this.amp[p] * Math.max(0.6, this.peak * 0.95));
          this.adjusted++; this.sinceProgress = 0; this.peak = 0; cue = "Adjusted to your range";
        }
      }
    }
    if (form) cue = form;
    const nextPh = ex.phases[this.phase];
    return {
      face: true, calibrating: false, reps: this.reps, target: ex.reps, done: this.reps >= ex.reps, repDone,
      norm: Math.max(0, Math.min(1.3, v)), phase: this.phase, say: nextPh.say || "", relaxing: this.relaxing,
      holdPct: ph.hold ? Math.min(1, this.holdMs / ph.hold) : 0, cue, formOk: !form, adjusted: this.adjusted,
    };
  }
  // Summary saved after the exercise. rom = average reach per rep, 100 = the full standard range.
  result() {
    const rom = this.peaks.length ? Math.round(Math.min(1.5, this.peaks.reduce((a, b) => a + b, 0) / this.peaks.length) * 100) : 0;
    return { id: this.ex.id, reps: this.reps, target: this.ex.reps, rom, form: this.active ? Math.round((this.good / this.active) * 100) : 100, secs: Math.round(this.elapsed / 1000) };
  }
}
