/**
 * §7 — illustrative near-rendered studio assets (unified naming, 40–64px).
 *
 *   public/assets/studio/brush-<id>.svg      ×7   (pen marker pencil calligraphy airbrush spray glow)
 *   public/assets/studio/stitch-<id>.svg     ×8   (straight broken rect blanket feather frayed overlock satin)
 *   public/assets/studio/hardware-<id>.svg   ×7   (zipper zipper-sketch chain rip camo denim sequin)
 *   public/assets/studio/line-<id>.svg       ×6   (solid dashed dotted zigzag double wavy)
 *   public/assets/studio/symmetry.svg        ×1
 *   public/assets/studio/deco-<id>.svg       ×18  (12 print + 6 embroidery treatments on real fabric)
 *
 * Every swatch sits on a woven-fabric mini background so each option reads
 * as "the real result on fabric", not a label. Run:  node scripts/gen-studio-assets.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "assets", "studio");
mkdirSync(OUT, { recursive: true });

const save = (name, svg) => writeFileSync(join(OUT, name), svg.replace(/\s+</g, "<").trim());
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/* ---------- shared pieces ---------- */

// woven fabric background (twill-like diagonal weave + warp/weft lines)
function fabric(w, h, base = "#3b5a8c", dark = "#2c456e") {
  return `
  <defs>
    <pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="${base}"/>
      <rect width="3" height="6" fill="${dark}" opacity="0.55"/>
    </pattern>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="10" fill="url(#weave)"/>
  <rect width="${w}" height="${h}" rx="10" fill="url(#sheen)"/>
  <rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="9.5" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1.5"/>`;
}

// a thread stroke: colored band + light gloss line, reads as raised thread
const thread = (d, color = "#e8e2d4", sw = 3.2) => `
  <path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="${Math.max(1, sw / 3)}" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,-0.8)"/>`;

/* ============================== 7 brushes ============================== */
// §7a — near-realistic tool renders (reference: dark matte bodies, metallic
// nibs, soft floor shadow) + a small sample of the stroke each one makes.

const BRUSHES = {
  pen: `
    <ellipse cx="21" cy="38.5" rx="8" ry="1.8" fill="#000" opacity="0.5"/>
    <defs>
      <linearGradient id="penBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#454e5e"/><stop offset="0.35" stop-color="#232a36"/>
        <stop offset="0.75" stop-color="#171c26"/><stop offset="1" stop-color="#2e3542"/>
      </linearGradient>
      <linearGradient id="penNib" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f2f6fb"/><stop offset="0.45" stop-color="#aab4c2"/>
        <stop offset="1" stop-color="#5f6a7a"/>
      </linearGradient>
    </defs>
    <rect x="24.5" y="7" width="7.5" height="21" rx="3.4" fill="url(#penBody)"/>
    <rect x="24.5" y="10" width="1.8" height="14" rx="0.9" fill="#e11d48" opacity="0.85"/>
    <path d="M25 27.5 h6.5 l-3.25 8.5 z" fill="url(#penNib)"/>
    <path d="M28.25 34 l0 2" stroke="#1a2030" stroke-width="0.9"/>
    <path d="M7 38.5 q7 -1.5 13 -6.5" stroke="#38bdf8" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  marker: `
    <ellipse cx="21" cy="38.5" rx="9" ry="1.8" fill="#000" opacity="0.5"/>
    <defs>
      <linearGradient id="mkBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#5b3a86"/><stop offset="0.4" stop-color="#3b2158"/>
        <stop offset="1" stop-color="#241238"/>
      </linearGradient>
      <linearGradient id="mkTip" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#cdd4de"/><stop offset="1" stop-color="#767f8d"/>
      </linearGradient>
    </defs>
    <rect x="25" y="5" width="9.5" height="21" rx="3" fill="url(#mkBody)"/>
    <rect x="25" y="8.5" width="9.5" height="2.4" fill="#d946ef" opacity="0.9"/>
    <path d="M26.2 26 h7 l1.4 4.2 -4.9 1.6 -4.9 -1.6 z" fill="url(#mkTip)"/>
    <path d="M28.4 30.4 l2.5 3 2.6 -3.2" fill="#575f6d"/>
    <path d="M6.5 38 q7 -1 12 -6" stroke="#d946ef" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.9"/>`,
  pencil: `
    <ellipse cx="21" cy="38.5" rx="8" ry="1.8" fill="#000" opacity="0.5"/>
    <defs>
      <linearGradient id="pcWood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#e8b571"/><stop offset="0.45" stop-color="#c98d43"/>
        <stop offset="1" stop-color="#9c6a2c"/>
      </linearGradient>
    </defs>
    <rect x="24.8" y="10" width="7.6" height="17" fill="url(#pcWood)"/>
    <path d="M24.8 10 h7.6 v-1.6 q0 -1.4 -1.4 -1.4 h-4.8 q-1.4 0 -1.4 1.4 z" fill="#f472b6"/>
    <rect x="24.3" y="5.6" width="8.6" height="2" rx="0.8" fill="#aab4c2"/>
    <path d="M24.8 27 h7.6 l-3.8 7.5 z" fill="#e9d3ac"/>
    <path d="M27.3 32.1 l1.3 2.4 1.3 -2.4 z" fill="#181818"/>
    <path d="M24.8 13.2 h7.6 M24.8 20.8 h7.6" stroke="#8a5a20" stroke-width="0.5" opacity="0.6"/>
    <path d="M6 39 q8 -0.5 13.5 -5.5" stroke="#b07b3a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-dasharray="2 2"/>`,
  calligraphy: `
    <ellipse cx="21" cy="38.5" rx="8" ry="1.8" fill="#000" opacity="0.5"/>
    <defs>
      <linearGradient id="cpBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#3a4150"/><stop offset="0.4" stop-color="#10141c"/>
        <stop offset="1" stop-color="#252b38"/>
      </linearGradient>
      <linearGradient id="cpNib" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#b8c2d0"/>
        <stop offset="1" stop-color="#68737f"/>
      </linearGradient>
    </defs>
    <rect x="25" y="9" width="7.4" height="15" rx="2.6" fill="url(#cpBody)"/>
    <rect x="25.6" y="9.8" width="1.4" height="12.5" rx="0.7" fill="#ffffff" opacity="0.18"/>
    <path d="M25.4 24 h6.6 l-1.2 3.2 h-4.2 z" fill="#39414f"/>
    <path d="M26.4 27 h4.8 l-2.4 9.5 q-2.4 -7 -2.4 -9.5 z" fill="url(#cpNib)"/>
    <circle cx="28.8" cy="30.2" r="0.9" fill="#39414f"/>
    <path d="M28.8 30.2 v5" stroke="#39414f" stroke-width="0.6"/>
    <path d="M6.5 37.5 q5 -11 11 -5.5 t11 -7.5" stroke="#0b1220" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
  airbrush: `
    <ellipse cx="21" cy="38.5" rx="9" ry="1.8" fill="#000" opacity="0.5"/>
    <defs>
      <linearGradient id="abBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#cbd5e1"/><stop offset="0.35" stop-color="#8e9aab"/>
        <stop offset="0.75" stop-color="#4b5563"/><stop offset="1" stop-color="#6b7686"/>
      </linearGradient>
      <radialGradient id="abMist" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#7dd3fc" stop-opacity="0.7"/>
        <stop offset="1" stop-color="#7dd3fc" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="26" y="8" width="8" height="18" rx="3.6" fill="url(#abBody)"/>
    <rect x="27.8" y="4.6" width="4.4" height="3.6" rx="1.2" fill="#39414f"/>
    <rect x="29" y="3" width="2" height="2" rx="0.8" fill="#22d3ee"/>
    <path d="M27.5 26 h5 l-1.1 3.4 h-2.8 z" fill="#39414f"/>
    <path d="M28.6 29.4 h2.8 l-1.4 3 z" fill="#aab4c2"/>
    <ellipse cx="15" cy="33" rx="9" ry="7" fill="url(#abMist)"/>
    <circle cx="14" cy="33" r="2.2" fill="#38bdf8" opacity="0.65"/>
    <circle cx="20" cy="29" r="0.9" fill="#7dd3fc" opacity="0.8"/><circle cx="21" cy="35" r="0.8" fill="#7dd3fc" opacity="0.7"/>`,
  spray: `
    <ellipse cx="21" cy="38.5" rx="9" ry="1.8" fill="#000" opacity="0.5"/>
    <defs>
      <linearGradient id="spBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#84cc16"/><stop offset="0.35" stop-color="#4d7c0f"/>
        <stop offset="1" stop-color="#365314"/>
      </linearGradient>
    </defs>
    <rect x="26" y="9" width="9" height="20" rx="2.6" fill="url(#spBody)"/>
    <rect x="26" y="13" width="9" height="4.6" fill="#0f172a" opacity="0.35"/>
    <rect x="28.4" y="5.2" width="4.2" height="4" rx="1" fill="#d9f99d"/>
    <rect x="29.4" y="3.2" width="2.2" height="2.2" rx="0.8" fill="#84cc16"/>
    <g fill="#a3e635">
      ${[[9, 30, 1.6], [13, 26, 1.2], [17, 31, 2], [21, 27, 1.3], [11, 35, 1.4], [18, 36, 1.1], [13, 31, 0.9], [7, 33, 1.2], [16, 24, 0.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity="${0.4 + r * 0.25}"/>`).join("")}
    </g>`,
  glow: `
    <ellipse cx="21" cy="38.5" rx="8" ry="1.8" fill="#000" opacity="0.4"/>
    <defs>
      <linearGradient id="glBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#312e81"/><stop offset="0.4" stop-color="#14163a"/>
        <stop offset="1" stop-color="#1e1b4b"/>
      </linearGradient>
      <radialGradient id="glTip" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#a5f3fc"/><stop offset="0.45" stop-color="#22d3ee" stop-opacity="0.85"/>
        <stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="24.8" y="6" width="7.8" height="22" rx="3.6" fill="url(#glBody)"/>
    <rect x="27.2" y="8.4" width="3" height="17" rx="1.5" fill="#22d3ee" opacity="0.55"/>
    <circle cx="28.7" cy="30.5" r="5.6" fill="url(#glTip)"/>
    <circle cx="28.7" cy="30.5" r="2" fill="#ecfeff">
      <animate attributeName="opacity" values="1;0.45;1" dur="1.6s" repeatCount="indefinite"/>
    </circle>
    <path d="M6 37 q8 -12 16 -3" stroke="#22d3ee" stroke-width="4.6" fill="none" stroke-linecap="round" opacity="0.25"/>
    <path d="M6 37 q8 -12 16 -3" stroke="#22d3ee" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="0.55"/>
    <path d="M6 37 q8 -12 16 -3" stroke="#cffafe" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
};
for (const [id, body] of Object.entries(BRUSHES)) {
  save(`brush-${id}.svg`, svg(44, 44, `
    <rect width="44" height="44" rx="10" fill="#0d1117"/>
    <rect x="0.75" y="0.75" width="42.5" height="42.5" rx="9.5" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1.5"/>
    ${body}`));
}

/* ============================== 8 stitches ============================== */
// each on a real fabric swatch, thread drawn with gloss

const STITCHES = {
  straight: thread("M6 20 H50", "#f5f0e6", 3),
  broken: thread("M6 20 h5 m3 0 h5 m3 0 h5 m3 0 h5 m3 0 h5", "#f5f0e6", 3),
  rect: thread("M10 26 H46 M10 14 H46 M10 14 V26 M46 14 V26", "#f5f0e6", 2.6),
  blanket: `
    <path d="M6 14 H50" fill="none" stroke="#f5f0e6" stroke-width="2.6" stroke-linecap="round"/>
    ${Array.from({ length: 8 }).map((_, i) => {
      const x = 8 + i * 5.4;
      return thread(`M${x} 14 L${x - 2.4} 20 L${x + 2} 25`, "#f5f0e6", 2.2);
    }).join("")}`,
  feather: `
    ${Array.from({ length: 5 }).map((_, i) => {
      const x = 10 + i * 8;
      return thread(`M${x} 20 Q${x + 3} 12 ${x + 6} 20 M${x + 1.5} 20 Q${x + 4.5} 28 ${x + 7.5} 20`, "#f5f0e6", 2.2);
    }).join("")}`,
  frayed: `
    ${Array.from({ length: 14 }).map((_, i) => {
      const x = 7 + i * 3;
      const h = 8 + ((i * 13) % 9);
      return `<line x1="${x}" y1="16" x2="${x - 1.5}" y2="${16 + h}" stroke="#e8e2d4" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>`;
    }).join("")}
    <path d="M6 16 H50" stroke="#f5f0e6" stroke-width="2.4" stroke-linecap="round"/>`,
  overlock: `
    ${Array.from({ length: 9 }).map((_, i) => {
      const x = 8 + i * 4.6;
      return thread(`M${x} 24 L${x + 3.4} 13 M${x + 1.6} 24 L${x + 5} 13`, "#f5f0e6", 2);
    }).join("")}
    ${thread("M6 25 H50", "#f5f0e6", 2.6)}`,
  satin: `
    ${Array.from({ length: 9 }).map((_, i) => {
      const x = 10 + i * 4;
      return thread(`M${x} 12 L${x - 1.4} 28`, "#eab6d3", 2.8);
    }).join("")}`,
};
for (const [id, body] of Object.entries(STITCHES)) {
  save(`stitch-${id}.svg`, svg(56, 40, fabric(56, 40) + body));
}

/* ========================= 7 hardware / textures ======================== */

const HARDWARE = {
  zipper: `
    <rect x="8" y="8" width="40" height="24" rx="3" fill="#111827" opacity="0.25"/>
    ${Array.from({ length: 9 }).map((_, i) => `<rect x="${10 + i * 4}" y="10" width="3" height="7" rx="0.8" fill="#d1d5db" stroke="#6b7280" stroke-width="0.5"/><rect x="${12 + i * 4}" y="19" width="3" height="7" rx="0.8" fill="#9ca3af" stroke="#4b5563" stroke-width="0.5"/>`).join("")}
    <rect x="24" y="26" width="8" height="10" rx="2.5" fill="none" stroke="#e5e7eb" stroke-width="2.4"/>
    <circle cx="28" cy="24" r="1.6" fill="#e5e7eb"/>`,
  "zipper-sketch": `
    <path d="M10 10 q3 5 0 10 t0 10" fill="none" stroke="#e5e7eb" stroke-width="1.8" stroke-dasharray="3 2.4"/>
    <path d="M46 10 q-3 5 0 10 t0 10" fill="none" stroke="#e5e7eb" stroke-width="1.8" stroke-dasharray="3 2.4"/>
    <path d="M14 28 h24" stroke="#f8fafc" stroke-width="2" stroke-dasharray="4 3"/>
    <path d="M26 24 l4 4 -4 4" fill="none" stroke="#f8fafc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  chain: `
    ${Array.from({ length: 5 }).map((_, i) =>
      `<ellipse cx="${12 + i * 8}" cy="20" rx="6.5" ry="4.5" fill="none" stroke="${i % 2 ? "#e5e7eb" : "#9ca3af"}" stroke-width="3" transform="rotate(${i % 2 ? 0 : 90} ${12 + i * 8} 20)"/>`
    ).join("")}
    ${Array.from({ length: 5 }).map((_, i) =>
      i % 2 ? `<ellipse cx="${12 + i * 8}" cy="19" rx="6.5" ry="4.5" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1" transform="rotate(0 ${12 + i * 8} 19)"/>` : ""
    ).join("")}`,
  rip: `
    <path d="M8 12 L22 17 L16 24 L30 21 L26 30 L40 26 L36 32 L48 28" fill="none" stroke="#0b1020" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M11 14 L23 18.4 L17.6 23 L29 20.6 L25.6 27.6 L37 24.4" fill="#060a14" opacity="0.9"/>
    ${[[14, 18, 22, 21], [22, 22, 30, 25], [30, 26, 38, 28]].map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#dbe4ff" stroke-width="0.9" opacity="0.7"/>`).join("")}`,
  camo: `
    <g stroke="#0b1020" stroke-opacity="0.35" stroke-width="1">
      <path d="M6 8 q8 2 10 8 t-6 8 q-8 0 -8 -8 z" fill="#3f5136"/>
      <path d="M28 6 q10 0 12 7 t-8 9 q-8 -2 -8 -8 z" fill="#6b7256"/>
      <path d="M40 22 q8 2 6 9 t-10 3 q-4 -6 4 -12z" fill="#2f3b28"/>
      <path d="M8 28 q9 -1 12 5 t-7 7 q-7 -1 -7 -7 z" fill="#565f3f"/>
    </g>`,
  denim: `
    <g stroke="#dbeafe" stroke-opacity="0.5" stroke-width="1.1">
      ${Array.from({ length: 6 }).map((_, i) => `<line x1="8" y1="${10 + i * 4}" x2="48" y2="${10 + i * 4}"/>`).join("")}
      ${Array.from({ length: 6 }).map((_, i) => `<line x1="${12 + i * 6}" y1="8" x2="${12 + i * 6}" y2="32"/>`).join("")}
    </g>
    <line x1="8" y1="20" x2="48" y2="20" stroke="#fbbf24" stroke-width="1.6" stroke-dasharray="3 2" opacity="0.9"/>`,
  sequin: `
    ${[[12, 12], [20, 10], [28, 13], [36, 10], [44, 13], [16, 19], [24, 20], [32, 18], [40, 20], [12, 26], [20, 27], [28, 26], [36, 28], [44, 26]].map(([x, y], i) =>
      `<circle cx="${x}" cy="${y}" r="3.4" fill="${["#f0abfc", "#67e8f9", "#fde68a", "#a5b4fc"][i % 4]}" stroke="#ffffff" stroke-opacity="0.6" stroke-width="0.7"/><circle cx="${x - 1}" cy="${y - 1.2}" r="1" fill="#ffffff" opacity="0.85"/>`
    ).join("")}`,
};
for (const [id, body] of Object.entries(HARDWARE)) {
  save(`hardware-${id}.svg`, svg(56, 40, fabric(56, 40) + body));
}

/* ===================== 6 line styles + symmetry ======================== */

const LINES = {
  solid: thread("M8 20 H48", "#e2e8f0", 3),
  dashed: thread("M8 20 h6 m4 0 h6 m4 0 h6 m4 0 h6", "#e2e8f0", 3),
  dotted: thread("M9 20 h1.4 M15 20 h1.4 M21 20 h1.4 M27 20 h1.4 M33 20 h1.4 M39 20 h1.4 M45 20 h1.4", "#e2e8f0", 3),
  zigzag: thread("M8 24 l5 -8 5 8 5 -8 5 8 5 -8 5 8", "#e2e8f0", 2.8),
  double: thread("M8 16 H48 M8 24 H48", "#e2e8f0", 2.6),
  wavy: thread("M8 20 q5 -7 10 0 t10 0 t10 0 t10 0", "#e2e8f0", 2.8),
};
for (const [id, body] of Object.entries(LINES)) {
  save(`line-${id}.svg`, svg(56, 40, fabric(56, 40, "#22283a", "#171b2a") + body));
}

// symmetry diagram: garment half mirrored with a center axis + arrows
save("symmetry.svg", svg(56, 40, `
  <rect width="56" height="40" rx="10" fill="#0d1117"/>
  <rect x="0.75" y="0.75" width="54.5" height="38.5" rx="9.5" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1.5"/>
  <line x1="28" y1="6" x2="28" y2="34" stroke="#22d3ee" stroke-width="1.6" stroke-dasharray="3 2.4"/>
  <path d="M16 14 q-6 6 0 12 M40 14 q6 6 0 12" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M12 24 l4 2 0 -4 z M44 24 l-4 2 0 -4 z" fill="#94a3b8"/>
  <circle cx="20" cy="20" r="2.4" fill="#f0abfc"/>
  <circle cx="36" cy="20" r="2.4" fill="#f0abfc"/>`));

/* ==================== 18 print / embroidery treatments ================== */
// each = the real result rendered on a fabric swatch

const DECO = {
  // ---- ink & print (12) ----
  screen: `
    <rect x="8" y="10" width="40" height="20" rx="3" fill="#e2e8f0" opacity="0.95"/>
    <g fill="#3b82f6">${Array.from({ length: 40 }).map((_, i) => `<circle cx="${10 + (i % 8) * 5}" cy="${13 + Math.floor(i / 8) * 5}" r="1.5"/>`).join("")}</g>
    <text x="28" y="38" font-size="6" text-anchor="middle" fill="#ffffff" opacity="0.65" font-family="sans-serif">halftone</text>`,
  rubber: `
    <path d="M14 22 q14 -10 28 0" stroke="#111827" stroke-opacity="0.4" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M14 21 q14 -10 28 0" stroke="#f43f5e" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M17 19 q11 -7 22 0" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  embossed: `
    <path d="M14 24 q14 -12 28 0" stroke="#0b1020" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.45" transform="translate(0,1.6)"/>
    <path d="M14 22 q14 -12 28 0" stroke="#8ea0c0" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M14 22 q14 -12 28 0" stroke="#d7e0f2" stroke-width="2.4" fill="none" stroke-linecap="round" transform="translate(0,-1.4)"/>`,
  silicon: `
    <ellipse cx="28" cy="20" rx="13" ry="8" fill="#0ea5e9" opacity="0.85"/>
    <ellipse cx="28" cy="19" rx="13" ry="8" fill="none" stroke="#e0f2fe" stroke-width="1.4"/>
    <ellipse cx="24" cy="16.5" rx="3.4" ry="1.8" fill="#ffffff" opacity="0.85"/>`,
  "high-density": `
    ${[0, 1, 2].map((i) => `<path d="M${12 + i * 1.2} ${23 - i * 2.4} q14 -8 28 0" stroke="#111827" stroke-width="3.4" fill="none" stroke-linecap="round" opacity="${0.5 + i * 0.25}"/>`).join("")}
    <path d="M14.4 18.2 q14 -8 28 0" stroke="#f8fafc" stroke-opacity="0.4" stroke-width="1" fill="none"/>`,
  puff: `
    <path d="M14 24 q14 -13 28 0" stroke="#0b1020" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.5" transform="translate(1,2.2)"/>
    <path d="M13 22 q14 -13 28 0" stroke="#a855f7" stroke-width="8.5" fill="none" stroke-linecap="round"/>
    <path d="M16 19.4 q11 -8.4 22 0" stroke="#e9d5ff" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.9"/>`,
  stamp: `
    <rect x="10" y="10" width="36" height="20" rx="2" fill="none" stroke="#fde68a" stroke-width="2" stroke-dasharray="4 3" opacity="0.9"/>
    <path d="M18 20 q5 -6 9 0 t9 0" stroke="#fde68a" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.8"/>
    <circle cx="16" cy="14" r="1.2" fill="#fde68a" opacity="0.5"/><circle cx="42" cy="27" r="1.4" fill="#fde68a" opacity="0.5"/>`,
  bleach: `
    <circle cx="24" cy="19" r="8" fill="#dbeafe" opacity="0.85"/>
    <circle cx="33" cy="24" r="5" fill="#bfdbfe" opacity="0.7"/>
    <circle cx="17" cy="26" r="3" fill="#eff6ff" opacity="0.6"/>
    <path d="M31 10 q2 -3 5 -4 M36 12 q3 -2 5 -2" stroke="#dbeafe" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.7"/>`,
  foil: `
    <path d="M12 24 q16 -13 32 0" stroke="url(#foilg)" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M15 21.5 q13 -9 26 0" stroke="#ffffff" stroke-opacity="0.9" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <path d="M15 25 q13 -9 26 0" stroke="#7c2d12" stroke-opacity="0.35" stroke-width="1.2" fill="none"/>`,
  glow: `
    <rect width="56" height="40" rx="10" fill="#05070d" opacity="0.55"/>
    <path d="M12 22 q16 -12 32 0" stroke="#22c55e" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.18"/>
    <path d="M12 22 q16 -12 32 0" stroke="#4ade80" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.35"/>
    <path d="M12 22 q16 -12 32 0" stroke="#bbf7d0" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <text x="28" y="36" font-size="5.4" text-anchor="middle" fill="#86efac" font-family="sans-serif" opacity="0.85">glow in dark</text>`,
  sun: `
    <circle cx="20" cy="18" r="7.5" fill="#f97316" opacity="0.9"/>
    <circle cx="20" cy="18" r="10" fill="none" stroke="#fdba74" stroke-width="1.4" stroke-dasharray="2 2.4" opacity="0.8"/>
    <circle cx="38" cy="22" r="7.5" fill="#fbbf24" opacity="0.55"/>
    ${[[-4, -8], [5, -7], [8, 3]].map(([dx, dy]) => `<circle cx="${20 + dx}" cy="${18 + dy}" r="1.4" fill="#fed7aa"/>`).join("")}`,
  laser: `
    <rect x="12" y="11" width="32" height="18" rx="2" fill="#1f2937" opacity="0.85"/>
    <path d="M16 16 h24 M16 20 h24 M16 24 h24" stroke="#c2b49a" stroke-width="1.1" opacity="0.75"/>
    <path d="M16 18 h24 M16 22 h24" stroke="#8b7355" stroke-width="0.7" opacity="0.6"/>
    <text x="28" y="36" font-size="5.4" text-anchor="middle" fill="#d6c9ae" font-family="sans-serif" opacity="0.9">etched</text>`,
  // ---- embroidery & applied (6) ----
  tonal: `
    <path d="M13 24 q15 -12 30 0" stroke="#4e6ca8" stroke-width="6.5" fill="none" stroke-linecap="round"/>
    <path d="M13 24 q15 -12 30 0" stroke="#7d99cf" stroke-width="1.2" stroke-dasharray="1.6 1.2" fill="none" opacity="0.8"/>
    <text x="28" y="37" font-size="5.4" text-anchor="middle" fill="#ffffff" opacity="0.55" font-family="sans-serif">tone on tone</text>`,
  chenille: `
    <path d="M12 24 q16 -12 32 0" stroke="#ec4899" stroke-width="8.5" fill="none" stroke-linecap="round"/>
    ${Array.from({ length: 22 }).map((_, i) => {
      const x = 13 + i * 1.9;
      const y = 24 - Math.sin((i / 21) * Math.PI) * 8.4;
      return `<line x1="${x}" y1="${y}" x2="${x - 0.8}" y2="${y - 2.6}" stroke="#f9a8d4" stroke-width="1" stroke-linecap="round" opacity="0.9"/>`;
    }).join("")}`,
  flat: `
    <path d="M13 22 q15 -10 30 0" stroke="#f59e0b" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g stroke="#d97706" stroke-width="0.9" opacity="0.9">
      ${Array.from({ length: 13 }).map((_, i) => `<line x1="${15 + i * 2.1}" y1="${19.4 - Math.sin((i / 12) * Math.PI) * 3.4}" x2="${15 + i * 2.1}" y2="${24 + Math.sin((i / 12) * Math.PI) * 1.2}"/>`).join("")}
    </g>`,
  "puff-emb": `
    <path d="M12 25 q16 -14 32 0" stroke="#0b1020" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.5" transform="translate(1.4,2.4)"/>
    <path d="M11 22.6 q16 -14 32 0" stroke="#10b981" stroke-width="9" fill="none" stroke-linecap="round"/>
    ${Array.from({ length: 14 }).map((_, i) => {
      const x = 13.5 + i * 2;
      const y = 22.6 - Math.sin((i / 13) * Math.PI) * 9.4;
      return `<line x1="${x}" y1="${y + 1}" x2="${x + 0.6}" y2="${y - 2.2}" stroke="#6ee7b7" stroke-width="1.1" stroke-linecap="round" opacity="0.95"/>`;
    }).join("")}`,
  applique: `
    <path d="M14 25 L28 13 L42 25 Z" fill="#f43f5e" stroke="#ffffff" stroke-width="2.4"/>
    <path d="M14 25 L28 13 L42 25" fill="none" stroke="#fecdd3" stroke-width="1" stroke-dasharray="2 1.6" transform="translate(0,0)"/>
    <path d="M12 26 L28 12 L44 26" fill="none" stroke="#be123c" stroke-width="1.2" stroke-dasharray="2.4 2"/>`,
  patch: `
    <rect x="12" y="11" width="32" height="18" rx="9" fill="#facc15" stroke="#1f2937" stroke-width="2"/>
    <rect x="14.5" y="13.5" width="27" height="13" rx="7" fill="none" stroke="#a16207" stroke-width="1" stroke-dasharray="2.4 2"/>
    <path d="M22 23 q6 -8 12 0" stroke="#1f2937" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="28" cy="17.5" r="2" fill="#1f2937"/>`,
};
for (const [id, body] of Object.entries(DECO)) {
  const defs = id === "foil"
    ? `<defs><linearGradient id="foilg" x1="0" y1="0" x2="1" y2="0">
         <stop offset="0" stop-color="#fef3c7"/><stop offset="0.25" stop-color="#fbbf24"/>
         <stop offset="0.5" stop-color="#fffbeb"/><stop offset="0.75" stop-color="#f59e0b"/>
         <stop offset="1" stop-color="#fde68a"/></linearGradient></defs>`
    : "";
  save(`deco-${id}.svg`, svg(56, 40, fabric(56, 40) + defs + body));
}

console.log("✅ studio assets written to", OUT);
