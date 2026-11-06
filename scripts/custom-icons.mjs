// Hand-drawn icons for the Looks tiles (Hugeicons Free has no hair, brow or beard icons).
// Same grid as Hugeicons: 24 px box, 1.5 stroke, round caps, currentColor. Merged into icons.js by build-icons.mjs.
const S = 'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"';
const p = (d, extra = "") => `<path d="${d}" ${S} ${extra}/>`;
const FACE = p("M7.5 12.5C7.5 9.7 9.5 8 12 8s4.5 1.7 4.5 4.5v1c0 3-2 5-4.5 5s-4.5-2-4.5-5z"); // front face
export const CUSTOM = {
  // hairstyles: a head with the cut drawn around it
  hair_bangs: p("M6 14V11C6 6.5 8.5 4 12 4s6 2.5 6 7v3") + p("M12 5.5C11.6 8 9.6 9.6 7.2 10.2M12 5.5C12.4 8 14.4 9.6 16.8 10.2") + p("M8.5 13c0 3 1.6 5 3.5 5s3.5-2 3.5-5"),
  hair_bob: p("M5.5 18V11C5.5 6.5 8.4 4 12 4s6.5 2.5 6.5 7v7") + p("M5.5 18h3M18.5 18h-3") + p("M8.5 18v-6.5c0-1.5 1.4-2.5 3.5-2.5s3.5 1 3.5 2.5V18"),
  hair_long: p("M6 21V11C6 6.5 8.5 4 12 4s6 2.5 6 7v10") + p("M6 21l1.5-2M18 21l-1.5-2M9 21l.5-2M15 21l-.5-2") + p("M9 16V11.5C9 10 10.2 9 12 9s3 1 3 2.5V16c0 1-1.3 2-3 2s-3-1-3-2z"),
  hair_curls: p("M6.2 10.5a3 3 0 0 1 2.3-4.3A3 3 0 0 1 12 4a3 3 0 0 1 3.5 2.2 3 3 0 0 1 2.3 4.3") + p("M6.2 10.5a2.4 2.4 0 0 0-.9 3.6M17.8 10.5a2.4 2.4 0 0 1 .9 3.6") + p("M8.5 13c0 3 1.6 5 3.5 5s3.5-2 3.5-5V11H8.5z"),
  hair_pixie: p("M7 12C7 7 9 5 12 5s5 2 5 7") + p("M7 12c3-.3 6-1.8 7.5-4.5M17 12c-.5-1.5-1-2.5-2.5-4.5") + p("M7.5 12.5c0 3 1.7 5 4.5 5s4.5-2 4.5-5"),
  hair_buzz: p("M7 12C7 7.5 9 5.5 12 5.5s5 2 5 6.5", 'stroke-dasharray="0.1 2.4" stroke-width="2.2"') + p("M7.5 12.5c0 3 1.7 5.5 4.5 5.5s4.5-2.5 4.5-5.5") + p("M7.5 12.5h9", 'stroke-opacity="0"'),
  hair_slick: p("M7 13V11C7 7 9 5 12.5 5c2.5 0 4.5 1.5 4.5 4.5") + p("M7.5 9.5C10 8 13 8 16 9M8 7c2-1 5-1 7.5.5M7 11.5c2.5-1 6-1 9.5 0") + p("M7.5 13c0 3 1.7 5 4.5 5s4.5-2 4.5-5"),
  // braids
  braid_one: p("M12 4v1.5") + p("M9.5 6c2.5 1 2.5 3 0 4s-2.5 3 0 4 2.5 3 0 4M14.5 6c-2.5 1-2.5 3 0 4s2.5 3 0 4-2.5 3 0 4") + p("M10.5 3h3"),
  braid_two: p("M7 6c1.7.8 1.7 2.4 0 3.2S5.3 12 7 12.8s1.7 2.4 0 3.2M17 6c-1.7.8-1.7 2.4 0 3.2s1.7 2.8 0 3.6-1.7 2.4 0 3.2") + p("M9.5 11.5c0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5v1c0 2-1 3.3-2.5 3.3s-2.5-1.3-2.5-3.3z") + p("M9 9c0-2.5 1.2-4 3-4s3 1.5 3 4"),
  braid_crown: p("M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z", 'stroke-dasharray="2.6 1.6"') + p("M9 12.5c0-1.7 1.2-3 3-3s3 1.3 3 3v.5c0 2-1.2 3.5-3 3.5s-3-1.5-3-3.5z"),
  braid_box: p("M6 10C6 6 8.5 4 12 4s6 2 6 6") + p("M7 10v10M9.7 7.5v12.5M12 7v13M14.3 7.5v12.5M17 10v10", 'stroke-dasharray="1.2 1.6"'),
  // brows (two brows over two eyes)
  brow_full: p("M4.5 10.5c1.3-1.6 4.4-2 6.5-.7M13 9.8c2.1-1.3 5.2-.9 6.5.7", 'stroke-width="3"') + p("M8 15.5h.01M16 15.5h.01", 'stroke-width="2"'),
  brow_straight: p("M4.5 10h6.5M13 10h6.5", 'stroke-width="2.2"') + p("M8 15.5h.01M16 15.5h.01", 'stroke-width="2"'),
  brow_arched: p("M4.5 11.5c1.5-3 4.5-4 6.5-2.5M13 9c2-1.5 5-.5 6.5 2.5") + p("M8 15.5h.01M16 15.5h.01", 'stroke-width="2"'),
  brow_bold: p("M4.5 10.5l6.5-1.2M13 9.3l6.5 1.2", 'stroke-width="4"') + p("M8 15.5h.01M16 15.5h.01", 'stroke-width="2"'),
  // beards and mustache: lower face with the hair drawn on it
  mustache: p("M12 12c-.9-1.4-3.6-1.9-5.8-.4-1 .7-1.8.5-2.2.2.3 2 2.6 2.7 4.4 2.1 1.4-.5 2.7-1.6 3.6-1.9.9.3 2.2 1.4 3.6 1.9 1.8.6 4.1-.1 4.4-2.1-.4.3-1.2.5-2.2-.2-2.2-1.5-4.9-1-5.8.4z"),
  stubble: p("M6.5 8v4.5c0 3.4 2.4 6 5.5 6s5.5-2.6 5.5-6V8") + p("M9.5 14h.01M12 15.5h.01M14.5 14h.01M10.5 17h.01M13.5 17h.01M12 12.8h.01", 'stroke-width="2"'),
  beard_short: p("M6.5 8v4.5c0 3.4 2.4 6 5.5 6s5.5-2.6 5.5-6V8") + p("M6.5 12c.8 3.2 2.6 4.5 5.5 4.5s4.7-1.3 5.5-4.5") + p("M10.5 14.3h3"),
  beard_full: p("M6 7.5v6c0 4 2.5 7 6 7s6-3 6-7v-6") + p("M6 12c1.3-1.7 2.5-2 4-1.6.7.2 1.4.2 2 0 .6.2 1.3.2 2 0 1.5-.4 2.7-.1 4 1.6") + p("M10.5 15.2c.9.5 2.1.5 3 0"),
  beard_goatee: p("M6.5 8v4.5c0 3.4 2.4 6 5.5 6s5.5-2.6 5.5-6V8") + p("M9.8 15.5c.3 2 1.1 3 2.2 3s1.9-1 2.2-3c-.7.5-1.4.6-2.2.6s-1.5-.1-2.2-.6z"),
  clean_face: p("M6.5 8v4.5c0 3.4 2.4 6 5.5 6s5.5-2.6 5.5-6V8") + p("M10 15.3c1.3 1 2.7 1 4 0"),
};
