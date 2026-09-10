import { Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef, Component, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";
import {
  drawSegment, newStroke, floodFill, applyGradient,
  type BrushSettings, type Pt, type FillBounds,
} from "@/lib/paint-engine";
import { FABRIC_TYPES, DECORATION_TYPES, type FabricTypeId, type DecorationTypeId } from "@/lib/materialPresets";

export type GarmentType = "tee" | "hoodie" | "sweater" | "pants" | "shorts" | "skirt" | "cap";
export type SizeId = "S" | "M" | "L" | "XL";
const SIZE_SCALE: Record<SizeId, number> = { S: 0.93, M: 1.0, L: 1.07, XL: 1.15 };

const TEX = 1024;

/** Real (PBR) base-fabric material presets — see materialPresets.ts. A
 *  Context instead of threading a new prop through every garment
 *  component (Tee/Hoodie/Cap/Pants) and their 13 separate <ClothMaterial>
 *  call sites — lower risk, and ClothMaterial is the only thing that
 *  actually needs to read it. */
const FabricTypeContext = createContext<FabricTypeId>("cotton");

export interface Studio3DHandle {
  /** Snapshot of just the hand-painted layer (transparent elsewhere), used
   *  to fold free-hand artwork into the duplicate-design fingerprint —
   *  previously only the decal image/transform was hashed, so two designs
   *  with identical decals but completely different hand-painted strokes
   *  were wrongly treated as duplicates. Returns null if nothing painted. */
  getPaintDataUrl: () => string | null;
  /** A real screenshot of the current 3D render — the actual rendered
   *  garment (shape + color + lighting + BOTH decals + freehand paint),
   *  not just the flat decal image. Used so the AI judge in the Arena
   *  evaluates what the garment really looks like instead of only the
   *  printed artwork. Returns null if the canvas hasn't mounted yet. */
  getSnapshotDataUrl: () => string | null;
  /** Paint at a RAW texture coordinate (0..1, v measured from the canvas
   *  top row — i.e. direct canvas space). Used by the 2D mockup board's
   *  draw mode: drawing on a mockup panel paints the real 3D garment
   *  texture in the matching region, live. */
  paintAtTexturePoint: (u: number, v: number, down: boolean) => void;
}

interface Studio3DProps {
  garment: GarmentType;
  color: string;
  quality: "low" | "medium" | "high";
  brush: BrushSettings;
  /** Front-of-garment printed artwork. */
  decalUrl?: string | null;
  decalTransform?: { x: number; y: number; scale: number; rotation: number; skewX?: number; skewY?: number };
  /** Independent back-of-garment printed artwork — a real second slot, not
   *  just the front artwork moved to the other side. Both can be set at
   *  the same time, together with hand-painted strokes; all three are
   *  composited onto the same texture (see `compose()` below). */
  decalUrlBack?: string | null;
  decalTransformBack?: { x: number; y: number; scale: number; rotation: number; skewX?: number; skewY?: number };
  /** Full-canvas (1024×1024) element overlays in RAW texture orientation
   *  (see lib/designElements.ts). When set they are drawn 1:1 onto the
   *  garment texture — the modern multi-element editor (images + text with
   *  opacity/UV/lock etc.) renders into these, while decalUrl/decalUrlBack
   *  stay as the pretty per-side previews used for saving/thumbnails. */
  overlayFrontUrl?: string | null;
  overlayBackUrl?: string | null;
  modelPath?: string | null;
  size?: SizeId;
  /** Base fabric of the garment — drives real PBR roughness/metalness/bump. */
  fabricType?: FabricTypeId;
  /** Print / embroidery treatment applied to the front and back artwork layers. */
  decorationType?: DecorationTypeId;
  decorationTypeBack?: DecorationTypeId;
  /** Stops the idle turntable so the garment holds still while editing */
  frozen?: boolean;
  /** Viewer backdrop color (studio background picker). */
  background?: string;
  /** Motion register of the mannequin: still, walking bob, or wind sway. */
  pose?: GarmentPose;
  /** counters — bump to trigger the action */
  undoSignal?: number;
  clearSignal?: number;
}

export type GarmentPose = "stand" | "walk" | "wind";


/* -------- Realistic garment silhouettes (lathe torso + sleeves) -------- */

function buildTorsoProfile(shoulder: number, chest: number, waist: number, hem: number, height: number) {
  const pts: THREE.Vector2[] = [];
  const rows = [
    [0.0, 0.01],
    [0.03, hem],
    [0.08, hem * 1.01],
    [0.28, waist * 0.99],
    [0.52, chest],
    [0.72, chest * 0.99],
    [0.88, shoulder],
    [0.95, shoulder * 0.72],
    [1.0, 0.02],
  ];
  for (const [t, r] of rows) pts.push(new THREE.Vector2(r!, (t! - 0.5) * height));
  const curve = new THREE.SplineCurve(pts);
  return curve.getPoints(48);
}

const CLOTH_DEPTH = 0.56;

/**
 * §4 — DISJOINT UV ISLANDS (geometry side of the mirror-bug fix).
 *
 * The shared 1024² canvas is partitioned (see the map in designElements.ts):
 * the torso owns the central horizontal band (v 0.16→0.84, full width),
 * each sleeve owns half of the TOP strip, each pant leg owns half of the
 * BOTTOM strip. These helpers compress each mesh's UVs into its own island
 * so two surfaces can NEVER sample the same texels:
 *
 *  • remapLathedBodyUvs — the lathe torso keeps its full 360° horizontal
 *    wrap (u 0..1) but is squeezed vertically into the body band, so body
 *    painting physically cannot reach the limb strips (and vice versa).
 *
 *  • remapLimbUvsToBox — a sleeve/leg cylinder gets a private box. Left
 *    and right get DISJOINT boxes, so a dot painted on one limb can never
 *    appear on the other limb, on the torso, or anywhere else — the §4
 *    regression requirement ("رسم نقطة صغيرة على جهة/كم واحد يجب ألا يغيّر
 *    أي بكسل في الجهة الأخرى أو بقية القطعة").
 *
 * The old `remapUvToCorner` gave limbs boxes that still OVERLAPPED the
 * torso's full-canvas UV range (torso hem shared texels with the sleeve
 * corners) — that cross-part bleed is gone by construction now.
 */

/** Vertical bounds of the torso band (keep in sync with designElements.ts). */
export const BODY_V0 = 0.16;
export const BODY_V1 = 0.84;
/** Top (sleeves) / bottom (legs) strip bounds. */
export const LIMB_TOP_V = 0.16;
export const LIMB_BOTTOM_V = 0.84;

/** A closed UV box in texture space. */
export interface UvBox {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** The four limb islands (texture space). Torso = everything between the strips. */
export const UV_ISLANDS: Record<"sleeveL" | "sleeveR" | "legL" | "legR", UvBox> = {
  sleeveL: { u0: 0.0, u1: 0.5, v0: 0.0, v1: LIMB_TOP_V },
  sleeveR: { u0: 0.5, u1: 1.0, v0: 0.0, v1: LIMB_TOP_V },
  legL: { u0: 0.0, u1: 0.5, v0: LIMB_BOTTOM_V, v1: 1.0 },
  legR: { u0: 0.5, u1: 1.0, v0: LIMB_BOTTOM_V, v1: 1.0 },
};

/** Torso band box — where body (front/back) paint may live. */
export const BODY_BOX: UvBox = { u0: 0.0, u1: 1.0, v0: BODY_V0, v1: BODY_V1 };

function remapLimbUvsToBox(geometry: THREE.BufferGeometry, box: UvBox) {
  const uv = geometry.getAttribute("uv");
  if (!uv) return geometry;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, box.u0 + u * (box.u1 - box.u0), box.v0 + v * (box.v1 - box.v0));
  }
  uv.needsUpdate = true;
  return geometry;
}

function remapLathedBodyUvs(geometry: THREE.BufferGeometry) {
  return remapLimbUvsToBox(geometry, { u0: 0, u1: 1, v0: BODY_V0, v1: BODY_V1 });
}

/** Which UV island does a raw texture point belong to? Used to derive the
 *  bucket-fill safety bounds and to clamp strokes to their part. */
export function uvIslandAt(u: number, v: number): { part: "torso" | "sleeveL" | "sleeveR" | "legL" | "legR"; box: UvBox } {
  if (v < LIMB_TOP_V) return u >= 0.5 ? { part: "sleeveR", box: UV_ISLANDS.sleeveR } : { part: "sleeveL", box: UV_ISLANDS.sleeveL };
  if (v > LIMB_BOTTOM_V) return u >= 0.5 ? { part: "legR", box: UV_ISLANDS.legR } : { part: "legL", box: UV_ISLANDS.legL };
  return { part: "torso", box: BODY_BOX };
}

function useFabricBump() {
  return useMemo(() => {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const n = 128 + (Math.random() - 0.5) * 55;
      data[i * 4] = n; data[i * 4 + 1] = n; data[i * 4 + 2] = n; data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/**
 * Loads an <img> for a decal URL and keeps it up to date as the URL
 * changes. Returns null until loaded (or if url is null/undefined).
 */
function useDecalImage(url?: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) { setImg(null); return; }
    let cancelled = false;
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => { if (!cancelled) setImg(el); };
    el.src = url;
    return () => { cancelled = true; };
  }, [url]);
  return img;
}

/**
 * Draws one decal onto the shared 1024×1024 garment texture canvas.
 *
 * §4 — correct hemisphere + torso-band placement: `centerU` is the decal's
 * resting anchor around the lathe's 360° wrap. u=0 is FRONT-center (the
 * lathe's phi=0 vertex faces the camera) and u=0.5 is BACK-center — the
 * old code anchored front decals at u=0.5, which actually printed them on
 * the BACK (and back decals on the front). x/y are the same -0.5..0.5
 * design offsets; vertical placement is remapped into the torso band
 * (BODY_V0..BODY_V1) so decals can never leak into the limb strips.
 */
function drawDecal(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  transform: { x: number; y: number; scale: number; rotation: number; skewX?: number; skewY?: number } | undefined,
  texSize: number,
  centerU: number,
  decoration?: DecorationTypeId,
) {
  const preset = DECORATION_TYPES.find((d) => d.id === decoration);
  const { x = 0, y = 0, scale = 1, rotation = 0, skewX = 0, skewY = 0 } = transform ?? {};
  const baseSize = texSize * 0.42; // a scale=1 decal covers ~42% of the canvas — reads as a real print, not a full wrap
  const w = baseSize * Math.max(0.05, scale);
  const aspect = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
  const h = w / aspect;

  let cx = centerU * texSize + x * texSize;
  // Orientation fix (the reported "upside-down image" bug): the garment
  // texture is sampled with v pointing UP (tex.flipY = false below), while
  // design-space y points DOWN. So BOTH the decal's vertical position and
  // its internal orientation must be flipped when stamping it onto the
  // paint canvas — translate to the mirrored y, then scale(1,-1) before
  // rotating, so artwork appears on the 3D garment exactly as the person
  // sees it in the 2D mockups (same math as composeElementsOverlay in
  // lib/designElements.ts). Vertical center remapped into the torso band.
  const cy = (BODY_V0 + (0.5 - y) * (BODY_V1 - BODY_V0)) * texSize;
  // wrap horizontally so seam-straddling artwork re-enters from the other edge
  cx = ((cx % texSize) + texSize) % texSize;

  ctx.save();
  if (preset && preset.filter !== "none") ctx.filter = preset.filter;
  ctx.translate(cx, cy);
  ctx.scale(1, -1);
  ctx.rotate((rotation * Math.PI) / 180);
  // Simplified 2-axis warp (skew/shear) — see DecalTransform.skewX/skewY
  // for why this is the scoped-down version instead of a full per-corner
  // perspective mesh warp.
  if (skewX || skewY) ctx.transform(1, skewY, skewX, 1, 0, 0);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  if (preset?.stitchedBorder) {
    ctx.filter = "none";
    ctx.setLineDash([texSize * 0.008, texSize * 0.008]);
    ctx.lineWidth = Math.max(2, texSize * 0.004);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1, texSize * 0.002);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.strokeRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14);
  }
  ctx.restore();

  // Redraw once more shifted a full texture-width to the side so artwork
  // dragged near the horizontal canvas edge doesn't get visually clipped
  // (the garment surface wraps, the canvas doesn't, unless we do this).
  if (cx - w / 2 < 0 || cx + w / 2 > texSize) {
    ctx.save();
    ctx.translate(cx - texSize, cy);
    ctx.scale(1, -1);
    ctx.rotate((rotation * Math.PI) / 180);
    if (skewX || skewY) ctx.transform(1, skewY, skewX, 1, 0, 0);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.save();
    ctx.translate(cx + texSize, cy);
    ctx.scale(1, -1);
    ctx.rotate((rotation * Math.PI) / 180);
    if (skewX || skewY) ctx.transform(1, skewY, skewX, 1, 0, 0);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

/** Shared cloth material tuning — kills the shading/mesh artifacts (z-fighting
 *  and back-face bleed) that made the garments look broken. */
function tuneCloth(mat: THREE.MeshStandardMaterial) {
  mat.side = THREE.FrontSide;
  mat.shadowSide = THREE.FrontSide;
  mat.flatShading = false;
  mat.dithering = true;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  mat.depthWrite = true;
  mat.transparent = false;
  mat.alphaTest = 0;
  mat.needsUpdate = true;
}

function ClothMaterial({
  color, bump, map,
}: { color: string; bump: THREE.Texture; map: THREE.Texture | null }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  const fabricType = useContext(FabricTypeContext);
  const preset = FABRIC_TYPES.find((f) => f.id === fabricType);
  useEffect(() => { if (ref.current) tuneCloth(ref.current); });
  return (
    <meshStandardMaterial
      ref={ref}
      key={map ? `map-${map.uuid}` : "plain"}
      color={map ? "#ffffff" : color}
      roughness={preset?.roughness ?? 0.88}
      metalness={preset?.metalness ?? 0}
      bumpMap={bump}
      bumpScale={preset?.bumpScale ?? 0.012}
      envMapIntensity={0.35}
      map={map ?? undefined}
    />
  );
}

/* Tee = torso + short sleeves + neckband */
function Tee({ color, bump, map }: { color: string; bump: THREE.Texture; map: THREE.Texture | null }) {
  const torso = useMemo(() => {
    const g = new THREE.LatheGeometry(buildTorsoProfile(0.55, 1.1, 0.95, 1.05, 3.2), 48);
    g.computeVertexNormals();
    // §4 — squeeze the lathe's full-canvas UV wrap into the torso band so
    // the body never samples the sleeve strips (and sleeves never see body paint).
    return remapLathedBodyUvs(g);
  }, []);
  const sleeveGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.35, 0.42, 0.9, 24, 1, true);
    g.computeVertexNormals();
    return g;
  }, []);
  const sleeveGeoL = useMemo(() => remapLimbUvsToBox(sleeveGeo.clone(), UV_ISLANDS.sleeveL), [sleeveGeo]);
  const sleeveGeoR = useMemo(() => remapLimbUvsToBox(sleeveGeo.clone(), UV_ISLANDS.sleeveR), [sleeveGeo]);
  const collarGeo = useMemo(() => new THREE.TorusGeometry(0.32, 0.06, 12, 32), []);

  return (
    <group>
      <mesh geometry={torso} scale={[1, 1, CLOTH_DEPTH]} castShadow receiveShadow>
        <ClothMaterial color={color} bump={bump} map={map} />
      </mesh>
      {([[-1, sleeveGeoL], [1, sleeveGeoR]] as const).map(([s, geo]) => (
        <mesh key={s} geometry={geo} position={[s * 0.98, 1.12, 0]}
          rotation={[0, 0, (s * Math.PI) / 2.6]} scale={[1, 1, 0.8]} castShadow>
          <ClothMaterial color={color} bump={bump} map={map} />
        </mesh>
      ))}
      <mesh geometry={collarGeo} position={[0, 1.53, 0.02]} scale={[1, 0.82, CLOTH_DEPTH]} rotation={[Math.PI / 2, 0, 0]}>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
    </group>
  );
}

/* Hoodie = tee + hood + kangaroo pocket + strings */
function Hoodie({ color, bump, map }: { color: string; bump: THREE.Texture; map: THREE.Texture | null }) {
  const torso = useMemo(() => {
    const g = new THREE.LatheGeometry(buildTorsoProfile(0.62, 1.2, 1.1, 1.2, 3.6), 48);
    g.computeVertexNormals();
    return remapLathedBodyUvs(g); // §4 — torso band isolation
  }, []);
  const sleeveGeo = useMemo(() => new THREE.CylinderGeometry(0.4, 0.5, 1.7, 24, 1, true), []);
  const sleeveGeoL = useMemo(() => remapLimbUvsToBox(sleeveGeo.clone(), UV_ISLANDS.sleeveL), [sleeveGeo]);
  const sleeveGeoR = useMemo(() => remapLimbUvsToBox(sleeveGeo.clone(), UV_ISLANDS.sleeveR), [sleeveGeo]);
  const hoodGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.65, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.65);
    g.computeVertexNormals();
    return g;
  }, []);
  const pocketGeo = useMemo(() => new THREE.TorusGeometry(0.55, 0.11, 10, 32, Math.PI), []);
  const stringGeo = useMemo(() => new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), []);

  return (
    <group>
      <mesh geometry={torso} scale={[1, 1, CLOTH_DEPTH + 0.08]} castShadow receiveShadow>
        <ClothMaterial color={color} bump={bump} map={map} />
      </mesh>
      {([[-1, sleeveGeoL], [1, sleeveGeoR]] as const).map(([s, geo]) => (
        <mesh key={s} geometry={geo} position={[s * 1.1, 0.58, 0]}
          rotation={[0, 0, (s * Math.PI) / 2.9]} scale={[1, 1, 0.82]} castShadow>
          <ClothMaterial color={color} bump={bump} map={map} />
        </mesh>
      ))}
      <mesh geometry={hoodGeo} position={[0, 1.62, -0.1]} rotation={[-0.25, 0, 0]} scale={[1, 1.05, 0.85]} castShadow>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
      <mesh geometry={pocketGeo} position={[0, -0.3, 0.7]} scale={[1, 1, 0.6]} rotation={[0, 0, Math.PI]}>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} geometry={stringGeo} position={[x, 1.15, 0.52]}>
          <meshStandardMaterial color="#f8fafc" roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

/* Cap = crown lathe + curved brim */
function Cap({ color, bump, map }: { color: string; bump: THREE.Texture; map: THREE.Texture | null }) {
  const crown = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector2(1.05 * Math.cos(t * Math.PI * 0.42) + 0.02, t * 0.95));
    }
    const g = new THREE.LatheGeometry(pts, 48);
    g.computeVertexNormals();
    return remapLathedBodyUvs(g); // §4 — cap crown paints in the torso band too
  }, []);

  const brim = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1.15, Math.PI * 1.15, Math.PI * 1.85, false);
    shape.lineTo(0.9, 0.05);
    shape.absarc(0, 0, 0.9, Math.PI * 1.85, Math.PI * 1.15, true);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, curveSegments: 32 });
    g.computeVertexNormals();
    return g;
  }, []);

  const button = useMemo(() => new THREE.SphereGeometry(0.06, 16, 16), []);

  return (
    <group>
      <mesh geometry={crown} scale={[1, 1, 0.94]} castShadow receiveShadow>
        <ClothMaterial color={color} bump={bump} map={map} />
      </mesh>
      <mesh geometry={brim} position={[0, -0.07, 0]} rotation={[-0.1, 0, 0]} castShadow>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
      <mesh geometry={button} position={[0, 0.99, 0]}>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
    </group>
  );
}

/* Pants = two tapered legs + waistband */
function Pants({ color, bump, map }: { color: string; bump: THREE.Texture; map: THREE.Texture | null }) {
  const legGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.55, 0),
      new THREE.Vector2(0.5, 0.4),
      new THREE.Vector2(0.42, 1.6),
      new THREE.Vector2(0.38, 2.8),
    ];
    const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x, -p.y)), 32);
    g.computeVertexNormals();
    return g;
  }, []);
  const legGeoL = useMemo(() => remapLimbUvsToBox(legGeo.clone(), UV_ISLANDS.legL), [legGeo]);
  const legGeoR = useMemo(() => remapLimbUvsToBox(legGeo.clone(), UV_ISLANDS.legR), [legGeo]);

  const waistband = useMemo(() => new THREE.TorusGeometry(0.85, 0.12, 16, 40), []);

  return (
    <group position={[0, 0.6, 0]}>
      <mesh geometry={waistband} rotation={[Math.PI / 2, 0, 0]}>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
      {([[-0.45, legGeoL], [0.45, legGeoR]] as const).map(([x, geo]) => (
        <mesh key={x} geometry={geo} position={[x, -0.1, 0]} scale={[0.82, 1, 0.82]} castShadow receiveShadow>
          <ClothMaterial color={color} bump={bump} map={map} />
        </mesh>
      ))}
    </group>
  );
}

/** Loads a real catalog .glb. The garment's own baked fabric texture is handed
 *  back to the studio so painting happens ON TOP of real fabric detail instead
 *  of flattening it into one solid color. */
function CustomGarment({
  path, color, texture, onBaked, onPointerPaint,
}: {
  path: string;
  color: string;
  texture: THREE.Texture;
  onBaked: (image: HTMLImageElement | ImageBitmap | HTMLCanvasElement | null) => void;
  onPointerPaint?: (uv: THREE.Vector2, down: boolean) => void;
}) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useMemo(() => {
    let baked: any = null;
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const src = mesh.material as THREE.MeshStandardMaterial;
      if (!src || !("color" in src)) return;
      const mat = src.clone();
      if (!baked && mat.map?.image) baked = mat.map.image;
      mat.map = texture;
      mat.color.set("#ffffff");
      mat.roughness = Math.max(mat.roughness ?? 0.8, 0.72);
      mat.envMapIntensity = 0.5;
      tuneCloth(mat);
      mesh.material = mat;
    });
    onBaked(baked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, texture]);

  // re-tint whenever the base color changes (composited into the texture)
  useEffect(() => { void color; }, [color]);

  const { normalizedScale, offsetY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 2.6 / (size.y || 1);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return { normalizedScale: scale, offsetY: -center.y * scale };
  }, [cloned]);

  return (
    <group scale={normalizedScale} position={[0, offsetY, 0]}>
      <primitive
        object={cloned}
        onPointerDown={(e: any) => { if (onPointerPaint && e.uv) { e.stopPropagation(); onPointerPaint(e.uv, true); } }}
        onPointerMove={(e: any) => { if (onPointerPaint && e.uv && (e.buttons > 0 || e.pointerType === "touch")) { e.stopPropagation(); onPointerPaint(e.uv, false); } }}
      />
    </group>
  );
}

function Garment(props: {
  garment: GarmentType;
  color: string;
  modelPath?: string | null;
  size?: SizeId;
  /** Base fabric of the garment — drives real PBR roughness/metalness/bump. */
  fabricType?: FabricTypeId;
  /** Print / embroidery treatment applied to the front and back artwork layers. */
  decorationType?: DecorationTypeId;
  decorationTypeBack?: DecorationTypeId;
  texture: THREE.Texture;
  spin: boolean;
  pose?: GarmentPose;
  onBaked: (image: any) => void;
  onPointerPaint?: (uv: THREE.Vector2, down: boolean) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bump = useFabricBump();
  const sizeScale = SIZE_SCALE[props.size ?? "M"];

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    if (props.spin) g.rotation.y += delta * 0.22;
    const time = state.clock.elapsedTime;
    if (props.pose === "walk") {
      g.position.y = Math.abs(Math.sin(time * 3.6)) * 0.14;
      g.rotation.z = Math.sin(time * 3.6) * 0.045;
      g.position.x = Math.sin(time * 1.8) * 0.05;
    } else if (props.pose === "wind") {
      g.position.y = Math.sin(time * 1.4) * 0.04;
      g.rotation.z = Math.sin(time * 1.6) * 0.08;
      g.position.x = Math.sin(time * 1.1) * 0.07;
    } else {
      g.position.set(0, 0, 0);
      g.rotation.z = 0;
    }
  });

  const proceduralMap = props.texture;

  return (
    <group ref={groupRef} scale={sizeScale}>
      {props.modelPath ? (
        <CustomGarment
          path={props.modelPath}
          color={props.color}
          texture={props.texture}
          onBaked={props.onBaked}
          onPointerPaint={props.onPointerPaint}
        />
      ) : (
        <group
          onPointerDown={(e: any) => { if (props.onPointerPaint && e.uv) { e.stopPropagation(); props.onPointerPaint(e.uv, true); } }}
          onPointerMove={(e: any) => { if (props.onPointerPaint && e.uv && (e.buttons > 0 || e.pointerType === "touch")) { e.stopPropagation(); props.onPointerPaint(e.uv, false); } }}
        >
          {props.garment === "tee" && <Tee color={props.color} bump={bump} map={proceduralMap} />}
          {(props.garment === "hoodie" || props.garment === "sweater") && (
            <Hoodie color={props.color} bump={bump} map={proceduralMap} />
          )}
          {props.garment === "cap" && <Cap color={props.color} bump={bump} map={proceduralMap} />}
          {(props.garment === "pants" || props.garment === "shorts" || props.garment === "skirt") && (
            <Pants color={props.color} bump={bump} map={proceduralMap} />
          )}
        </group>
      )}
    </group>
  );
}

/**
 * Guards the 3D garment against a failed/broken catalog .glb load.
 *
 * §"تعذّر تسجيل ملف القطعة" REAL FIX — the old boundary just showed a dead
 * end with a manual retry (which could never succeed when the file itself
 * is missing, e.g. catalog paths that only resolve on Lovable hosting).
 * Now: two automatic retries with backoff (recovers transient network
 * hiccups), and if the file is truly unreachable we hand control back to
 * the studio (onGiveUp) which swaps in the procedural garment of the same
 * category — the studio NEVER dead-ends on a missing model file. A manual
 * retry stays available while the automatic ones run.
 */
class ModelErrorBoundary extends Component<
  { path?: string | null; onGiveUp: () => void; children: ReactNode },
  { error: Error | null; retries: number }
> {
  state = { error: null as Error | null, retries: 0 };
  gaveUp = false;
  retryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[Studio3D] model failed:", this.props.path, error);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  retry = () => {
    // drei caches failed loads — clear it so the retry actually refetches.
    try { if (this.props.path) useGLTF.clear(this.props.path); } catch { /* ignore */ }
    this.setState((s) => ({ error: null, retries: s.retries + 1 }));
  };

  componentDidUpdate(_prev: unknown, prevState: { error: Error | null; retries: number }) {
    if (!this.state.error) return;
    // schedule ONE auto-retry per error state
    if (prevState.error === this.state.error && prevState.retries === this.state.retries && !this.retryTimer && !this.gaveUp) {
      if (this.state.retries < 2) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.retry();
        }, 1200 * (this.state.retries + 1));
      } else if (!this.gaveUp) {
        // file is genuinely unreachable → swap to the procedural garment
        this.gaveUp = true;
        this.props.onGiveUp();
      }
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center pointer-events-none">
          <div className="max-w-xs pointer-events-auto">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-cyan-300" />
            <div className="text-white/80 text-sm font-bold mb-1">
              {this.state.retries < 2
                ? "جارٍ إعادة تحميل ملف القطعة تلقائيًا…"
                : "تعذّر تحميل ملف القطعة — تم استبدالها بقطعة بديلة"}
            </div>
            <div className="text-white/40 text-[10px] font-mono break-all mb-3">{this.props.path}</div>
            {this.state.retries < 2 && (
              <button
                onClick={this.retry}
                className="px-4 py-2 rounded-xl bg-primary/20 border border-primary/40 text-primary text-sm font-bold"
              >
                إعادة المحاولة الآن
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default forwardRef<Studio3DHandle, Studio3DProps>(function Studio3D(props, ref) {
  const dpr: [number, number] =
    props.quality === "high" ? [1, 2] : props.quality === "medium" ? [1, 1.5] : [0.75, 1];

  // §"تعذّر تسجيل ملف القطعة" fix part 2 — hung-load watchdog + graceful
  // fallback. If the catalog .glb neither loads NOR errors within 30s
  // (stalled request), we swap to the procedural garment of the same
  // category instead of spinning "Loading studio…" forever. A successful
  // bake (onBaked) cancels the fallback.
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const effectiveModelPath = modelLoadFailed ? null : props.modelPath ?? null;

  useEffect(() => {
    setModelLoadFailed(false);
    if (!props.modelPath) return;
    const t = setTimeout(() => setModelLoadFailed(true), 30_000);
    return () => clearTimeout(t);
  }, [props.modelPath]);

  const paintKey = effectiveModelPath ?? props.garment;

  /** three stacked layers:
   *   base  = the garment's own baked fabric texture, multiplied by the picked color
   *   paint = the person's hand-drawn strokes (transparent elsewhere)
   *   out   = base + paint, used as the live map on the 3D garment
   */
  const layers = useMemo(() => {
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = TEX; c.height = TEX;
      return c;
    };
    const base = mk();
    const paint = mk();
    const out = mk();
    const tex = new THREE.CanvasTexture(out);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return { base, paint, out, tex };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintKey]);

  const bakedRef = useRef<any>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const strokeRef = useRef(newStroke());
  const gradStartRef = useRef<Pt | null>(null);
  const gradIslandRef = useRef<FillBounds | null>(null);
  const [hasArtwork, setHasArtwork] = useState(false);

  /**
   * Non-destructive paint layers (per feedback that freehand drawing was
   * flattened straight into one canvas with no way to hide/delete a
   * single stroke group afterward). Low-risk approach on purpose: nothing
   * about compose(), getPaintDataUrl(), or the fingerprint changes —
   * `layers.paint` still exists exactly as before and is still what
   * everything downstream reads. It just becomes an auto-recomputed
   * COMPOSITE of these layers instead of being drawn into directly.
   * Capped at 8 layers (each is its own full-size offscreen canvas —
   * more than that gets memory-heavy on weaker Android devices).
   */
  const MAX_PAINT_LAYERS = 8;
  const makeLayerCanvas = () => {
    const c = document.createElement("canvas");
    c.width = TEX; c.height = TEX;
    return c;
  };
  const [paintLayers, setPaintLayers] = useState<{ id: string; canvas: HTMLCanvasElement; visible: boolean; label: string }[]>(
    () => [{ id: "layer-1", canvas: makeLayerCanvas(), visible: true, label: "Layer 1" }],
  );
  const [activeLayerId, setActiveLayerId] = useState("layer-1");
  const layerCounter = useRef(1);

  const activeLayerCanvas = () => paintLayers.find((l) => l.id === activeLayerId)?.canvas ?? paintLayers[0]?.canvas;

  /** Recomputes layers.paint (the flat composite everything else reads)
   *  from the current stack of layer canvases, then re-runs compose() so
   *  the 3D garment reflects it immediately. */
  const recompositeLayers = () => {
    const ctx = layers.paint.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, TEX, TEX);
    for (const l of paintLayers) {
      if (l.visible) ctx.drawImage(l.canvas, 0, 0);
    }
    compose();
  };

  const addPaintLayer = () => {
    if (paintLayers.length >= MAX_PAINT_LAYERS) return;
    layerCounter.current += 1;
    const id = `layer-${layerCounter.current}`;
    const canvas = makeLayerCanvas();
    setPaintLayers((ls) => [...ls, { id, canvas, visible: true, label: `Layer ${layerCounter.current}` }]);
    setActiveLayerId(id);
  };

  const toggleLayerVisible = (id: string) => {
    setPaintLayers((ls) => ls.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  };

  const deleteLayer = (id: string) => {
    setPaintLayers((ls) => {
      const next = ls.filter((l) => l.id !== id);
      return next.length > 0 ? next : [{ id: "layer-1", canvas: makeLayerCanvas(), visible: true, label: "Layer 1" }];
    });
    setActiveLayerId((cur) => (cur === id ? (paintLayers.find((l) => l.id !== id)?.id ?? "layer-1") : cur));
  };

  // Any time the layer stack (order/visibility/count) changes, refresh the composite.
  useEffect(() => { recompositeLayers(); }, [paintLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to a single fresh layer when switching garment/model — otherwise
  // stale layer canvases from a different piece would linger.
  useEffect(() => {
    layerCounter.current = 1;
    setPaintLayers([{ id: "layer-1", canvas: makeLayerCanvas(), visible: true, label: "Layer 1" }]);
    setActiveLayerId("layer-1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintKey]);

  const decalFrontImg = useDecalImage(props.decalUrl);
  const decalBackImg = useDecalImage(props.decalUrlBack);
  const overlayFrontImg = useDecalImage(props.overlayFrontUrl);
  const overlayBackImg = useDecalImage(props.overlayBackUrl);
  // Always-fresh reference to the current paintAt (it closes over the
  // current brush/layer each render) so the imperative handle never calls
  // a stale one.
  const paintAtRef = useRef<(uv: THREE.Vector2, down: boolean) => void>(() => {});

  useImperativeHandle(ref, () => ({
    getPaintDataUrl: () => {
      if (!hasArtwork) return null;
      try {
        return layers.paint.toDataURL("image/png");
      } catch {
        return null;
      }
    },
    getSnapshotDataUrl: () => {
      try {
        return glCanvasRef.current?.toDataURL("image/jpeg", 0.85) ?? null;
      } catch {
        // Most likely a WebGL "tainted canvas" security error, which
        // shouldn't happen here since everything drawn onto the garment
        // (uploads, AI-generated art) is same-origin/data-URL — but fail
        // soft rather than crash the judge flow either way.
        return null;
      }
    },
    paintAtTexturePoint: (u: number, v: number, down: boolean) => {
      paintAtRef.current(new THREE.Vector2(u, v), down);
    },
  }), [hasArtwork, layers.paint]);

  /** rebuilds base (fabric × color) → stamps front/back decals → composites
   *  hand-painted strokes on top. All three coexist now — previously a
   *  decal only showed up when nothing had been hand-painted yet. */
  const compose = () => {
    const b = layers.base.getContext("2d");
    const o = layers.out.getContext("2d");
    if (!b || !o) return;

    b.clearRect(0, 0, TEX, TEX);
    if (bakedRef.current) {
      try { b.drawImage(bakedRef.current, 0, 0, TEX, TEX); } catch { /* ignore */ }
    } else {
      b.fillStyle = "#ffffff";
      b.fillRect(0, 0, TEX, TEX);
    }
    b.save();
    b.globalCompositeOperation = "multiply";
    b.fillStyle = props.color;
    b.fillRect(0, 0, TEX, TEX);
    b.restore();

    o.clearRect(0, 0, TEX, TEX);
    o.drawImage(layers.base, 0, 0);
    // Multi-element overlays (2D mockup board editor) — full-canvas images
    // in raw texture orientation, drawn 1:1 with no placement math here.
    // (They are pre-clipped to their islands in composeElements.)
    // §5 — layer order: base color → element overlays (images below later
    // texts, insertion order) → hand paint on top.
    if (overlayFrontImg) o.drawImage(overlayFrontImg, 0, 0, TEX, TEX);
    if (overlayBackImg) o.drawImage(overlayBackImg, 0, 0, TEX, TEX);
    // §4 — legacy single-decal slots anchor at the CORRECT hemisphere now:
    // front at u=0 (camera-facing), back at u=0.5.
    if (decalFrontImg) drawDecal(o, decalFrontImg, props.decalTransform, TEX, 0, props.decorationType);
    if (decalBackImg) drawDecal(o, decalBackImg, props.decalTransformBack, TEX, 0.5, props.decorationTypeBack);
    o.drawImage(layers.paint, 0, 0);
    layers.tex.needsUpdate = true;
  };

  // Redraw whenever either decal (image or its placement) changes — not
  // just on color/paint changes like before, since decals are now baked
  // pixels instead of a live GPU texture offset.
  useEffect(() => { compose(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [
    decalFrontImg, decalBackImg, overlayFrontImg, overlayBackImg,
    props.decalTransform?.x, props.decalTransform?.y, props.decalTransform?.scale, props.decalTransform?.rotation,
    props.decalTransformBack?.x, props.decalTransformBack?.y, props.decalTransformBack?.scale, props.decalTransformBack?.rotation,
    props.decorationType, props.decorationTypeBack,
  ]);

  useEffect(() => { compose(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [props.color, layers]);

  // clear — clears the ACTIVE layer only (consistent with per-layer editing)
  useEffect(() => {
    if (props.clearSignal === undefined) return;
    activeLayerCanvas()?.getContext("2d")?.clearRect(0, 0, TEX, TEX);
    historyRef.current = [];
    setHasArtwork(false);
    recompositeLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.clearSignal]);

  // undo — operates on the ACTIVE layer only now (undoing a stroke on
  // Layer 2 shouldn't touch Layer 1's content).
  useEffect(() => {
    if (props.undoSignal === undefined) return;
    const snap = historyRef.current.pop();
    const canvas = activeLayerCanvas();
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    if (snap) ctx.putImageData(snap, 0, 0);
    else ctx.clearRect(0, 0, TEX, TEX);
    setHasArtwork(historyRef.current.length > 0);
    recompositeLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.undoSignal]);

  const pushHistory = () => {
    const canvas = activeLayerCanvas();
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, TEX, TEX));
    if (historyRef.current.length > 12) historyRef.current.shift();
  };

  const brush = props.brush;
  const paintingActive = brush.tool !== "select";

  const paintAt = (uv: THREE.Vector2, down: boolean) => {
    const canvas = activeLayerCanvas();
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvas) return;
    // Bug fix: strokes near the bottom of the garment were landing near the
    // top instead (reported directly from testing on the live app). The
    // paint canvas texture is uploaded with flipY=false (see `tex.flipY =
    // false` above), so mesh UV.y should map to canvas Y directly — the
    // previous `(1 - uv.y)` inversion here was fighting that and flipping
    // painted strokes vertically. If a future model swap ever reintroduces
    // the same symptom, toggle PAINT_V_FLIP below rather than hunting for
    // this line again.
    const PAINT_V_FLIP = false;
    // §4 — island clamp: on PROCEDURAL garments every mesh owns a disjoint
    // UV island, so a stroke/bucket/gradient started on one part is
    // hard-clamped to that part's box — it can never write a pixel of
    // another part. Catalog .glb models use their own baked UVs (no
    // islands), so there the whole canvas is one valid region.
    const island: { part: string; box: UvBox } = props.modelPath
      ? { part: "glb", box: { u0: 0, u1: 1, v0: 0, v1: 1 } }
      : uvIslandAt(uv.x, PAINT_V_FLIP ? 1 - uv.y : uv.y);
    const box = island.box;
    const bx: FillBounds = { x0: box.u0 * TEX, y0: box.v0 * TEX, x1: box.u1 * TEX, y1: box.v1 * TEX };
    const clampedU = Math.min(Math.max(uv.x, box.u0 + 0.0005), box.u1 - 0.0005);
    const clampedV = Math.min(Math.max(PAINT_V_FLIP ? 1 - uv.y : uv.y, box.v0 + 0.0005), box.v1 - 0.0005);
    const p: Pt = { x: clampedU * TEX, y: clampedV * TEX };

    if (down) {
      pushHistory();
      strokeRef.current = newStroke();
      strokeRef.current.last = p;
    }

    if (brush.tool === "bucket") {
      // §4 — ColorDrop is the ONLY tool that flood-fills. Its sensitivity
      // slider (brush.opacity 0..1 shown as "التسامح/Tolerance" for this
      // tool) maps to the per-channel match slack, and `bx` guarantees the
      // fill stays inside the one part it started on. 255 = ignore closed
      // boundaries within the part; 1 = almost exact-color-only.
      if (!down) return;
      floodFill(canvas, p, brush.color, Math.round(Math.max(1, brush.opacity * 255)), bx);
    } else if (brush.tool === "text") {
      // §2 — text is no longer stamped onto the paint layer by tapping:
      // the Text panel applies it LIVE as a controllable design element
      // (see the live-text effect in routes/index.tsx). Tapping the garment
      // with the Text tool intentionally does nothing.
      return;
    } else if (brush.tool === "gradient") {
      if (down) { gradStartRef.current = p; gradIslandRef.current = bx; return; }
      const from = gradStartRef.current;
      if (!from) return;
      // §4 — the gradient sweep is clipped to the island it started on.
      applyGradient(canvas, from, p, brush.color, brush.opacity, gradIslandRef.current ?? bx);
    } else {
      // Freehand draw / eraser / smudge — pure stroke stamping, never a
      // flood fill (§4). Points are clamped inside the island.
      drawSegment(ctx, strokeRef.current, p, brush, TEX);
    }

    setHasArtwork(true);
    recompositeLayers();
  };

    paintAtRef.current = paintAt;

  useEffect(() => {
    const up = () => { gradStartRef.current = null; gradIslandRef.current = null; strokeRef.current = newStroke(); };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  // --- Cosmetic paint-splatter overlay (screen-space, see the JSX below) ---
  const [splatters, setSplatters] = useState<{ id: number; x: number; y: number; dx: number; dy: number; size: number; color: string }[]>([]);
  const splatterId = useRef(0);
  const lastSplatterAt = useRef(0);

  const spawnSplatters = (clientX: number, clientY: number, target: EventTarget | null) => {
    if (!paintingActive) return;
    if (brush.tool !== "draw") return; // only the actual drawing action, not eraser/bucket/text/etc.
    if (brush.brush !== "pen" && brush.brush !== "marker" && brush.brush !== "spray") return;
    const now = performance.now();
    if (now - lastSplatterAt.current < 45) return; // throttle so it stays a light flourish, not a blizzard
    lastSplatterAt.current = now;
    const el = (target as HTMLElement)?.closest?.(".relative.w-full.h-full") as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    const x = rect ? clientX - rect.left : clientX;
    const y = rect ? clientY - rect.top : clientY;
    const count = 2 + Math.floor(Math.random() * 3);
    const next = Array.from({ length: count }).map(() => ({
      id: splatterId.current++,
      x, y,
      dx: (Math.random() - 0.5) * 46,
      dy: (Math.random() - 0.5) * 46 + 10, // slight downward drift, like real flicked paint
      size: 3 + Math.random() * 6,
      color: brush.color,
    }));
    setSplatters((cur) => [...cur, ...next].slice(-40)); // cap total for perf
  };

  const onSplatterPointer = (e: React.PointerEvent) => spawnSplatters(e.clientX, e.clientY, e.target);
  const onSplatterPointerMove = (e: React.PointerEvent) => { if (e.buttons === 1) spawnSplatters(e.clientX, e.clientY, e.target); };

  return (
    <div className="relative w-full h-full" onPointerDown={onSplatterPointer} onPointerMove={onSplatterPointerMove}>
      <ModelErrorBoundary
        key={effectiveModelPath ?? props.garment}
        path={props.modelPath}
        onGiveUp={() => setModelLoadFailed(true)}
      >
      <Canvas
        shadows
        dpr={dpr}
        camera={{ position: [0, 0.5, 6], fov: 40 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          preserveDrawingBuffer: true, // required so .toDataURL() on the WebGL canvas actually returns pixels (see getSnapshotDataUrl)
        }}
        onCreated={(state) => { glCanvasRef.current = state.gl.domElement; }}
      >
        <color attach="background" args={[props.background ?? "#000000"]} />
        <fog attach="fog" args={[props.background ?? "#000000", 10, 24]} />

        <ambientLight intensity={0.38} />
        <directionalLight
          position={[3.5, 6, 4]}
          intensity={2.2}
          color="#fff7ec"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <directionalLight position={[-4, 2.5, 3]} intensity={0.55} color="#eef3fb" />
        <directionalLight position={[0, 3.5, -5]} intensity={0.7} color="#ffffff" />

        <Suspense fallback={null}>
          <FabricTypeContext.Provider value={props.fabricType ?? "cotton"}>
          <Garment
            garment={props.garment}
            color={props.color}
            modelPath={effectiveModelPath}
            size={props.size}
            texture={layers.tex}
            spin={!props.frozen && !paintingActive}
            pose={props.pose}
            onBaked={(image) => { bakedRef.current = image; compose(); setModelLoadFailed(false); }}
            onPointerPaint={paintingActive ? paintAt : undefined}
          />
          </FabricTypeContext.Provider>
        </Suspense>

        <ContactShadows position={[0, -2.4, 0]} opacity={0.65} scale={14} blur={2.4} far={5} />

        {/* Studio-style HDRI environment lighting — adds realistic
            reflections/ambient fill on top of the existing three
            directional lights (kept as-is; Environment complements them,
            doesn't replace them). Uses drei's built-in preset, so no new
            package install is needed — safe, additive change. */}
        <Environment preset="studio" />

        <OrbitControls
          enablePan={false}
          enableRotate={!paintingActive}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.75}
          zoomSpeed={0.7}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.9}
          minDistance={3.5}
          maxDistance={10}
        />
      </Canvas>
      </ModelErrorBoundary>

      {/* Layers panel — small floating overlay in the corner of the 3D
          viewport (kept inside Studio3D rather than lifted to the parent,
          so the layer canvases and their React state stay in one place;
          lowest-risk way to add this without threading new props/handle
          methods through index.tsx). Only shown while an actual paint
          tool is active — no point cluttering the viewport otherwise. */}
      {paintingActive && (
        <div className="absolute top-3 left-3 z-20 w-40 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 overflow-hidden pointer-events-auto">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Layers</span>
            <button
              onClick={addPaintLayer}
              disabled={paintLayers.length >= MAX_PAINT_LAYERS}
              className="text-cyan-300 disabled:opacity-30 text-sm leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
              title="New layer"
            >
              +
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {[...paintLayers].reverse().map((l) => (
              <div
                key={l.id}
                onClick={() => setActiveLayerId(l.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] cursor-pointer ${
                  l.id === activeLayerId ? "bg-cyan-500/20 text-cyan-100" : "text-white/50 hover:bg-white/5"
                }`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLayerVisible(l.id); }}
                  className="w-4 shrink-0 text-center"
                  title={l.visible ? "Hide" : "Show"}
                >
                  {l.visible ? "◉" : "○"}
                </button>
                <span className="flex-1 truncate">{l.label}</span>
                {paintLayers.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }}
                    className="w-4 shrink-0 text-center text-red-300/70 hover:text-red-300"
                    title="Delete layer"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purely cosmetic paint-splatter flourish (screen-space overlay,
          NOT drawn onto the actual garment texture) — a few little dots of
          the current brush color pop and fade near the brush tip while
          painting, like a real paint pen. Adds nothing to compose(), so
          it can never affect the saved design or the fingerprint. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {splatters.map((s) => (
            <motion.span
              key={s.id}
              initial={{ opacity: 0.9, scale: 0, x: s.x, y: s.y }}
              animate={{ opacity: 0, scale: 1, x: s.x + s.dx, y: s.y + s.dy }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              onAnimationComplete={() => setSplatters((cur) => cur.filter((c) => c.id !== s.id))}
              style={{ position: "absolute", width: s.size, height: s.size, borderRadius: "50%", background: s.color, left: 0, top: 0 }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});
