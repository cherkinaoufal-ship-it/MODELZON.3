/**
 * §4 regression test — run: node scripts/test-flood-fill.mjs
 *
 * Proves, at pixel level, that:
 *  1. A bucket fill inside one UV island NEVER writes a pixel outside its
 *     bounds (cross-part safety).
 *  2. A closed drawn boundary stops the fill (flood semantics).
 *  3. Tolerance actually controls how far propagation spreads.
 *  4. The freehand draw path contains no flood-fill call (source audit).
 *
 * Uses the pure floodFillPixels core from src/lib/paint-engine.ts
 * (stripped of TS types via a light transform — no build step needed).
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const src = readFileSync(join(root, "src/lib/paint-engine.ts"), "utf8");
const start = src.indexOf("export function floodFillPixels");
const end = src.indexOf("/** Flood fill from a point on a real");
const hexToRgbStart = src.indexOf("function hexToRgb");
const hexToRgbEnd = src.indexOf("function rgba(");
const ifaceStart = src.indexOf("export interface FillBounds");
const ifaceEnd = src.indexOf("}", src.indexOf("y1: number;", ifaceStart)) + 1;
const core =
  src.slice(hexToRgbStart, hexToRgbEnd) + "\n" +
  (ifaceStart >= 0 ? src.slice(ifaceStart, ifaceEnd) + "\n" : "") +
  src.slice(start, end);

// transpile the TS core with the repo's own TypeScript compiler
const tmp = join(root, ".test-tmp");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(tmp, "js"), { recursive: true });
writeFileSync(join(tmp, "ff.ts"), core);
execSync(
  `${join(root, "node_modules/.bin/tsc")} ${join(tmp, "ff.ts")} --outDir ${join(tmp, "js")} --module esnext --target es2020 --skipLibCheck`,
  { stdio: "pipe" },
);
const { floodFillPixels } = await import(join(tmp, "js", "ff.js"));

let failures = 0;
const assert = (cond, label) => {
  console.log((cond ? "  ✅" : "  ❌") + " " + label);
  if (!cond) failures++;
};

const W = 64, H = 64;
const mkCanvas = () => {
  const data = new Uint8ClampedArray(W * H * 4);
  // base = opaque mid-gray everywhere
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = 128; data[i * 4 + 1] = 128; data[i * 4 + 2] = 128; data[i * 4 + 3] = 255;
  }
  return data;
};
const px = (d, x, y) => {
  const o = (y * W + x) * 4;
  return [d[o], d[o + 1], d[o + 2], d[o + 3]];
};
const countColor = (d, rgb) => {
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    if (d[o] === rgb[0] && d[o + 1] === rgb[1] && d[o + 2] === rgb[2]) n++;
  }
  return n;
};

console.log("— Test 1: island bounds contain the fill —");
{
  const d = mkCanvas();
  // fill seeded in the torso band (y 20), band = y 10..40
  const changed = floodFillPixels(d, W, H, 32, 20, "#ff0000", 42, { x0: 0, y0: 10, x1: W - 1, y1: 40 });
  assert(changed, "fill reported changes");
  assert(countColor(d, [255, 0, 0]) === 31 * W, "entire band filled (31 rows)");
  let outside = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y < 10 || y > 40) { const p = px(d, x, y); if (p[0] === 255 && p[1] === 0) outside = true; }
  }
  assert(!outside, "not a single pixel outside the island bounds changed");
}

console.log("— Test 2: a closed stroke boundary stops the flood —");
{
  const d = mkCanvas();
  // draw a closed red box (the "closed paint boundary") around (30..45, 30..45)
  for (let x = 30; x <= 45; x++) for (const y of [30, 45]) { const o = (y * W + x) * 4; d[o] = 0; d[o + 1] = 0; d[o + 2] = 255; }
  for (let y = 30; y <= 45; y++) for (const x of [30, 45]) { const o = (y * W + x) * 4; d[o] = 0; d[o + 1] = 0; d[o + 2] = 255; }
  // seed INSIDE the box — must not escape the closed contour
  floodFillPixels(d, W, H, 37, 37, "#00ff00", 42, { x0: 0, y0: 0, x1: W - 1, y1: H - 1 });
  const green = countColor(d, [0, 255, 0]);
  assert(green > 0, "interior was filled");
  const [ox, oy] = [10, 10];
  const p = px(d, ox, oy);
  assert(p[0] === 128 && p[2] === 128, "pixel far outside the closed boundary untouched");
  // verify the fill stayed inside: corner pixel (31,31)-adjacent region only
  const outside = px(d, 29, 37);
  assert(outside[2] === 128 && outside[0] === 128, "pixel immediately outside the closed contour untouched");
}

console.log("— Test 3: tolerance controls propagation —");
{
  const d = mkCanvas();
  // gradient-ish: left half gray 128, right half gray 150 (delta 22)
  for (let x = 32; x < W; x++) for (let y = 0; y < H; y++) { const o = (y * W + x) * 4; d[o] = 150; d[o + 1] = 150; d[o + 2] = 150; }
  const d1 = new Uint8ClampedArray(d);
  floodFillPixels(d1, W, H, 0, 0, "#ff0000", 10, undefined); // tol 10 < 22 → stays left
  assert(countColor(d1, [255, 0, 0]) === 32 * H, "low tolerance stops at the 22-delta boundary");
  const d2 = new Uint8ClampedArray(d);
  floodFillPixels(d2, W, H, 0, 0, "#ff0000", 40, undefined); // tol 40 > 22 → crosses
  assert(countColor(d2, [255, 0, 0]) === W * H, "high tolerance propagates across it");
}

console.log("— Test 4: freehand draw never flood-fills (source audit) —");
{
  const engine = src;
  const drawSegmentBody = engine.slice(engine.indexOf("export function drawSegment"), engine.indexOf("export function floodFillPixels"));
  assert(!drawSegmentBody.includes("floodFill"), "drawSegment contains no floodFill call");
  const stampSection = engine.slice(engine.indexOf("const STAMPS"), engine.indexOf("export function drawSegment"));
  assert(!stampSection.includes("floodFill"), "brush stamps contain no floodFill call");
}

console.log(failures === 0 ? "\nALL §4 REGRESSION TESTS PASSED ✅" : `\n${failures} FAILURES ❌`);
process.exit(failures === 0 ? 0 : 1);
