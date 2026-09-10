import type { Lang } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Shirt } from "lucide-react";
import { GARMENTS, CATEGORY_META, type GarmentItem, type Gender, type GarmentCategory } from "@/data/garments";

/* ------------------------------------------------------------------ */
/* Flat garment icons (§4 redesign) — clean icon-style pieces drawn as  */
/* inline SVG on BLACK cards, matching the app's dark neon theme,       */
/* instead of the old white-studio mannequin photos.                    */
/* ------------------------------------------------------------------ */

function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full || "888888", 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function GarmentIcon({ category, color, uid }: { category: GarmentCategory; color: string; uid: string }) {
  const light = shade(color, 0.28);
  const dark = shade(color, -0.32);
  const stroke = "rgba(255,255,255,0.35)";
  const seam = { stroke: "rgba(0,0,0,0.3)", strokeWidth: 1.4, strokeDasharray: "4 4", fill: "none" } as const;
  const grad = (
    <defs>
      <linearGradient id={`gl-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={light} />
        <stop offset="50%" stopColor={color} />
        <stop offset="100%" stopColor={dark} />
      </linearGradient>
    </defs>
  );
  const fill = `url(#gl-${uid})`;
  const sw = 2.2;

  switch (category) {
    case "hoodie":
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
          {grad}
          <path d="M60 52 L20 84 L28 128 L52 122 L56 88 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M140 52 L180 84 L172 128 L148 122 L144 88 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M60 52 C76 42 84 38 100 38 C116 38 124 42 140 52 L146 168 C118 178 82 178 54 168 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M74 46 C82 16 118 16 126 46 C114 58 86 58 74 46 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <rect x="66" y="118" width="68" height="38" rx="8" fill="rgba(0,0,0,0.14)" stroke={stroke} strokeWidth="1.6" />
          <path d="M92 58 V80 M108 58 V80" stroke="rgba(255,255,255,0.5)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M54 160 C82 170 118 170 146 160" {...seam} />
        </svg>
      );
    case "sweater":
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
          {grad}
          <path d="M60 52 L20 86 L26 140 L50 134 L56 90 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M140 52 L180 86 L174 140 L150 134 L144 90 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M60 52 C76 42 84 38 100 38 C116 38 124 42 140 52 L146 164 C118 174 82 174 54 164 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M80 40 C88 52 112 52 120 40" fill="none" stroke={stroke} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M62 66 V158 M74 66 V162 M86 64 V164 M100 64 V166 M114 64 V164 M126 66 V162 M138 66 V158" stroke="rgba(0,0,0,0.16)" strokeWidth="2" fill="none" />
          <rect x="56" y="152" width="88" height="14" rx="6" fill="rgba(0,0,0,0.14)" stroke={stroke} strokeWidth="1.6" />
        </svg>
      );
    case "pants":
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
          {grad}
          <rect x="56" y="26" width="88" height="16" rx="6" fill={fill} stroke={stroke} strokeWidth={sw} />
          <path d="M58 42 h84 l6 132 h-38 l-10 -92 l-10 92 h-38 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M100 42 V72" {...seam} />
          <path d="M66 56 l14 10 M134 56 l-14 10" stroke="rgba(0,0,0,0.25)" strokeWidth="1.6" fill="none" />
        </svg>
      );
    case "shorts":
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
          {grad}
          <rect x="52" y="48" width="96" height="16" rx="6" fill={fill} stroke={stroke} strokeWidth={sw} />
          <path d="M54 64 h92 l8 74 h-44 l-10 -46 l-10 46 h-44 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M100 64 V88" {...seam} />
          <path d="M62 128 h32 M106 128 h32" stroke="rgba(0,0,0,0.25)" strokeWidth="1.6" fill="none" />
        </svg>
      );
    case "skirt":
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
          {grad}
          <rect x="60" y="40" width="80" height="14" rx="6" fill={fill} stroke={stroke} strokeWidth={sw} />
          <path d="M62 54 h76 l24 108 q-62 12 -124 0 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M80 60 L70 152 M100 58 V156 M120 60 L130 152" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case "cap":
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
          {grad}
          <path d="M100 54 C144 54 166 86 166 122 L166 138 C144 148 56 148 34 138 L34 122 C34 86 56 54 100 54 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M100 54 V138" {...seam} />
          <path d="M34 122 Q100 106 166 122" {...seam} />
          <path d="M36 138 C62 154 138 154 164 138 C162 128 144 122 100 122 C56 122 38 128 36 138 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    default: // tee
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
          {grad}
          <path d="M62 50 L18 86 L28 122 L54 114 L58 92 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M138 50 L182 86 L172 122 L146 114 L142 92 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M62 50 C78 40 86 36 100 36 C114 36 122 40 138 50 L144 166 C116 176 84 176 56 166 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M80 38 C88 52 112 52 120 38" fill="none" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M56 158 C84 168 116 168 144 158" {...seam} />
        </svg>
      );
  }
}

interface Props {
  lang: Lang;
  onPick: (item: GarmentItem) => void;
}

const GENDERS: { id: Gender | "all"; ar: string; en: string }[] = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "men", ar: "رجالي", en: "Men" },
  { id: "women", ar: "نسائي", en: "Women" },
  { id: "unisex", ar: "الجنسين", en: "Unisex" },
];

export default function GarmentLibrary({ lang, onPick }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [gender, setGender] = useState<Gender | "all">("all");
  const [category, setCategory] = useState<GarmentCategory | "all">("all");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const set = new Set<GarmentCategory>(GARMENTS.map((g) => g.category));
    return Array.from(set);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = GARMENTS.filter(
    (g) =>
      (gender === "all" || g.gender === gender) &&
      (category === "all" || g.category === category) &&
      (!q || g.en.toLowerCase().includes(q) || g.ar.includes(query.trim()) ||
        CATEGORY_META[g.category].en.toLowerCase().includes(q) || CATEGORY_META[g.category].ar.includes(query.trim()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shirt className="text-fuchsia-400" size={18} />
        <h2 className="text-lg font-black">{t("Garment Library", "مكتبة الملابس")}</h2>
        <span className="ml-auto text-[10px] text-white/50">{t("Tap a piece to edit it", "اضغط القطعة لتعديلها")}</span>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl bg-black/60 border border-white/10 px-3 py-2 focus-within:border-cyan-400/50 transition">
        <Search size={14} className="text-white/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search garments…", "ابحث عن قطعة…")}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-white/30"
        />
      </div>

      {/* Gender toggle */}
      <div className="flex gap-2">
        {GENDERS.map((g) => (
          <button
            key={g.id}
            onClick={() => setGender(g.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
              gender === g.id
                ? "bg-cyan-500/25 border-cyan-400 text-cyan-100"
                : "bg-black/60 border-white/10 text-white/60 hover:bg-white/10"
            }`}
          >
            {t(g.en, g.ar)}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategory("all")}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border ${
            category === "all" ? "bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100" : "bg-black/60 border-white/10 text-white/60"
          }`}
        >
          {t("All", "الكل")}
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 ${
              category === c ? "bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100" : "bg-black/60 border-white/10 text-white/60"
            }`}
          >
            <span>{CATEGORY_META[c].emoji}</span>
            {t(CATEGORY_META[c].en, CATEGORY_META[c].ar)}
          </button>
        ))}
      </div>

      {/* Catalogue grid — §4 redesign: BLACK cards with clean flat garment
          icons (reference-style icon tiles), no white studio photos. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {filtered.map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPick(item)}
            className="group relative rounded-2xl overflow-hidden bg-black border border-white/10 hover:border-cyan-400/50 hover:shadow-[0_0_18px_rgba(6,182,212,0.15)] transition text-left"
          >
            <div className="relative aspect-square flex items-center justify-center p-5 bg-[radial-gradient(80%_80%_at_50%_35%,rgba(255,255,255,0.05),transparent_70%)]">
              <div className="w-full h-full transition duration-300 group-hover:scale-[1.06]">
                <GarmentIcon category={item.category} color={item.color} uid={item.id} />
              </div>
            </div>
            <div className="px-2.5 pb-2.5 pt-0.5">
              <div className="font-bold text-[11px] leading-tight truncate">{t(item.en, item.ar)}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-3 h-3 rounded-full border border-white/25" style={{ background: item.color }} />
                <span className="text-[9px] text-white/35">
                  {t(CATEGORY_META[item.category].en, CATEGORY_META[item.category].ar)}
                </span>
              </div>
            </div>
          </motion.button>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center text-white/40 text-xs py-8 rounded-2xl bg-black border border-white/10">
            {t("No garments match this filter", "لا توجد قطع مطابقة لهذا الفلتر")}
          </div>
        )}
      </div>

    </div>
  );
}
