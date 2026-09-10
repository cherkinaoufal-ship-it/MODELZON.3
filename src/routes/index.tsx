import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { syncMissions, getProgress, MISSIONS, type Stats } from "@/lib/progress.functions";
import type { Lang } from "@/lib/i18n";
import { uploadAvatar } from "@/lib/avatar";
import { requestProduction } from "@/lib/production";
import type { ProductionMeasurements } from "@/lib/production";
import ProductionRequestDialog from "@/components/modelzon/ProductionRequestDialog";
import { listFriends, removeFriend, FRIEND_LIMIT } from "@/lib/friends.functions";
import {
  sendFriendRequest, respondFriendRequest, listIncomingFriendRequests, getOutgoingFriendRequest,
  type FriendRequestSummary,
} from "@/lib/friendRequests.functions";
import { DECORATION_TYPES, type DecorationTypeId, type FabricTypeId } from "@/lib/materialPresets";

import MyShopCard from "@/components/modelzon/MyShopCard";
import type { CurrencyCode } from "@/lib/currency";
import { convertUsdCentsToCurrency, formatMoney } from "@/lib/currency";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shirt, HardHat, Crown, Trophy, Lock, ShoppingBag, Play,
  Settings, MessageSquare, Sparkles, X, Bot, User,
  Palette as PaletteIcon, Swords, Store, Brush, Clapperboard,
  Snowflake, Sun, CheckCircle2, Circle, Camera, Factory, Users,
  Image as ImageIcon, LayoutGrid, RotateCw, PersonStanding, Footprints, Wind,
  Grid3x3, SlidersHorizontal, Shield, Sticker, Upload, Plus,
  Printer, Hourglass, Check, UserPlus, Undo2, Redo2,
} from "lucide-react";
import ChatPanel from "@/components/modelzon/ChatPanel";
import ShortsFeed from "@/components/modelzon/ShortsFeed";
import ProToolbar from "@/components/modelzon/ProToolbar";
import ColorPickerHSV from "@/components/modelzon/ColorPickerHSV";
import GarmentPartsSheet from "@/components/modelzon/GarmentPartsSheet";
import ScrollTopFab from "@/components/modelzon/ScrollTopFab";
import MockupBoard2D from "@/components/modelzon/MockupBoard2D";
import { VideoUploadDialog, VideoUploadPicker } from "@/components/modelzon/VideoUpload";

import {
  composeElements, ensureImagesLoaded, newImageElement, newTextElement, panelDesignToTexture,
  type DesignElement, type PanelId,
} from "@/lib/designElements";

import { DEFAULT_BRUSH, type BrushSettings } from "@/lib/paint-engine";
import { DEFAULT_DECAL_TRANSFORM } from "@/components/modelzon/DecalControls";

import SettingsPanel from "@/components/modelzon/SettingsPanel";
import XPBar from "@/components/modelzon/XPBar";
import RankCards, { RANKS, RankBadge } from "@/components/modelzon/RankCards";
import AIDesignChat from "@/components/modelzon/AIDesignChat";
import ArenaHero from "@/components/modelzon/ArenaHero";
import ArenaBoard from "@/components/modelzon/ArenaBoard";
import CompetitorsRoom from "@/components/modelzon/CompetitorsRoom";
import GarmentLibrary from "@/components/modelzon/GarmentLibrary";
import type { GarmentType, SizeId, Studio3DHandle, GarmentPose } from "@/components/Studio3D";
import type { GarmentItem } from "@/data/garments";
import { SIZES } from "@/data/garments";
import { useAuth } from "@/lib/auth";
import { useUsernameAvailability, USERNAME_TAKEN_AR } from "@/lib/username";
import { supabase } from "@/lib/supabase";
import AuthGate from "@/components/modelzon/AuthGate";
import { Loader2, Save, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

// §2 — Studio panel sheet: slides bottom→up OVER the full-height viewport.
// Closes by tapping outside or dragging the handle down; the 3D model stays
// visible behind (glass sheet, max 82% height, internal scroll).
type StudioPanelId = "garments" | "fit" | "ai" | "paint" | "print" | "bg" | "layout";

function StudioSheet({
  open, title, icon, onClose, children,
}: {
  open: boolean;
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  useEffect(() => { setDragY(0); }, [open]);
  if (!open) return null;
  const transition = startY.current === null ? "transform 200ms cubic-bezier(.2,.8,.2,1)" : "none";
  return (
    <>
      <style>{`@keyframes mzSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div className="absolute inset-0 z-30 bg-black/30" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 z-40 flex flex-col rounded-t-3xl border-t border-white/15 bg-[#0a0a16]/95 backdrop-blur-xl shadow-[0_-16px_48px_rgba(0,0,0,.65)] max-h-[82%]"
        style={{ animation: "mzSheetUp 220ms cubic-bezier(.2,.8,.2,1)", transform: `translateY(${dragY}px)`, transition }}
      >
        <div
          className="shrink-0 pt-2.5 pb-1.5 flex justify-center cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={(e) => { startY.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); setDragY(0); }}
          onPointerMove={(e) => { if (startY.current !== null) setDragY(Math.max(0, e.clientY - startY.current)); }}
          onPointerUp={() => { const close = dragY > 64; startY.current = null; if (close) onClose(); else setDragY(0); }}
          onPointerCancel={() => { startY.current = null; setDragY(0); }}
        >
          <div className="w-12 h-1.5 rounded-full bg-white/30" />
        </div>
        <div className="shrink-0 flex items-center gap-2 px-4 pb-1.5">
          {icon}
          <span className="text-sm font-black text-white/90">{title}</span>
          <button onClick={onClose} className="ml-auto w-7 h-7 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-white/70 hover:text-white">
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-3 pb-4 overscroll-contain">{children}</div>
      </div>
    </>
  );
}

import { saveDesign, listMyDesigns, deleteDesign, type SavedDesign } from "@/lib/designs";
import { fetchTopPlayers, type LeaderboardEntry } from "@/lib/leaderboard";
import { fetchMarketplace, listDesignForSale, unlistDesign, createPendingOrder, type MarketplaceListing } from "@/lib/marketplace";
import { createCheckoutSession, confirmCheckoutSession } from "@/lib/stripe.functions";
import ShippingAddressDialog, { type ShippingAddress } from "@/components/modelzon/ShippingAddressDialog";
import AIGraphicAssistant from "@/components/modelzon/AIGraphicAssistant";
import BattleRoom from "@/components/modelzon/BattleRoom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isNativeAndroid, initRevenueCat, purchaseTierNative, openNativeSubscriptionManagement } from "@/lib/revenuecat";
import { syncConnectStatus } from "@/lib/stripe-connect.functions";
import { createSubscriptionCheckout, confirmSubscriptionCheckout, openBillingPortal, TIER_PRICES_CENTS, type SubTier } from "@/lib/subscription.functions";
import { useArenaPresence } from "@/lib/presence";
import { toast } from "sonner";


const Studio3D = lazy(() => import("@/components/Studio3D"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MODELZON — 3D Fashion Design Arena" },
      { name: "description", content: "Design, battle, and stream ultra-realistic 3D clothing. Style library, painting tools, ranked arenas, and creator monetization." },
      { property: "og:title", content: "MODELZON — 3D Fashion Design Arena" },
      { property: "og:description", content: "3D fashion battles, style library, and creator marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Modelzon,
});

type TabId = "studio" | "arena" | "feed" | "market" | "ranks" | "profile";
/** Pseudo-tab id for the bottom-bar "+" upload action (§2) — never an
 *  actual screen, but it rides the NAV array for ordering/gating. */
type NavId = TabId | "upload";

const GARMENTS: { id: GarmentType; label: string; icon: any }[] = [
  { id: "tee", label: "Tee", icon: Shirt },
  { id: "hoodie", label: "Hoodie", icon: Shirt },
  { id: "sweater", label: "Sweater", icon: Shirt },
  { id: "cap", label: "Cap", icon: HardHat },
  { id: "pants", label: "Pants", icon: Crown },
  { id: "shorts", label: "Shorts", icon: Crown },
  { id: "skirt", label: "Skirt", icon: Crown },
];

const PALETTE = ["#22d3ee", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#f43f5e", "#0f172a", "#f8fafc"];
// Exclusive colors gated behind a Pro/Elite subscription (see profiles.subscription_tier).

/** Client-side gate only — there's no backend/auth in this app, so this just
 *  hides the API Keys panel from casual visitors on a shared link. Anyone who
 *  opens devtools can bypass it. Change this PIN to something only you know,
 *  and if these keys are truly sensitive, move them to a real backend/env
 *  var instead of the browser. */
const OWNER_PIN = "2580";

/**
 * Garment part/texture stickers — real inline SVG assets (no external
 * files, so nothing can 404), placed exactly like uploaded artwork (same
 * DecalControls: full drag/resize/rotate). See fabricEffects.ts for the
 * honest scope note on what "mesh reveals what's underneath" actually
 * means here (the garment's own layers, not a body — there's no body mesh
 * in this project).
 */

const NAV: { id: NavId; icon: any; en: string; ar: string; minLevel?: number; mobileOnly?: boolean; desktopOnly?: boolean }[] = [
  { id: "studio", icon: Shirt, en: "Studio", ar: "الاستوديو" },
  { id: "arena", icon: Swords, en: "Arena", ar: "الساحة" },
  // §2 — the big gradient "+" in the MIDDLE of the mobile bottom bar:
  // opens the shared video-upload flow (gallery vs camera), then jumps to
  // Reels after posting. It's not a tab — it's an action.
  { id: "upload", icon: Plus, en: "Upload", ar: "رفع", mobileOnly: true },
  // §4 — the Garments library lives ONLY inside the Studio now (its
  // "Garments" panel); the old standalone sidebar entry was removed.
  { id: "feed", icon: Clapperboard, en: "Reels", ar: "ريلز" },
  // Hidden from the bottom bar until Level 50 (or Elite) — same gate as
  // marketplace selling itself (see 003_marketplace.sql) — then it just
  // appears on its own, no announcement needed.
  { id: "market", icon: Store, en: "Market", ar: "السوق", minLevel: 50 },
  { id: "profile", icon: User, en: "Profile", ar: "الملف" },
  // "Ranks" removed from the bottom bar — it now lives as an icon inside
  // Profile (see the trophy button next to the avatar), since it's
  // something you check occasionally, not a primary destination.
];

function Modelzon() {
  const { user, profile, loading: authLoading, signOut, updateProfile, refreshProfile } = useAuth();
  const studioRef = useRef<Studio3DHandle>(null);

  // Initialize RevenueCat as soon as we know who's signed in, but only on
  // native Android — no-op everywhere else (see isNativeAndroid()).
  useEffect(() => {
    if (user?.id) void initRevenueCat(user.id);
  }, [user?.id]);

  const [garment, setGarment] = useState<GarmentType>("hoodie");
  const [color, setColor] = useState("#a855f7");
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [size, setSize] = useState<SizeId>("M");
  const [profileName, setProfileName] = useState("Sultan_Design");
  const [profileBio, setProfileBio] = useState("Elite 3D Streetwear Designer • Multi-Battle Champion ⚡");
  // §1 — live uniqueness check on the display name in Settings. The check
  // is skipped entirely while the field still equals the saved name, so
  // opening Settings never flags your own name as "taken".
  const settingsNameStatus = useUsernameAvailability(profileName);
  const settingsNameChanged = profileName.trim().toLowerCase() !== (profile?.username ?? "").toLowerCase();
  const settingsNameTaken = settingsNameChanged && settingsNameStatus === "taken";
  const settingsNameInvalid = settingsNameChanged && settingsNameStatus === "invalid";
  const settingsNameChecking = settingsNameChanged && settingsNameStatus === "checking";
  // playerId is now the real Supabase auth user id — stable per account, not per browser.
  const playerId = user ? `MZ-${user.id.slice(0, 6).toUpperCase()}` : "MZ-000000";


  const [brush, setBrush] = useState<BrushSettings>({ ...DEFAULT_BRUSH, tool: "select" });
  const [frozen, setFrozen] = useState(false);
  const [undoSignal, setUndoSignal] = useState(0);
  const [clearSignal, setClearSignal] = useState(0);
  const [topic, setTopic] = useState("ستريت وير سعودي بخط عربي ذهبي");
  const [fabricType] = useState<FabricTypeId>("cotton");
  const [decorationType, setDecorationType] = useState<DecorationTypeId>("screen");
  const [decorationTypeBack, setDecorationTypeBack] = useState<DecorationTypeId>("screen");
  // decalUrl / decalUrlBack are DERIVED now: they hold the pretty per-side
  // composites of the element list below (used by saving, the marketplace,
  // battles and thumbnails). The 3D garment itself reads the RAW full-canvas
  // overlays (overlayFront/BackUrl → Studio3D) — see lib/designElements.ts.
  const [decalUrl, setDecalUrl] = useState<string | null>(null);
  const [decalUrlBack, setDecalUrlBack] = useState<string | null>(null);
  // The design elements themselves (images + text) — the single source of
  // truth for everything placed on the mockup panels (§1/§4/§7).
  const [elements, setElements] = useState<DesignElement[]>([]);
  const elementImagesRef = useRef(new Map<string, HTMLImageElement>());

  // §14b — garment-level Undo/Redo over the design ELEMENTS (images, text):
  // every change to the elements array is snapshotted (throttled so a drag
  // gesture counts as one step, capped at 50 steps) so accidental deletions
  // or edits can always be walked back — and forward again with Redo.
  const elementsHistoryRef = useRef<{ past: DesignElement[][]; future: DesignElement[][]; lastPushAt: number; skipNext: boolean }>(
    { past: [], future: [], lastPushAt: 0, skipNext: false },
  );
  const prevElementsRef = useRef<DesignElement[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0); // re-render for button enabled states
  useEffect(() => {
    const h = elementsHistoryRef.current;
    if (elements === prevElementsRef.current) return;
    if (h.skipNext) {
      h.skipNext = false;
      prevElementsRef.current = elements;
      setHistoryVersion((v) => v + 1);
      return;
    }
    const now = Date.now();
    if (now - h.lastPushAt > 400) {
      h.past.push(prevElementsRef.current);
      if (h.past.length > 50) h.past.shift();
      h.future = [];
      setHistoryVersion((v) => v + 1);
    }
    // within the throttle window (mid-drag): coalesce into the last step
    h.lastPushAt = now;
    prevElementsRef.current = elements;
  }, [elements]);
  const undoElements = useCallback(() => {
    const h = elementsHistoryRef.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(prevElementsRef.current);
    h.skipNext = true;
    setElements(prev);
  }, []);
  const redoElements = useCallback(() => {
    const h = elementsHistoryRef.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(prevElementsRef.current);
    h.skipNext = true;
    setElements(next);
  }, []);

  // §14e — confirmation before any permanent deletion (designs, friends…).
  const [confirmAction, setConfirmAction] = useState<{ message: string; confirmLabel: string; onConfirm: () => void } | null>(null);

  const [overlayFront, setOverlayFront] = useState<string | null>(null);
  const [overlayBack, setOverlayBack] = useState<string | null>(null);
  const [decalSide, setDecalSide] = useState<PanelId>("front");
  const [studioPanel, setStudioPanel] = useState<StudioPanelId | null>("garments");
  const [partsSheetOpen, setPartsSheetOpen] = useState(false);
  // §2 — bottom-bar "+" upload flow state (shared VideoUpload components).
  const [navUploadOpen, setNavUploadOpen] = useState(false);
  const [navUploadFile, setNavUploadFile] = useState<File | null>(null);

  const [studioBg, setStudioBg] = useState("#000000");
  const [profileTab, setProfileTab] = useState<"designs" | "plan" | "payouts" | "friends" | "settings">("designs");
  const [pose, setPose] = useState<GarmentPose>("stand");
  const artworkFileRef = useRef<HTMLInputElement>(null);



  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const xpToNext = 1000;
  const [coins, setCoins] = useState(0);
  const [popups, setPopups] = useState<{ id: number; text: string }[]>([]);
  const [userScore, setUserScore] = useState(0);
  const [missions, setMissions] = useState(0);

  const [lang, setLang] = useState<Lang>("en"); // new sessions default to English; the person changes it themselves in Settings — never auto-detected/forced
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const [privacy, setPrivacy] = useState(true);
  // Privacy switch is a real protection flag: it persists to the profile and
  // RLS uses it to decide whether visitors can read this user's designs.
  const changePrivacy = useCallback((v: boolean) => {
    setPrivacy(v);
    void updateProfile({ is_private: v });
  }, [updateProfile]);
  const [volume, setVolume] = useState(70);
  const [visualizer, setVisualizer] = useState(true);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  // Hydrate local state from the real Supabase profile once it loads,
  // and keep Supabase in sync afterwards (debounced) whenever these change.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!profile) return;
    setProfileName(profile.username);
    setProfileBio(profile.bio);
    setAvatarUrl(profile.avatar_url ?? null);
    setLevel(profile.level);
    setXp(profile.xp % 1000); // xp column is lifetime total; the bar shows progress *within* the current level (see XP_PER_LEVEL in progress.functions.ts)
    setCoins(profile.coins);
    setUserScore(profile.score);
    setMissions(profile.missions);
    setLang(profile.lang);
    setPrivacy(profile.is_private ?? true);
    hydrated.current = true;
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated.current || !user) return;
    const t = setTimeout(() => {
      // level/xp/coins/score/missions are server-authoritative now (see
      // 013_missions_progress.sql + progress.functions.ts) — only `lang`
      // is legitimately something the client itself should ever write.
      updateProfile({ lang } as any);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const [battleTimer, setBattleTimer] = useState(180);
  // §1 — land straight in the Studio after login (no auto-opening upload
  // dialog, no separate garments screen).
  const [tab, setTab] = useState<TabId>("studio");

  // §14d — every main tab opens at the top of its page: reset both the
  // window scroll (mobile) and the desktop center column on tab change.
  const mainScrollRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    mainScrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);
  const [aiOpen, setAiOpen] = useState(false);
  const popupId = useRef(0);

  const [myDesigns, setMyDesigns] = useState<SavedDesign[]>([]);
  const [openDesign, setOpenDesign] = useState<SavedDesign | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [requestingProductionId, setRequestingProductionId] = useState<string | null>(null);

  // ---- Friends / Clan (Pro+ perk) ----
  const [friends, setFriends] = useState<{ id: string; username: string; level: number; avatar_url: string | null }[]>([]);
  // §9 — instant search by name / @handle instead of typing a raw Player ID
  const [friendQuery, setFriendQuery] = useState("");
  const [friendResults, setFriendResults] = useState<{ id: string; username: string; level: number; avatar_url: string | null }[]>([]);
  const [friendSearching, setFriendSearching] = useState(false);

  useEffect(() => {
    const q = friendQuery.trim().replace(/^@+/, "");
    if (!user || q.length < 2) { setFriendResults([]); setFriendSearching(false); return; }
    setFriendSearching(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, level, avatar_url")
        .ilike("username", `%${q}%`)
        .neq("id", user.id)
        .order("level", { ascending: false })
        .limit(8);
      setFriendResults((data ?? []) as { id: string; username: string; level: number; avatar_url: string | null }[]);
      setFriendSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [friendQuery, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const listFriendsFn = useServerFn(listFriends);
  const removeFriendFn = useServerFn(removeFriend);
  // "+" add-friend button state on the inspection card (§9b). Declared
  // here — before the handlers — because both the friends block and the
  // viewer card read it.
  const [friendReqState, setFriendReqState] = useState<"idle" | "sending" | "pending" | "friends">("idle");
  // §9b — friend requests (30-day expiry handled server-side).
  const sendRequestFn = useServerFn(sendFriendRequest);
  const respondRequestFn = useServerFn(respondFriendRequest);
  const listIncomingFn = useServerFn(listIncomingFriendRequests);
  const outgoingStatusFn = useServerFn(getOutgoingFriendRequest);
  const [friendRequests, setFriendRequests] = useState<FriendRequestSummary[]>([]);

  const refreshFriends = useCallback(async () => {
    if (!user) return;
    try { setFriends(await listFriendsFn({ data: { userId: user.id } }) as any); } catch { /* non-critical */ }
    try { setFriendRequests(await listIncomingFn({ data: { userId: user.id } }) as FriendRequestSummary[]); } catch { /* table may not be migrated yet */ }
  }, [user, listFriendsFn, listIncomingFn]);

  const handleRespondRequest = useCallback(async (requestId: string, accept: boolean) => {
    if (!user) return;
    try {
      await respondRequestFn({ data: { requestId, userId: user.id, accept } });
      if (accept) toast.success(t("Friend added 🎉", "تمت إضافة الصديق 🎉"));
      void refreshFriends();
    } catch (e: any) {
      toast.error(e?.message ?? t("Couldn't answer the request", "تعذّر الرد على الطلب"));
    }
  }, [user, respondRequestFn, refreshFriends]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (user && tab === "profile") void refreshFriends(); }, [user?.id, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendFriendRequest = useCallback(async (targetId: string) => {
    if (!user || friendReqState === "sending" || friendReqState === "pending" || friendReqState === "friends") return;
    setFriendReqState("sending");
    try {
      const res = await sendRequestFn({ data: { userId: user.id, targetId } });
      if (res.status === "accepted") {
        setFriendReqState("friends");
        toast.success(t("You're now friends 🎉", "صرتما أصدقاء 🎉"));
        void refreshFriends();
      } else {
        setFriendReqState("pending");
        toast.success(t("Friend request sent — waits 30 days for their answer ⏳", "تم إرسال طلب الصداقة — ينتظر ردهم 30 يوم ⏳"));
      }
    } catch (e: any) {
      setFriendReqState("idle");
      const msg = String(e?.message ?? "");
      if (msg.includes("Already in your clan")) { setFriendReqState("friends"); return; }
      toast.error(msg || t("Couldn't send the request", "تعذّر إرسال الطلب"));
    }
  }, [user, friendReqState, sendRequestFn, refreshFriends]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemoveFriend = useCallback(async (friendId: string) => {
    if (!user) return;
    await removeFriendFn({ data: { userId: user.id, friendId } });
    void refreshFriends();
  }, [user, removeFriendFn, refreshFriends]);

  const [productionDesignId, setProductionDesignId] = useState<string | null>(null);

  const handleRequestProduction = useCallback(async (measurements: ProductionMeasurements) => {
    if (!user || !productionDesignId) return;
    setRequestingProductionId(productionDesignId);

    // From the Studio button, the current design may not be saved yet at
    // all — save it first so there's a real design row to attach the
    // production request to, instead of silently failing on a fake id.
    let realDesignId = productionDesignId;
    if (productionDesignId === "studio-current") {
      const saveResult = await saveDesign({
        userId: user.id,
        garment, size, color,
        decalUrl, decalTransform: decalUrl ? DEFAULT_DECAL_TRANSFORM : null,
        decalUrlBack, decalTransformBack: decalUrlBack ? DEFAULT_DECAL_TRANSFORM : null,
        title: `${garment} · ${topic}`.slice(0, 80),
        paintDataUrl: studioRef.current?.getPaintDataUrl() ?? null,
      });
      if (!saveResult.ok) {
        setRequestingProductionId(null);
        toast.error(saveResult.reason === "duplicate"
          ? t("This exact design is already saved — request production from your saved designs instead.", "هذا التصميم محفوظ أصلاً — اطلب التصنيع من تصاميمك المحفوظة.")
          : t("Couldn't save the design first", "تعذّر حفظ التصميم أولاً"));
        return;
      }
      realDesignId = saveResult.design.id;
      refreshDesigns();
    }

    const result = await requestProduction(realDesignId, user.id, measurements);
    setRequestingProductionId(null);
    if (result.ok) {
      toast.success(t("Request sent — we'll follow up with pricing and timeline 🏭", "تم إرسال الطلب — بنتواصل معك بالسعر والمدة 🏭"));
      setProductionDesignId(null);
    } else {
      toast.error(result.message ?? t("Couldn't send request", "تعذّر إرسال الطلب"));
    }
  }, [user, lang, productionDesignId, garment, size, color, decalUrl, decalUrlBack, topic]); // eslint-disable-line react-hooks/exhaustive-deps

  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);
  const [battleActive, setBattleActive] = useState(false);
  const [designsLoading, setDesignsLoading] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);

  const [topPlayers, setTopPlayers] = useState<LeaderboardEntry[]>([]);
  const [viewingPlayer, setViewingPlayer] = useState<LeaderboardEntry | null>(null);
  const [viewedBio, setViewedBio] = useState("");
  const [viewedAvatar, setViewedAvatar] = useState<string | null>(null);
  const [viewedPrivate, setViewedPrivate] = useState(false);
  const [viewedDesigns, setViewedDesigns] = useState<SavedDesign[]>([]);
  // §9 — inspection card: content toggles (designs/videos), the shorts
  // themselves, and the "+" add-friend button state (idle/hourglass/friend).
  const [viewedSection, setViewedSection] = useState<"designs" | "videos">("designs");
  const [viewedShorts, setViewedShorts] = useState<{ id: string; video_url: string }[]>([]);

  // Load the tapped player's public card: bio + avatar always, saved designs
  // only when their Privacy switch is OFF (RLS enforces this server-side too).
  useEffect(() => {
    const id = viewingPlayer?.id;
    if (!id) { setViewedBio(""); setViewedAvatar(null); setViewedDesigns([]); setViewedPrivate(false); setViewedShorts([]); setViewedSection("designs"); setFriendReqState("idle"); return; }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("profiles").select("bio, avatar_url, is_private").eq("id", id).maybeSingle();
      if (cancelled) return;
      const isPrivate = data?.is_private ?? true;
      setViewedBio(data?.bio ?? "");
      setViewedAvatar(data?.avatar_url ?? null);
      setViewedPrivate(isPrivate && id !== user?.id);
      if (isPrivate && id !== user?.id) { setViewedDesigns([]); return; }
      const { data: designs } = await supabase
        .from("designs")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(9);
      if (!cancelled) setViewedDesigns((designs ?? []) as SavedDesign[]);
      // Their public reels (§9 — videos icon on the inspection card).
      const { data: shorts } = await supabase
        .from("shorts")
        .select("id, video_url")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(9);
      if (!cancelled) setViewedShorts((shorts ?? []) as { id: string; video_url: string }[]);
      // Am I already waiting on a friend request to them? (hourglass state)
      if (id !== user?.id) {
        try {
          const res = await outgoingStatusFn({ data: { userId: user!.id, targetId: id } });
          if (!cancelled && res.status === "pending") setFriendReqState("pending");
        } catch { /* requests table not migrated yet — plain "+" */ }
      }
    })();
    return () => { cancelled = true; };
  }, [viewingPlayer?.id, user?.id, outgoingStatusFn]); // eslint-disable-line react-hooks/exhaustive-deps
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    if (tab !== "ranks" || !user) return;
    setLeaderboardLoading(true);
    fetchTopPlayers(10).then((rows) => {
      setTopPlayers(rows);
      setLeaderboardLoading(false);
    });
  }, [tab, user, level, xp]); // refetch when tab opens or the user's own level/xp changes

  const [marketListings, setMarketListings] = useState<MarketplaceListing[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [sellPriceDraft, setSellPriceDraft] = useState<Record<string, string>>({});
  const [shippingListing, setShippingListing] = useState<MarketplaceListing | null>(null);

  const refreshMarket = useCallback(async () => {
    setMarketLoading(true);
    setMarketListings(await fetchMarketplace());
    setMarketLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "market" && user) refreshMarket();
  }, [tab, user, refreshMarket]);

  const handleListForSale = useCallback(async (designId: string) => {
    const raw = sellPriceDraft[designId];
    const dollars = Number(raw);
    if (!raw || Number.isNaN(dollars) || dollars <= 0) {
      toast.error(lang === "ar" ? "اكتب سعر صحيح أكبر من صفر" : "Enter a valid price");
      return;
    }
    const result = await listDesignForSale(designId, Math.round(dollars * 100));
    if (result.ok) {
      toast.success(lang === "ar" ? "تم عرض تصميمك بالسوق 🎉" : "Listed on the marketplace 🎉");
      refreshDesigns();
      void refreshMissions();
    } else {
      toast.error(result.message ?? (lang === "ar" ? "تعذّر عرض التصميم" : "Couldn't list the design"));
    }
  }, [sellPriceDraft, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlist = useCallback(async (designId: string) => {
    if (await unlistDesign(designId)) {
      toast.success(lang === "ar" ? "تم سحب التصميم من السوق" : "Removed from the marketplace");
      refreshDesigns();
    }
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuy = useCallback((listing: MarketplaceListing) => {
    if (!user) return;
    if (listing.user_id === user.id) {
      toast.error(lang === "ar" ? "ما تقدر تشتري تصميمك أنت" : "You can't buy your own design");
      return;
    }
    // Collect a real shipping address first — see ShippingAddressDialog.
    setShippingListing(listing);
  }, [user, lang]);

  const handleConfirmPurchase = useCallback(async (address: ShippingAddress) => {
    const listing = shippingListing;
    if (!user || !listing) return;
    setBuyingId(listing.id);
    const order = await createPendingOrder({
      designId: listing.id,
      buyerId: user.id,
      sellerId: listing.user_id,
      priceCents: listing.price_cents,
      shipping: address,
    });
    if (!order.ok || !order.orderId) {
      setBuyingId(null);
      toast.error(order.message ?? (lang === "ar" ? "تعذّر إتمام الطلب" : "Couldn't place the order"));
      return;
    }
    try {
      const session = await createCheckoutSession({
        data: {
          orderId: order.orderId,
          sellerId: listing.user_id,
          title: listing.title || listing.garment,
          priceCents: listing.price_cents,
          origin: window.location.origin,
          currency,
        },
      });
      setShippingListing(null);
      window.location.href = session.url; // hand off to Stripe's hosted checkout page
    } catch (e) {
      setBuyingId(null);
      toast.error(lang === "ar" ? "تعذّر فتح صفحة الدفع، حاول مرة ثانية" : "Couldn't open checkout, try again");
    }
  }, [user, lang, shippingListing, currency]);

  const [subscribing, setSubscribing] = useState<SubTier | null>(null);

  const handleSubscribe = useCallback(async (tier: SubTier) => {
    if (!user) return;
    setSubscribing(tier);

    // Google Play policy requires Android in-app subscriptions to go
    // through Google Play Billing — RevenueCat handles that path; Stripe
    // stays exactly as-is for web. See src/lib/revenuecat.ts.
    if (isNativeAndroid()) {
      const result = await purchaseTierNative(tier);
      setSubscribing(null);
      if (result.ok) {
        toast.success(lang === "ar" ? `تم تفعيل اشتراك ${tier.toUpperCase()} 🎉` : `${tier.toUpperCase()} subscription activated 🎉`);
        await refreshProfile();
      } else if (!result.cancelled) {
        toast.error(result.message ?? (lang === "ar" ? "تعذّر إتمام الاشتراك" : "Couldn't complete the subscription"));
      }
      return;
    }

    try {
      const session = await createSubscriptionCheckout({ data: { tier, userId: user.id, origin: window.location.origin, currency } });
      window.location.href = session.url;
    } catch {
      setSubscribing(null);
      toast.error(lang === "ar" ? "تعذّر فتح صفحة الاشتراك" : "Couldn't open subscription checkout");
    }
  }, [user, lang, refreshProfile, currency]);

  const handleManageBilling = useCallback(async () => {
    if (isNativeAndroid()) {
      await openNativeSubscriptionManagement();
      return;
    }
    if (!profile?.stripe_customer_id) return;
    try {
      const portal = await openBillingPortal({ data: { customerId: profile.stripe_customer_id, origin: window.location.origin } });
      window.location.href = portal.url;
    } catch {
      toast.error(lang === "ar" ? "تعذّر فتح صفحة إدارة الاشتراك" : "Couldn't open billing portal");
    }
  }, [profile?.stripe_customer_id, lang]);

  // §9 — Stripe payout onboarding UI is deleted from the profile; the
  // connect=return sync below is all that remains (harmless if never used).

  // Handle the redirect back from Stripe (?checkout=... for one-time orders,
  // ?sub=... for subscription checkouts).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const sub = params.get("sub");
    if (!checkout && !sub) return;
    const orderId = params.get("order");
    const sessionId = params.get("session_id");
    const tier = params.get("tier") as SubTier | null;

    (async () => {
      if (checkout === "success" && orderId && sessionId) {
        try {
          const result = await confirmCheckoutSession({ data: { sessionId, orderId } });
          toast[result.paid ? "success" : "error"](
            result.paid
              ? lang === "ar" ? "تم الدفع بنجاح! 🎉 التصميم صار لك" : "Payment successful! 🎉"
              : lang === "ar" ? "ما انتأكد الدفع، تواصل معنا لو فيه مبلغ اتخصم" : "Payment could not be verified",
          );
        } catch {
          toast.error(lang === "ar" ? "صار خطأ بتأكيد الدفع" : "Error confirming payment");
        }
      } else if (checkout === "cancel") {
        toast(lang === "ar" ? "تم إلغاء الدفع" : "Checkout cancelled");
      } else if (sub === "success" && sessionId && tier && user) {
        setSubscribing(null);
        try {
          const result = await confirmSubscriptionCheckout({ data: { sessionId, userId: user.id, tier } });
          if (result.active) {
            toast.success(lang === "ar" ? `تم تفعيل اشتراك ${tier.toUpperCase()} 🎉` : `${tier.toUpperCase()} subscription activated 🎉`);
            refreshProfile();
          } else {
            toast.error(lang === "ar" ? "ما انتأكد الاشتراك" : "Subscription could not be verified");
          }
        } catch {
          toast.error(lang === "ar" ? "صار خطأ بتأكيد الاشتراك" : "Error confirming subscription");
        }
      } else if (sub === "cancel") {
        setSubscribing(null);
        toast(lang === "ar" ? "تم إلغاء الاشتراك" : "Subscription cancelled");
      }
      window.history.replaceState({}, "", window.location.pathname);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // §9 — the current user's reels live in the SAME saved-content grid as
  // their designs (small type badge distinguishes them), instead of a
  // separate reels place on the profile.
  const [myShorts, setMyShorts] = useState<{ id: string; video_url: string; caption: string; likes_count: number; created_at: string }[]>([]);
  const [openShort, setOpenShort] = useState<{ id: string; video_url: string; caption: string } | null>(null);

  const refreshDesigns = useCallback(async () => {
    if (!user) return;
    setDesignsLoading(true);
    const rows = await listMyDesigns(user.id);
    setMyDesigns(rows);
    const { data: shorts } = await supabase
      .from("shorts")
      .select("id, video_url, caption, likes_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setMyShorts(shorts ?? []);
    setDesignsLoading(false);
  }, [user]);

  useEffect(() => {
    if (tab === "profile" && user) refreshDesigns();
  }, [tab, user, refreshDesigns]);

  const handleSaveDesign = useCallback(async () => {
    if (!user) return;
    // §3 — nothing designed yet (no elements, no freehand paint): refuse
    // locally with a clear message and make NO API call at all.
    if (elements.length === 0 && !studioRef.current?.getPaintDataUrl()) {
      toast.error(lang === "ar" ? "تعذّر الحفظ لأنه لم يتم صنع أي تصميم بعد" : "Can't save — no design has been created yet");
      return;
    }
    setSavingDesign(true);
    const result = await saveDesign({
      userId: user.id,
      garment,
      size,
      color,
      decalUrl,
      decalTransform: decalUrl ? DEFAULT_DECAL_TRANSFORM : null,
      decalUrlBack,
      decalTransformBack: decalUrlBack ? DEFAULT_DECAL_TRANSFORM : null,
      title: `${garment} · ${topic}`.slice(0, 80),
      paintDataUrl: studioRef.current?.getPaintDataUrl() ?? null,
    });
    setSavingDesign(false);
    if (result.ok) {
      toast.success(lang === "ar" ? "تم حفظ التصميم ✅" : "Design saved ✅");
      void refreshMissions();
      refreshDesigns();
    } else if (result.reason === "duplicate") {
      toast.error(result.message);
    } else {
      toast.error(lang === "ar" ? "تعذّر حفظ التصميم، حاول مرة ثانية" : "Couldn't save the design, try again");
    }
  }, [user, elements, garment, size, color, decalUrl, decalUrlBack, topic, lang, refreshDesigns]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteDesign = useCallback(async (id: string) => {
    const removed = await deleteDesign(id);
    if (removed) {
      setMyDesigns((d) => d.filter((x) => x.id !== id));
      toast.success(lang === "ar" ? "تم حذف التصميم" : "Design deleted");
    }
  }, [lang]);


  const grantXP = useCallback((amount: number, label: string) => {
    const id = ++popupId.current;
    setPopups((p) => [...p, { id, text: `+${amount} XP · ${label}` }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1200);
  }, []);

  const syncMissionsFn = useServerFn(syncMissions);
  const getProgressFn = useServerFn(getProgress);
  const [completedMissionIds, setCompletedMissionIds] = useState<string[]>([]);
  const [missionStats, setMissionStats] = useState<Stats | null>(null);

  /** The ONLY path that actually grants XP now — calls the server, which
   *  independently re-checks real stats (designs saved, battles judged,
   *  sales made) against the mission catalog and only writes xp/level/coins
   *  if something genuinely newly completed. Safe to call liberally after
   *  any action that might have finished a mission; a no-op otherwise. */
  const refreshMissions = useCallback(async () => {
    if (!user) return;
    try {
      const result = await syncMissionsFn({ data: { userId: user.id } });
      setXp(result.xpIntoLevel);
      setLevel(result.level);
      setCoins(result.coins);
      setMissionStats(result.stats);
      for (const m of result.newlyCompleted) {
        grantXP(m.xp, lang === "ar" ? m.titleAr : m.titleEn);
      }
      if (result.newlyCompleted.length > 0) {
        setCompletedMissionIds((ids) => [...ids, ...result.newlyCompleted.map((m) => m.id)]);
        refreshProfile();
      }
    } catch {
      /* non-critical — the UI just won't show a fresh mission popup this time */
    }
  }, [user, lang, syncMissionsFn, grantXP, refreshProfile]);

  // Re-check missions once after login/profile load, in case something
  // completed in a previous session before this system existed.
  useEffect(() => { if (user) void refreshMissions(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the full completed-missions list + live stats for the checklist UI
  // (refreshMissions above only returns what's newly completed each call).
  useEffect(() => {
    if (!user) return;
    getProgressFn({ data: { userId: user.id } })
      .then((p) => { setCompletedMissionIds(p.completedMissionIds); setMissionStats(p.stats); })
      .catch(() => {});
  }, [user?.id, getProgressFn]);

  useEffect(() => {
    const id = setInterval(() => setBattleTimer((t) => (t > 0 ? t - 1 : 180)), 1000);
    return () => clearInterval(id);
  }, []);

  // Entering the Studio always lands on the garment picker first: pick the
  // piece that suits you, and the design panels open automatically after
  // that (see applyGarment).
  useEffect(() => {
    if (tab === "studio") setStudioPanel("garments");
  }, [tab]);

  // The mouse-pointer "Move" tool is gone by request — painting vs
  // navigating is now contextual instead of a tool button: paint tools are
  // live only while the Paint panel is open; everywhere else, dragging on
  // the garment orbits it (see paintingActive in Studio3D).
  useEffect(() => {
    setBrush((b) =>
      studioPanel === "paint"
        ? { ...b, tool: b.tool === "select" ? "draw" : b.tool }
        : { ...b, tool: "select" },
    );
  }, [studioPanel]);

  const changeGarment = (g: GarmentType) => { setGarment(g); setModelPath(null); };
  const changeColor = (c: string) => { setColor(c); };

  // ---- Element system (§1/§4/§7) ----
  // One shared entry point for putting artwork on the design: routes to the
  // given mockup panel. Front & back (and the sleeve corners) all sync to
  // the 3D garment automatically through the overlay compositor below.
  const addElementToPanel = useCallback((panel: PanelId, dataUrl: string, aspect = 1) => {
    setElements((els) => [...els, newImageElement(panel, dataUrl, aspect)]);
    setDecalSide(panel);
  }, []);

  // §2 — LIVE text tool: whatever is typed in the Text panel is applied to
  // the active side immediately as a normal design element (no confirm
  // button). While the tool stays active the SAME element is updated in
  // place; leaving the Text tool "commits" it (it stays a fully
  // controllable element: drag / resize / rotate on the Mockups board).
  const liveTextIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (brush.tool !== "text") {
      // leaving the tool commits the element; next session starts fresh
      if (liveTextIdRef.current) {
        liveTextIdRef.current = null;
        setBrush((b) => ({ ...b, text: "" }));
      }
      return;
    }
    const text = brush.text.trim();
    const fontScale = Math.min(0.5, Math.max(0.05, 0.05 + ((brush.size - 2) / 88) * 0.45));
    if (!text) {
      // typed then cleared → remove the live preview element
      if (liveTextIdRef.current) {
        const id = liveTextIdRef.current;
        liveTextIdRef.current = null;
        setElements((els) => els.filter((e) => e.id !== id));
      }
      return;
    }
    if (!liveTextIdRef.current) {
      const el = newTextElement(decalSide, {
        text, font: brush.font, fontScale, color: brush.color, align: brush.textAlign,
      });
      liveTextIdRef.current = el.id;
      setElements((els) => [...els, el]);
    } else {
      const id = liveTextIdRef.current;
      setElements((els) => els.map((e) =>
        e.id === id ? { ...e, text, font: brush.font, fontScale, color: brush.color, align: brush.textAlign } : e,
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brush.tool, brush.text, brush.font, brush.color, brush.size, brush.textAlign, decalSide]);

  // Debounced recomposition: dragging an element fires dozens of patches a
  // second, and compositing two 1024² canvases + toDataURL isn't free — a
  // short trailing debounce keeps the 3D view live without jank.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void ensureImagesLoaded(elements, elementImagesRef.current).then(() => {
        if (cancelled) return;
        const result = composeElements(
          elements,
          { get: (src) => elementImagesRef.current.get(src) },
          decorationType,
          decorationTypeBack,
        );
        setOverlayFront(result.frontOverlayUrl);
        setOverlayBack(result.backOverlayUrl);
        setDecalUrl(result.frontPrettyUrl);
        setDecalUrlBack(result.backPrettyUrl);
      });
    }, 70);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [elements, decorationType, decorationTypeBack]);

  // Drawing on a mockup panel paints the REAL 3D texture region for that
  // panel (expanded editor draw mode — §7). Note: this never flips the
  // global brush tool, so orbiting the 3D garment stays available while a
  // paint session is live on the 2D board.
  const handleMockupPaint = useCallback((panel: PanelId, dx: number, dy: number, down: boolean) => {
    const { u, v } = panelDesignToTexture(panel, dx, dy);
    studioRef.current?.paintAtTexturePoint(u, v, down);
  }, []);

  const applyGarment = useCallback((item: GarmentItem) => {
    setGarment(item.category);
    setColor(item.color);
    setModelPath(item.path);
    setTab("studio");
    // Chosen a piece from the in-studio picker → straight into design mode
    // (§12: the old "Edit" tab merged into "Print", so land there).
    setStudioPanel("print");
    // (no XP for browsing the clothing library — missions reward real design work, see progress.functions.ts)
  }, []);

  // AI stylist now returns real generated artwork — drop it on the active
  // mockup panel as a fully-controllable element.
  const aiApplyDesign = useCallback((imageUrl: string) => {
    addElementToPanel(decalSide === "back" ? "back" : "front", imageUrl);
    setAiOpen(false);
    toast(lang === "ar" ? "تم تطبيق التصميم على القطعة ✨ عدّلها من تبويب الموك اب" : "Design applied ✨ tweak it in the Mockups tab");
    // (AI-generated art counts toward "Save your first design" once saved — no separate XP just for generating)
  }, [addElementToPanel, decalSide, lang]);

  // (Element-level undo is simply deleting the element; paint undo stays on
  //  the shared undoSignal pipeline — see the Print tab & paint panel.)

  const presenceStatus = (() => {
    switch (tab) {
      case "studio": return lang === "ar" ? "بيصمم" : "In Studio";
      case "arena": return lang === "ar" ? "بالساحة" : "In Arena";
      case "market": return lang === "ar" ? "بالسوق" : "Browsing Market";
      default: return lang === "ar" ? "متصل" : "Online";
    }
  })();
  const onlinePlayers = useArenaPresence(
    user ? { userId: user.id, username: profileName, level } : null,
    presenceStatus,
  );

  // A paid plan only counts as active while it hasn't expired: the upgrade
  // section hides on successful payment and comes back once the paid period
  // is over (subscription_renews_at in the past).
  const hasActiveSub = Boolean(
    profile &&
      profile.subscription_tier !== "free" &&
      (!profile.subscription_renews_at || new Date(profile.subscription_renews_at).getTime() > Date.now()),
  );
  const verified = level >= 50 || profile?.subscription_tier === "elite" || profile?.subscription_tier === "pro"; // Pro tier's "instant verified checkmark" perk

  const visibleNav = NAV.filter((n) => !n.minLevel || level >= n.minLevel || profile?.subscription_tier === "elite");
  const desktopNav = visibleNav.filter((n) => !n.mobileOnly);
  const bottomNav = visibleNav.filter((n) => !n.desktopOnly);
  // If someone is on the (now-hidden) Market tab and hasn't unlocked it,
  // bounce them somewhere they can actually see — otherwise the content
  // area could render a tab with no visible way back to it.
  useEffect(() => {
    if (tab === "market" && !visibleNav.some((n) => n.id === "market")) setTab("studio");
  }, [tab, visibleNav]); // eslint-disable-line react-hooks/exhaustive-deps
  const mins = Math.floor(battleTimer / 60);
  const secs = String(battleTimer % 60).padStart(2, "0");
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);

  // Real auth gate: nothing below renders — and no XP/coins/design state can
  // drift — until there is a signed-in Supabase user.
  if (authLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }
  if (!user) {
    return <AuthGate />;
  }

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-black text-white overflow-hidden relative"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 10%, rgba(168,85,247,0.15), transparent 40%), radial-gradient(circle at 80% 90%, rgba(6,182,212,0.15), transparent 40%)",
      }}
    >
      <GarmentPartsSheet
        open={partsSheetOpen}
        onClose={() => setPartsSheetOpen(false)}
        onPick={(dataUrl, _label) => addElementToPanel(decalSide, dataUrl)}
        ar={lang === "ar"}
      />
      <header className="relative z-30 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/40 backdrop-blur-xl">

        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center font-black text-black text-sm shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            MZ
          </div>
          <div className="font-black tracking-widest text-sm">MODELZON</div>
          <span className="px-1.5 py-0.5 rounded border border-cyan-400/50 text-cyan-300 text-[9px] font-bold">3D</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 border-cyan-400/60 bg-cyan-500/5 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]">
            <span className="text-cyan-300 font-black text-sm">{level}</span>
          </div>
          {/* §14c — the yellow "$0" coins pill was removed from the top bar
              (all screens); coins remain visible inside Profile stats. */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-mono text-red-300">{mins}:{secs}</span>
          </div>
        </div>
      </header>

      <main className="relative pb-24 lg:pb-4 min-h-[calc(100vh-72px)]">
        <div className="lg:grid lg:grid-cols-[240px_1fr_320px] lg:gap-4 lg:p-4 lg:h-[calc(100vh-72px)] lg:overflow-hidden">

          <aside className="hidden lg:flex flex-col gap-4 overflow-y-auto">
            <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 pointer-events-none select-none">
              <XPBar level={level} xp={xp} xpToNext={xpToNext} popups={popups} />
            </div>
            <nav className="rounded-2xl p-2 bg-white/[0.03] border border-white/10 flex flex-col gap-1">
              {desktopNav.map((n) => {
                const Icon = n.icon;
                const active = tab === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id as TabId)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                      active ? "bg-cyan-500/15 text-cyan-200 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]" : "text-white/60 hover:bg-white/5"
                    }`}
                  >
                    <Icon size={16} /> {t(n.en, n.ar)}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section ref={mainScrollRef} className="lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-white/10 lg:bg-black/30 p-4 lg:p-0">
            {tab === "studio" && (
              <div className="relative flex flex-col h-[calc(100dvh-10.5rem)] lg:h-[calc(100vh-6.5rem)]">
                {/* §2 — the model view now fills the whole area between the
                    top bar and the bottom nav; every tool lives on floating
                    glass overlays + sliding sheets above it. */}
                <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                  <Suspense fallback={<div className="flex items-center justify-center h-full text-white/40">Loading studio…</div>}>
                    <Studio3D
                      ref={studioRef}
                      garment={garment} color={color} quality={quality}
                      brush={brush}
                      decalUrl={null}
                      overlayFrontUrl={overlayFront}
                      overlayBackUrl={overlayBack}
                      modelPath={modelPath} size={size}
                      fabricType={fabricType}
                      background={studioBg} pose={pose}
                      decorationType={decorationType} decorationTypeBack={decorationTypeBack}
                      frozen={frozen} undoSignal={undoSignal} clearSignal={clearSignal}
                    />
                  </Suspense>
                  {/* §2 — floating mini column: freeze / undo / redo over
                      the viewport (reference-style right-rail mini tools). */}
                  <div className="absolute z-20 top-3 left-3 flex flex-col gap-2">
                    <button
                      onClick={() => setFrozen((f) => !f)}
                      title={frozen ? t("Frozen", "مثبّت") : t("Freeze", "تثبيت")}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border backdrop-blur transition ${
                        frozen ? "bg-cyan-500/30 border-cyan-400 text-cyan-100" : "bg-black/60 border-white/15 text-white/70 hover:border-white/40"
                      }`}
                    >
                      {frozen ? <Snowflake size={15} /> : <Sun size={15} />}
                    </button>
                    {/* §14b — garment-level element history */}
                    <button
                      onClick={undoElements}
                      disabled={elementsHistoryRef.current.past.length === 0}
                      title={t("Undo (elements)", "تراجع (عناصر)")}
                      className="w-10 h-10 rounded-full flex items-center justify-center border backdrop-blur bg-black/60 border-white/15 text-white/70 hover:border-cyan-400/60 disabled:opacity-30 transition"
                    >
                      <Undo2 size={15} />
                    </button>
                    <button
                      onClick={redoElements}
                      disabled={elementsHistoryRef.current.future.length === 0}
                      title={t("Redo (elements)", "إعادة (عناصر)")}
                      className="w-10 h-10 rounded-full flex items-center justify-center border backdrop-blur bg-black/60 border-white/15 text-white/70 hover:border-cyan-400/60 disabled:opacity-30 transition"
                    >
                      <Redo2 size={15} />
                    </button>
                  </div>
                  <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 text-[10px] font-mono text-white/60 backdrop-blur">
                    {quality.toUpperCase()} · {garment.toUpperCase()} · {size}
                  </div>

                  {/* Save / Produce floating pills */}
                  <div className="absolute z-20 inset-x-0 bottom-[4.6rem] flex justify-center gap-2 pointer-events-none [&>*]:pointer-events-auto">
                    <button
                      onClick={handleSaveDesign}
                      disabled={savingDesign}
                      title={t("Save", "حفظ")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-black text-xs font-black shadow-lg disabled:opacity-60"
                    >
                      {savingDesign ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {t("Save", "حفظ")}
                    </button>
                    <button
                      onClick={() => {
                        // §3 — refuse to open the production flow (and make no
                        // API call) while the garment has no design at all.
                        if (elements.length === 0 && !studioRef.current?.getPaintDataUrl()) {
                          toast.error(lang === "ar" ? "تعذّر التصنيع لأنه لم يتم صنع أي تصميم بعد" : "Can't produce — no design has been created yet");
                          return;
                        }
                        setProductionDesignId("studio-current");
                      }}
                      title={t("Produce", "تصنيع")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/60 border border-cyan-400/50 text-cyan-200 text-xs font-black backdrop-blur hover:bg-cyan-500/20 transition"
                    >
                      <Factory size={14} /> {t("Produce", "تصنيع")}
                    </button>
                  </div>

                  {/* §2 — floating tool icons row over the viewport.
                      "Garments" comes first — entering the Studio opens it
                      automatically so you always start by picking the piece. */}
                  <div className="absolute z-20 inset-x-0 bottom-2.5 flex justify-center gap-1.5 px-2">
                    {([
                      ["garments", t("Garments", "ملابس"), Shirt],
                      ["fit", t("Color", "اللون"), PaletteIcon],
                      ["paint", t("Paint", "رسم"), Brush],
                      ["print", t("Print", "طباعة"), Printer],
                      ["bg", t("Background", "الخلفية"), ImageIcon],
                      ["layout", t("Mockups", "الموك اب"), LayoutGrid],
                      ["ai", t("AI", "ذكاء"), Sparkles],
                    ] as const).map(([id, label, Icon]) => {
                      const active = studioPanel === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setStudioPanel(id)}
                          title={label}
                          className={`w-[3.1rem] py-1.5 rounded-2xl flex flex-col items-center gap-0.5 border backdrop-blur transition ${
                            active
                              ? "bg-cyan-500/30 border-cyan-400/70 text-cyan-100 shadow-[0_0_16px_rgba(6,182,212,0.35)]"
                              : "bg-black/55 border-white/15 text-white/65 hover:bg-black/70 hover:border-white/35"
                          }`}
                        >
                          <Icon size={17} />
                          <span className="text-[8.5px] font-bold leading-none">{label}</span>
                        </button>
                      );
                    })}
                  </div>

                {/* Garment picker INSIDE the studio — the entry point of the
                    design flow: entering the Studio tab lands here first,
                    choosing a piece opens the design panels automatically. */}
                <StudioSheet
                  open={studioPanel === "garments"}
                  icon={<Shirt size={15} className="text-cyan-300" />}
                  title={t("Choose a garment", "اختر قطعة الملابس")}
                  onClose={() => setStudioPanel(null)}
                >
                  <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-3">
                    <GarmentLibrary lang={lang} onPick={applyGarment} />
                  </div>
                </StudioSheet>

                <StudioSheet
                  open={studioPanel === "paint"}
                  icon={<Brush size={15} className="text-cyan-300" />}
                  title={t("Draw & paint tools", "أدوات الرسم والطلاء")}
                  onClose={() => setStudioPanel(null)}
                >
                  <ProToolbar
                    brush={brush}
                    setBrush={(patch) => setBrush((b) => ({ ...b, ...patch }))}
                    frozen={frozen}
                    setFrozen={setFrozen}
                    onUndo={() => setUndoSignal((n) => n + 1)}
                    lang={lang}
                  />
                </StudioSheet>

                {/* Print tab — production actions (upload artwork, undo
                    stroke, clear painted layers) PLUS, per §12, the full
                    print/embroidery treatment card that used to be the
                    separate "Edit" tab (rendered right below). */}
                                {/* Background + motion (animation) properties */}
                <StudioSheet
                  open={studioPanel === "bg"}
                  icon={<ImageIcon size={15} className="text-cyan-300" />}
                  title={t("Background & motion", "الخلفية والحركة")}
                  onClose={() => setStudioPanel(null)}
                >
                  <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1.5">{t("Background", "الخلفية")}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {["#000000", "#0b1020", "#14061f", "#1a1a1a", "#e8e4dd", "#ffffff", "#0c2340", "#1b4332"].map((c) => (
                          <button
                            key={c}
                            onClick={() => setStudioBg(c)}
                            className={`w-7 h-7 rounded-lg border-2 ${studioBg === c ? "border-cyan-400" : "border-white/15"}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1.5">{t("Animation", "الحركة")}</div>
                      <div className="flex gap-2">
                        {([
                          ["stand", t("Stand", "وقوف"), PersonStanding],
                          ["walk", t("Walk", "مشي"), Footprints],
                          ["wind", t("Wind", "رياح"), Wind],
                        ] as const).map(([id, label, Icon]) => (
                          <button
                            key={id}
                            onClick={() => setPose(id)}
                            className={`flex-1 py-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                              pose === id ? "bg-fuchsia-500/20 border-fuchsia-400/60 text-fuchsia-100" : "bg-white/[0.04] border-white/10 text-white/60"
                            }`}
                          >
                            <Icon size={16} />
                            <span className="text-[9px] font-bold">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-white/50 flex items-center gap-1">
                        <RotateCw size={11} /> {t("Turntable", "الدوران التلقائي")}
                      </span>
                      <button
                        onClick={() => setFrozen((f) => !f)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black border ${
                          frozen ? "bg-white/5 border-white/15 text-white/60" : "bg-cyan-500/20 border-cyan-400/60 text-cyan-100"
                        }`}
                      >
                        {frozen ? t("Off", "متوقف") : t("On", "يدور")}
                      </button>
                    </div>
                  </div>
                </StudioSheet>

                {/* 2D Mockup board — the four mockup squares (front / back /
                    sleeves). Tapping a square expands it into the full
                    Design-Layout-style editor: free drag, 4-corner free
                    resize, rotate handle, opacity + fabric-UV sliders,
                    lock/delete, text tool and direct painting — all synced
                    live to the 3D garment above. */}
                <StudioSheet
                  open={studioPanel === "layout"}
                  icon={<LayoutGrid size={15} className="text-cyan-300" />}
                  title={t("Mockup board", "الموك اب")}
                  onClose={() => setStudioPanel(null)}
                >
                  <MockupBoard2D
                    garment={garment}
                    color={color}
                    ar={lang === "ar"}
                    elements={elements}
                    onPatchElement={(id, patch) => setElements((els) => els.map((e) => (e.id === id ? { ...e, ...patch } : e)))}
                    onRemoveElement={(id) => setElements((els) => els.filter((e) => e.id !== id))}
                    onReplaceElement={(el) => setElements((els) => els.map((e) => (e.id === el.id ? el : e)))}
                    onAddElement={(el) => setElements((els) => [...els, el])}
                    onAddImage={addElementToPanel}
                    activePanel={decalSide}
                    onActivePanel={setDecalSide}
                    onOpenParts={() => setPartsSheetOpen(true)}
                    brushColor={brush.color}
                    brushSize={brush.size}
                    onBrushSize={(n) => setBrush((b) => ({ ...b, size: n }))}
                    onPaint={handleMockupPaint}
                    onPaintUndo={() => setUndoSignal((n) => n + 1)}
                    onPaintClear={() => setClearSignal((n) => n + 1)}
                  />
                </StudioSheet>



                <StudioSheet
                  open={studioPanel === "ai"}
                  icon={<Sparkles size={15} className="text-cyan-300" />}
                  title={t("AI design assistant", "المساعد الذكي")}
                  onClose={() => setStudioPanel(null)}
                >
                  {user && (
                    <AIGraphicAssistant
                      userId={user.id}
                      lang={lang}
                      onGenerated={(url) => { addElementToPanel(decalSide === "back" ? "back" : "front", url); void refreshMissions(); }}
                    />
                  )}
                </StudioSheet>

                {/* Front/back artwork — two real independent slots now:
                    each tab uploads and positions its own image, both are
                    baked onto the garment together with any hand-painted
                    strokes (see compose() in Studio3D.tsx). */}
                {/* §12 — everything that used to live in the "Edit" tab now
                    lives HERE in Print: print/embroidery type, front/back
                    artwork toggle, upload box and the per-panel element list. */}
                <StudioSheet
                  open={studioPanel === "print"}
                  icon={<Printer size={15} className="text-cyan-300" />}
                  title={t("Print shop", "قسم الطباعة")}
                  onClose={() => setStudioPanel(null)}
                >
                <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-2">
                  {/* quick actions (formerly the separate Print tab body) */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => artworkFileRef.current?.click()}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-100 text-[10px] font-bold hover:bg-cyan-400/20 transition"
                    >
                      <Upload size={16} />
                      {t("Upload artwork", "رفع صورة")}
                    </button>
                    <button
                      onClick={() => setElements((els) => els.slice(0, -1))}
                      disabled={elements.length === 0}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 text-[10px] font-bold hover:bg-white/[0.08] disabled:opacity-30 transition"
                    >
                      <Trash2 size={16} />
                      {t("Delete last element", "حذف آخر عنصر")}
                    </button>
                    <button
                      onClick={() => setUndoSignal((n) => n + 1)}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 text-[10px] font-bold hover:bg-white/[0.08] transition"
                    >
                      <RotateCw size={16} />
                      {t("Undo paint stroke", "تراجع عن رسمة")}
                    </button>
                    <button
                      onClick={() => setClearSignal((n) => n + 1)}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl bg-red-500/10 border border-red-400/30 text-red-200 text-[10px] font-bold hover:bg-red-500/20 transition"
                    >
                      <X size={16} />
                      {t("Clear painted layer", "مسح الرسم اليدوي")}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/40 leading-relaxed">
                    {t(
                      "Undo/clear apply to the freehand painted layer. Elements (images & text) are managed below or by tapping them on the mockup.",
                      "التراجع/المسح يخصّان طبقة الرسم اليدوي فقط. العناصر (صور ونصوص) تُدار من الأسفل أو بالضغط عليها في الموك اب.",
                    )}
                  </p>
                  {/* Print / embroidery treatment — applies to the ACTIVE side's
                      artwork layer independently (front and back can differ).
                      Garment parts moved to the Layout panel, next to the
                      front/back sheets. */}
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
                      {t("Print / embroidery type", "نوع الطباعة / التطريز")}
                      <span className="text-white/25 normal-case tracking-normal">
                        {" "}({decalSide === "back" ? t("back", "الخلف") : t("front", "الأمام")})
                      </span>
                    </div>
                    {(["print", "embroidery"] as const).map((cat) => (
                      <div key={cat} className="mb-1.5">
                        <div className="text-[9px] text-white/30 mb-1">
                          {cat === "print" ? t("Ink & print", "أحبار وطباعة") : t("Embroidery & applied pieces", "تطريز وقطع مضافة")}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {DECORATION_TYPES.filter((d) => d.category === cat).map((d) => {
                            const active = (decalSide === "back" ? decorationTypeBack : decorationType) === d.id;
                            return (
                              <button
                                key={d.id}
                                title={lang === "ar" ? d.descriptionAr : d.description}
                                onClick={() => (decalSide === "back" ? setDecorationTypeBack(d.id) : setDecorationType(d.id))}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                  active ? "bg-cyan-400/20 border-cyan-400/60 text-cyan-200" : "bg-white/[0.04] border-white/10 text-white/60 hover:border-white/30"
                                }`}
                              >
                                {/* §7 — real result on fabric for every type */}
                                <img
                                  src={`/assets/studio/deco-${d.id}.svg`}
                                  alt=""
                                  draggable={false}
                                  className="w-7 h-5 rounded-[5px] object-cover border border-white/15"
                                />
                                {lang === "ar" ? d.ar : d.en}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>


                  <div className="flex rounded-xl border border-white/10 overflow-hidden text-[11px] font-bold">
                    {(["front", "back"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setDecalSide(s)}
                        className={`flex-1 py-1.5 flex items-center justify-center gap-1 transition ${
                          (decalSide === "back" ? "back" : "front") === s ? "bg-cyan-500/25 text-cyan-100" : "bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                        }`}
                      >
                        {s === "front" ? t("Front artwork", "رسمة أمامية") : t("Back artwork", "رسمة خلفية")}
                        {(s === "front" ? decalUrl : decalUrlBack) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </button>
                    ))}
                  </div>

                  {/* Placement is direct manipulation on the 2D mockup board
                      (Mockups tab) — this panel manages WHICH elements live
                      on each side: upload, inspect and delete them. */}
                  {(() => {
                    const onBack = decalSide === "back";
                    const sideEls = elements.filter((e) => e.panel === decalSide);
                    return (
                      <>
                        <button
                          onClick={() => artworkFileRef.current?.click()}
                          className="w-full flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-dashed border-white/15 text-white/40 hover:border-cyan-400/40 hover:text-cyan-300 transition"
                        >
                          <Upload size={20} />
                          <span className="text-[11px]">
                            {onBack
                              ? t("Upload artwork for the back — it prints on the back only.", "ارفع صورة للخلف — بتُطبع بالخلف بس.")
                              : t("Upload artwork for this panel, or generate one with AI.", "ارفع صورة لهذا الجزء، أو ولّدها بالذكاء الاصطناعي.")}
                          </span>
                        </button>
                        {sideEls.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] uppercase tracking-widest text-white/40">
                              {t("Elements on this panel", "العناصر على هذا الجزء")} ({sideEls.length})
                            </div>
                            {sideEls.map((el) => (
                              <div key={el.id} className="flex items-center gap-2 rounded-xl bg-black/40 border border-white/10 p-1.5">
                                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                                  {el.kind === "image" && el.src
                                    ? <img src={el.src} alt="" className="w-full h-full object-contain" />
                                    : <span className="text-[10px] font-black" style={{ color: el.color }}>T</span>}
                                </div>
                                <span className="flex-1 text-[10px] text-white/60 truncate">
                                  {el.kind === "text" ? el.text : t("Artwork", "رسمة")}
                                  {el.locked ? " 🔒" : ""}
                                </span>
                                <button
                                  onClick={() => { setDecalSide(el.panel); setStudioPanel("layout"); }}
                                  className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[9px] font-bold"
                                >
                                  {t("تحرير بالموك اب", "Edit in Mockups")}
                                </button>
                                <button
                                  onClick={() => setElements((els) => els.filter((x) => x.id !== el.id))}
                                  disabled={el.locked}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/15 border border-red-400/40 text-red-200 disabled:opacity-30"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <input
                    ref={artworkFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const url = String(reader.result);
                          const probe = new Image();
                          probe.onload = () => addElementToPanel(decalSide, url, probe.naturalWidth / Math.max(1, probe.naturalHeight));
                          probe.onerror = () => addElementToPanel(decalSide, url, 1);
                          probe.src = url;
                        };
                        reader.readAsDataURL(f);
                      }
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
                </StudioSheet>

                <StudioSheet
                  open={studioPanel === "fit"}
                  icon={<PaletteIcon size={15} className="text-cyan-300" />}
                  title={t("Garment color", "لون القطعة")}
                  onClose={() => setStudioPanel(null)}
                >
                  <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="text-[10px] uppercase tracking-widest text-white/50 flex items-center gap-1">
                      <PaletteIcon size={11} /> {t("Base color", "لون القاعدة")}
                    </div>
                    <ColorPickerHSV color={color} onChange={changeColor} ar={lang === "ar"} />
                  </div>
                </StudioSheet>
                </div>
              </div>
            )}

            {tab === "arena" && (
              <div className="space-y-4">
                <ArenaHero
                  title={topic}
                  lang={lang}
                  onStart={() => setBattleActive(true)}
                />

                {battleActive && user && (
                  <BattleRoom
                    lang={lang}
                    userId={user.id}
                    username={profile?.username || user.email?.split("@")[0] || "Player"}
                    level={level}
                    topic={topic}
                    garment={garment}
                    color={color}
                    decalUrl={decalUrl}
                    decalTransform={DEFAULT_DECAL_TRANSFORM}
                    onEnterStudio={() => setTab("studio")}
                    onClose={() => { setBattleActive(false); void refreshMissions(); refreshProfile(); }}
                  />
                )}

                <CompetitorsRoom lang={lang} online={onlinePlayers} myUserId={user?.id} onOpenStudio={() => setTab("studio")} />

                <ArenaBoard
                  lang={lang}
                  garment={garment}
                  username={profile?.username ?? user?.email?.split("@")[0] ?? "Player"}
                  avatarUrl={avatarUrl}
                />

              </div>
            )}

            {/* §4 — the standalone Garments screen is gone: the library
                lives ONLY inside the Studio's "Garments" panel now. */}

            {/* Reels open straight into the full-screen vertical player */}
            {tab === "feed" && <ShortsFeed lang={lang} />}

            {tab === "market" && (
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/40 text-amber-300 text-[10px] font-bold mb-2">
                  🏆 {t("$ZONE CLOTHING MARKETPLACE", "سوق ملابس ZONE$")}
                </span>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-2xl font-black">{t("Designer Marketplace & Royalties", "سوق المصممين والعمولات")}</h2>
                    <p className="text-xs text-white/50 mt-1 max-w-md">
                      {t(
                        "Trade exclusive 3D garments. Reaching Level 50 unlocks the Verified Badge (✓) & grants monetization privileges!",
                        "تداول ملابس ثلاثية الأبعاد حصرية. الوصول للمستوى 50 يفتح الشارة الموثقة (✓) ويمنح صلاحيات الربح!"
                      )}
                    </p>
                  </div>
                  {!verified && (
                    <div className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-[10px]">
                      <Lock size={14} className="text-white/40" />
                      <div>
                        <div className="font-bold text-white/70">{t("MONETIZATION LOCKED", "الربح مقفل")}</div>
                        <div className="text-white/40">
                          {t(`Level ${level}/50 to sell your own`, `المستوى ${level}/50 للبيع بنفسك`)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {verified && <MyShopCard userId={user!.id} lang={lang} />}

                {marketLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/40" size={24} /></div>
                ) : marketListings.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-10">
                    {t("Nothing listed yet — Level-50 designers can list their designs from the Studio's My Designs section.", "ما فيه تصاميم بالسوق بعد — المصممون بمستوى 50+ يقدرون يعرضون تصاميمهم من قسم تصاميمي بالبروفايل.")}
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {marketListings.map((item) => (
                      <div key={item.id} className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10">
                        <div
                          className="h-28 flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${item.color}, #000)` }}
                        >
                          {item.decal_url && <img src={item.decal_url} alt={item.title} className="max-h-[70%] max-w-[70%] object-contain" />}
                        </div>
                        <div className="p-3">
                          <div className="font-bold text-sm truncate">{item.title || item.garment}</div>
                          <div className="text-[11px] text-white/50">{item.seller_username}</div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-white/40 uppercase">{t("Price", "السعر")}</span>
                            <span className="text-amber-300 font-mono text-xs font-bold">${(item.price_cents / 100).toFixed(2)}</span>
                          </div>
                          <button
                            onClick={() => handleBuy(item)}
                            disabled={buyingId === item.id || item.user_id === user?.id}
                            className="mt-2 w-full py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 text-xs font-bold disabled:opacity-50"
                          >
                            {buyingId === item.id ? "..." : item.user_id === user?.id ? t("Yours", "تصميمك") : t("Buy", "شراء")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "ranks" && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Trophy className="text-yellow-400" />
                  <h2 className="text-2xl font-black">{t("Ranked Ladder", "سلم الرتب")}</h2>
                </div>
                <RankCards level={level} missionsCompleted={completedMissionIds.length} lang={lang} />

                <div className="mt-6 rounded-xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={14} className="text-yellow-400" />
                    <span className="text-sm font-black">{t("Top Players", "المتصدرون")}</span>
                  </div>
                  {leaderboardLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-white/40" size={20} /></div>
                  ) : topPlayers.length === 0 ? (
                    <p className="text-xs text-white/40 text-center py-4">
                      {t("No players yet — be the first!", "ما فيه لاعبين بعد — كن أول واحد!")}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {topPlayers.map((p, i) => {
                        const isMe = p.id === user?.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setViewingPlayer(p)}
                            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/[0.05] transition ${
                              isMe ? "bg-cyan-500/10 border border-cyan-400/30" : "bg-white/[0.02]"
                            }`}
                          >
                            <span className="w-5 text-center text-xs font-mono text-white/40">{i + 1}</span>
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-[10px] font-black text-black shrink-0">
                              {p.username[0]?.toUpperCase() ?? "?"}
                            </div>
                            <span className="flex-1 text-xs font-semibold truncate flex items-center gap-1.5">
                              {p.username} {isMe && <span className="text-cyan-300">({t("You", "أنت")})</span>}
                            </span>
                            <RankBadge level={p.level} lang={lang} />
                            <span className="text-[11px] font-mono text-fuchsia-300">{p.xp} XP</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Read-only public profile viewer — tap any player above.
                    Identity card sits on the trailing edge; the free space
                    next to it shows the person's published designs + bio,
                    unless their Privacy switch is ON. */}
                <Dialog open={Boolean(viewingPlayer)} onOpenChange={(o) => !o && setViewingPlayer(null)}>
                  <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-md sm:max-w-lg" dir={lang === "ar" ? "rtl" : "ltr"}>
                    {viewingPlayer && (
                      <>
                        <DialogHeader>
                          <DialogTitle className="sr-only">{viewingPlayer.username}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-1">
                          {/* §9 — one horizontal header strip: identity pinned
                              to the FAR EDGE (left in RTL) with the content
                              toggles (designs/videos) and the add-friend "+"
                              beside it, then the content below. */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* designs / videos toggles (dimmed if empty) */}
                            <button
                              onClick={() => setViewedSection("designs")}
                              className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition ${
                                viewedSection === "designs" ? "bg-cyan-400/20 border-cyan-400/60 text-cyan-100" : "bg-white/[0.04] border-white/10 text-white/50"
                              } ${viewedDesigns.length === 0 ? "opacity-30 pointer-events-none" : ""}`}
                              title={t("Designs", "التصاميم")}
                            >
                              <Sticker size={17} />
                              {viewedDesigns.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-cyan-400 text-black text-[9px] font-black grid place-items-center">{viewedDesigns.length}</span>
                              )}
                            </button>
                            <button
                              onClick={() => setViewedSection("videos")}
                              className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition ${
                                viewedSection === "videos" ? "bg-fuchsia-400/20 border-fuchsia-400/60 text-fuchsia-100" : "bg-white/[0.04] border-white/10 text-white/50"
                              } ${viewedShorts.length === 0 ? "opacity-30 pointer-events-none" : ""}`}
                              title={t("Videos", "الفيديوهات")}
                            >
                              <Clapperboard size={17} />
                              {viewedShorts.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-fuchsia-400 text-black text-[9px] font-black grid place-items-center">{viewedShorts.length}</span>
                              )}
                            </button>

                            {/* add-friend "+" (§9b): plain +, hourglass while the
                                request is pending, check once friends. */}
                            {viewingPlayer.id !== user?.id && (
                              <button
                                onClick={() => handleSendFriendRequest(viewingPlayer.id)}
                                disabled={friendReqState === "sending" || friendReqState === "pending" || friendReqState === "friends"}
                                title={
                                  friendReqState === "pending" ? t("Request pending — expires after 30 days", "الطلب معلّق — ينتهي بعد 30 يوم")
                                  : friendReqState === "friends" ? t("Already friends", "أصدقاء بالفعل")
                                  : t("Send friend request", "إرسال طلب صداقة")
                                }
                                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition ${
                                  friendReqState === "friends"
                                    ? "bg-emerald-400/20 border-emerald-400/60 text-emerald-200"
                                    : friendReqState === "pending"
                                      ? "bg-amber-400/20 border-amber-400/60 text-amber-200"
                                      : "bg-gradient-to-br from-cyan-400 to-fuchsia-500 border-transparent text-black hover:brightness-110 active:scale-95"
                                }`}
                              >
                                {friendReqState === "friends" ? <Check size={17} />
                                  : friendReqState === "pending" ? <Hourglass size={17} />
                                  : friendReqState === "sending" ? <Hourglass size={17} className="animate-pulse" />
                                  : <UserPlus size={17} />}
                              </button>
                            )}

                            {/* identity — pinned to the far edge (LEFT in RTL)
                                via margin-inline-start:auto. */}
                            <div className="ms-auto flex items-center gap-2.5 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 pl-2.5 pr-3 py-1.5 min-w-0">
                              <div className="w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-black font-black text-xl shrink-0">
                                {viewedAvatar ? <img src={viewedAvatar} alt="" onError={() => setViewedAvatar(null)} className="w-full h-full object-cover" /> : viewingPlayer.username[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0 text-start">
                                <div className="font-black text-sm truncate">{viewingPlayer.username}</div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <RankBadge level={viewingPlayer.level} lang={lang} size={11} />
                                  <span className="text-[10px] text-white/40 font-mono">LVL {viewingPlayer.level} · {viewingPlayer.xp} XP</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* bio strip */}
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">{t("Bio", "النبذة")}</div>
                            <p className="text-[12px] text-white/70 break-words">
                              {viewedBio || t("No bio yet.", "ما فيه نبذة بعد.")}
                            </p>
                          </div>

                          {/* content: designs or videos */}
                          {viewedPrivate ? (
                            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                              <Shield size={18} className="mx-auto text-white/30" />
                              <p className="mt-2 text-[11px] text-white/40">
                                {t("This profile is private — designs are hidden.", "هذا الحساب خاص — التصاميم مخفية.")}
                              </p>
                            </div>
                          ) : viewedSection === "videos" ? (
                            viewedShorts.length === 0 ? (
                              <p className="text-[11px] text-white/30 text-center py-3">{t("No videos yet.", "ما فيه فيديوهات بعد.")}</p>
                            ) : (
                              <div className="grid grid-cols-3 gap-2">
                                {viewedShorts.map((v) => (
                                  <div key={v.id} className="aspect-[9/16] rounded-lg overflow-hidden border border-white/10 bg-black">
                                    <video src={v.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            )
                          ) : viewedDesigns.length === 0 ? (
                            <p className="text-[11px] text-white/30 text-center py-3">{t("No designs published yet.", "ما نشر أي تصميم بعد.")}</p>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {viewedDesigns.slice(0, 9).map((d) => (
                                <div key={d.id} className="aspect-square rounded-lg overflow-hidden border border-white/10" style={{ background: d.color }}>
                                  {d.decal_url && <img src={d.decal_url} alt={d.title} className="w-full h-full object-contain" />}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
                <div className="mt-6 grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl p-4 bg-white/[0.03] border border-white/10">
                    <div className="text-xs text-white/50 uppercase mb-2">{t("Arena Record", "سجل الساحة")}</div>
                    <div className="flex items-baseline gap-4">
                      <div>
                        <div className="text-3xl font-black text-cyan-300">{missionStats?.battlesJudged ?? 0}</div>
                        <div className="text-[10px] text-white/40">{t("battles judged", "معركة محكومة")}</div>
                      </div>
                      <div>
                        <div className="text-3xl font-black text-amber-300">{missionStats?.highScoreEntries ?? 0}</div>
                        <div className="text-[10px] text-white/40">{t("scores 8.0+", "تقييم 8.0+")}</div>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/30 mt-2">
                      {t("Only the AI judge in the Arena sets your score — nothing here is self-reported.", "بس حكم الذكاء الاصطناعي بالساحة يحدد تقييمك — ولا شي هنا تقدر تحطه بنفسك.")}
                    </p>
                  </div>
                  <div className="rounded-xl p-4 bg-white/[0.03] border border-white/10">
                    <div className="text-xs text-white/50 uppercase mb-2">{t("Missions", "المهام")}</div>
                    <div className="text-3xl font-black text-fuchsia-300">{completedMissionIds.length}/{MISSIONS.length}</div>
                    <p className="text-[10px] text-white/30 mt-1">
                      {t("Complete missions to level up — see the full list below.", "أكمل المهام عشان ترتفع مستواك — شوف القائمة الكاملة تحت.")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="text-sm font-black mb-3">{t("Mission checklist", "قائمة المهام")}</div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {MISSIONS.filter((m) => m.minLevel <= level + 5).map((m) => {
                      const done = completedMissionIds.includes(m.id);
                      const locked = m.minLevel > level;
                      return (
                        <div key={m.id}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                            done ? "bg-emerald-500/10 border border-emerald-400/20" : locked ? "bg-white/[0.01] border border-white/5 opacity-40" : "bg-white/[0.02] border border-white/10"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {done ? <CheckCircle2 size={13} className="text-emerald-300" /> : locked ? <Lock size={13} className="text-white/30" /> : <Circle size={13} className="text-white/30" />}
                            {lang === "ar" ? m.titleAr : m.titleEn}
                            {locked && <span className="text-white/30">· LVL {m.minLevel}</span>}
                          </span>
                          {!done && <span className="text-cyan-300 font-mono">+{m.xp} XP</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === "profile" && (
              <div className="max-w-xl mx-auto space-y-4">
                <div className="rounded-2xl p-5 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 border border-white/10 text-center relative">
                  <button
                    onClick={() => setTab("ranks")}
                    title={t("Ranks", "الرتب")}
                    className="absolute top-3 left-3 w-9 h-9 rounded-xl bg-black/40 border border-amber-400/30 flex items-center justify-center text-amber-300 hover:bg-amber-500/10 transition"
                  >
                    <Trophy size={16} />
                  </button>

                  <label className="relative w-24 h-24 mx-auto block cursor-pointer group">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-4xl font-black text-black">
                      {avatarUrl ? <img src={avatarUrl} alt="" onError={() => setAvatarUrl(null)} className="w-full h-full object-cover" /> : profileName[0]}
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Camera size={20} className="text-white" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user) return;
                        const result = await uploadAvatar(user.id, file);
                        if (result.ok && result.url) { setAvatarUrl(result.url); refreshProfile(); toast.success(t("Profile photo updated", "تم تحديث صورة البروفايل")); }
                        else toast.error(result.message ?? t("Couldn't upload photo", "تعذّر رفع الصورة"));
                      }}
                    />
                  </label>

                  <div className="mt-3 text-2xl font-black flex items-center justify-center gap-2">
                    {profileName}
                    {verified && <span className="text-cyan-300 text-lg drop-shadow-[0_0_6px_currentColor]">✓</span>}
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">{profileBio}</p>
                  <div className="flex items-center justify-center gap-2 mt-1.5">
                    <span className="text-xs text-cyan-300 font-mono">LVL {level} · {coins} coins</span>
                    <RankBadge level={level} lang={lang} />
                  </div>

                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-cyan-400/30">
                    <span className="text-[10px] uppercase tracking-widest text-white/50">{t("Player ID", "معرّف اللاعب")}</span>
                    <span className="font-mono font-black text-cyan-200 text-sm select-all">#{playerId}</span>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(playerId); }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-100 font-bold"
                    >
                      {t("Copy", "نسخ")}
                    </button>
                  </div>

                  <div className="mt-4 pointer-events-none select-none opacity-95">
                    <XPBar level={level} xp={xp} xpToNext={xpToNext} popups={popups} />
                  </div>
                  <div className="mt-1 text-[10px] text-white/40">
                    {t("XP is earned through battles and missions only", "الخبرة تُكتسب من المعارك والمهام فقط")}
                  </div>
                </div>

                {/* §9 — the 4-stat row (battles judged / designs created /
                    scores 8.0+ / ZONE credits) above the icon bar is deleted. */}

                {/* TikTok-style icon rail — one tap per section instead of
                    one long stacked scroll of cards. */}
                <div className="flex items-center justify-around border-y border-white/10 py-2">
                  {([
                    ["designs", t("Designs", "التصاميم"), Grid3x3],
                    ["plan", t("Plan", "الاشتراك"), Crown],
                    ["friends", t("Friends", "الأصدقاء"), Users],
                    ["settings", t("Settings", "الإعدادات"), SlidersHorizontal],
                  ] as const).map(([id, label, Icon]) => {
                    const active = profileTab === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setProfileTab(id)}
                        title={label}
                        aria-label={label}
                        className={`relative flex-1 flex flex-col items-center gap-1 py-1.5 transition ${
                          active ? "text-cyan-300" : "text-white/40 hover:text-white/70"
                        }`}
                      >
                        <Icon size={19} className={active ? "drop-shadow-[0_0_6px_currentColor]" : ""} />
                        {active && <span className="absolute -bottom-2 h-0.5 w-8 rounded-full bg-cyan-300" />}
                      </button>
                    );
                  })}
                </div>

                {profileTab === "designs" && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Save size={14} className="text-cyan-300" />
                    <span className="text-sm font-black">{t("My Designs", "تصاميمي")}</span>
                    <span className="text-[10px] text-white/40">({myDesigns.length})</span>
                  </div>
                  {designsLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-white/40" size={20} /></div>
                  ) : myDesigns.length === 0 ? (
                    <p className="text-xs text-white/40 text-center py-6">
                      {t("No saved designs yet — save one from the Studio tab.", "ما فيه تصاميم محفوظة بعد — احفظ واحد من تبويب الاستوديو.")}
                    </p>
                  ) : (
                    <>
                      {/* Instagram/TikTok-style tight square grid — tap a
                          tile to open the detail sheet with all the actions
                          (selling, deleting) instead of cramming tiny
                          controls into each thumbnail. */}
                      {/* §9 — one merged grid: designs + reels, each with a
                          small type badge; reels open the inline player. */}
                      <div className="grid grid-cols-3 gap-0.5 sm:gap-1 rounded-lg overflow-hidden">
                        {[
                          ...myDesigns.map((d) => ({ key: `d-${d.id}`, at: d.created_at, node: (
                            <button
                              key={`d-${d.id}`}
                              onClick={() => setOpenDesign(d)}
                              className="relative aspect-square block group"
                              style={{ backgroundColor: d.color }}
                            >
                              {d.decal_url ? (
                                <img src={d.decal_url} alt={d.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Shirt size={28} className="text-white/20" />
                                </div>
                              )}
                              {d.decal_url_back && (
                                <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
                                </span>
                              )}
                              {d.for_sale && (
                                <span className="absolute top-1 right-1 px-1 py-0.5 rounded bg-emerald-500/90 text-black text-[8px] font-black">
                                  ${(d.price_cents! / 100).toFixed(0)}
                                </span>
                              )}
                              <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/70 text-cyan-200 text-[8px] font-black">
                                {t("Design", "تصميم")}
                              </span>
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <span className="text-[10px] font-bold text-white">{t("View", "عرض")}</span>
                              </div>
                            </button>
                          )})),
                          ...myShorts.map((v) => ({ key: `r-${v.id}`, at: v.created_at, node: (
                            <button
                              key={`r-${v.id}`}
                              onClick={() => setOpenShort(v)}
                              className="relative aspect-square block group bg-black"
                            >
                              <video
                                src={`${v.video_url}#t=0.1`}
                                muted
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-cover pointer-events-none"
                              />
                              <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center">
                                <Play size={9} className="text-fuchsia-300 fill-fuchsia-300" />
                              </span>
                              <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/70 text-fuchsia-200 text-[8px] font-black">
                                {t("Reel", "ريل")}
                              </span>
                              <span className="absolute bottom-1 right-1 text-[8px] font-bold text-white/80 flex items-center gap-0.5">
                                ♥ {v.likes_count}
                              </span>
                            </button>
                          )})),
                        ]
                          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                          .map((tile) => tile.node)}
                      </div>

                      {/* Detail sheet — like tapping a post: full preview + actions */}
                      <Dialog open={Boolean(openDesign)} onOpenChange={(o) => !o && setOpenDesign(null)}>
                        <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-md sm:max-w-sm" dir={lang === "ar" ? "rtl" : "ltr"}>
                          {openDesign && (
                            <>
                              <DialogHeader>
                                <DialogTitle className="text-sm">{openDesign.title || `${openDesign.garment} · ${openDesign.size}`}</DialogTitle>
                              </DialogHeader>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="aspect-square rounded-xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: openDesign.color }}>
                                  {openDesign.decal_url ? <img src={openDesign.decal_url} className="w-full h-full object-cover" /> : <Shirt size={32} className="text-white/20" />}
                                </div>
                                <div className="aspect-square rounded-xl overflow-hidden flex items-center justify-center bg-white/[0.03] border border-white/10">
                                  {openDesign.decal_url_back ? (
                                    <img src={openDesign.decal_url_back} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] text-white/30 text-center px-3">{t("No back artwork", "لا يوجد رسمة خلفية")}</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-[11px] text-white/50 mt-1">{openDesign.garment} · {openDesign.size} · {new Date(openDesign.created_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</div>

                              {openDesign.for_sale ? (
                                <div className="flex items-center justify-between mt-2 rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-3 py-2">
                                  <span className="text-xs font-bold text-emerald-200">${(openDesign.price_cents! / 100).toFixed(0)} · {t("Listed", "معروض بالسوق")}</span>
                                  <button onClick={() => { handleUnlist(openDesign.id); setOpenDesign(null); }} className="text-[10px] text-red-300 underline">{t("Unlist", "سحب")}</button>
                                </div>
                              ) : verified ? (
                                <div className="flex gap-2 mt-2">
                                  <input
                                    type="number" min={1} placeholder={t("Price $", "السعر $")}
                                    value={sellPriceDraft[openDesign.id] ?? ""}
                                    onChange={(e) => setSellPriceDraft((s) => ({ ...s, [openDesign.id]: e.target.value }))}
                                    className="flex-1 rounded-lg bg-black/40 border border-white/10 text-xs px-2 py-1.5 text-white outline-none"
                                  />
                                  <button onClick={() => handleListForSale(openDesign.id)} className="px-3 rounded-lg bg-amber-500/80 text-black text-xs font-bold">
                                    {t("List for sale", "اعرض بالسوق")}
                                  </button>
                                </div>
                              ) : (
                                <p className="text-[10px] text-white/30 mt-2">{t("Reach Level 50 (or Elite) to sell your designs.", "وصّل مستوى 50 (أو اشترك Elite) عشان تبيع تصاميمك.")}</p>
                              )}

                              <button
                                onClick={() => setProductionDesignId(openDesign.id)}
                                disabled={requestingProductionId === openDesign.id}
                                className="mt-2 w-full py-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                <Factory size={12} /> {requestingProductionId === openDesign.id ? "…" : t("Request real-life production", "اطلب تصنيعه بالحقيقة")}
                              </button>

                              <button
                                onClick={() => setConfirmAction({
                                  message: t("This design will be deleted permanently and can't be recovered.", "سيتم حذف هذا التصميم نهائياً ولا يمكن استرجاعه."),
                                  confirmLabel: t("Delete", "حذف"),
                                  onConfirm: () => { handleDeleteDesign(openDesign.id); setOpenDesign(null); },
                                })}
                                className="mt-2 w-full py-2 rounded-lg border border-red-400/30 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5"
                              >
                                <Trash2 size={12} /> {t("Delete design", "حذف التصميم")}
                              </button>
                            </>
                          )}
                        </DialogContent>
                      </Dialog>

                      {/* §9 — inline reel player (merged saved-content grid) */}
                      <Dialog open={Boolean(openShort)} onOpenChange={(o) => !o && setOpenShort(null)}>
                        <DialogContent className="border-fuchsia-400/30 bg-black/95 backdrop-blur-md sm:max-w-xs" dir={lang === "ar" ? "rtl" : "ltr"}>
                          {openShort && (
                            <div className="space-y-2">
                              <video
                                key={openShort.id}
                                src={openShort.video_url}
                                controls
                                autoPlay
                                playsInline
                                className="w-full rounded-xl max-h-[65vh] bg-black"
                              />
                              {openShort.caption && (
                                <p className="text-xs text-white/70 text-center">{openShort.caption}</p>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>

                )}

                {profileTab === "plan" && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Trophy size={14} className="text-amber-300" />
                      <span className="text-sm font-black">{t("Subscription", "الاشتراك")}</span>
                    </div>
                    {profile && profile.subscription_tier !== "free" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold uppercase">
                        {profile.subscription_tier}
                      </span>
                    )}
                  </div>

                  {/* While a paid plan is active the upgrade section is hidden
                      entirely — only the active-plan status stays. It returns
                      automatically once the paid period expires. */}
                  {hasActiveSub ? (
                    <button
                      onClick={() => setSubscribeDialogOpen(true)}
                      className="w-full flex items-center justify-between rounded-xl p-3 border border-emerald-400/30 bg-emerald-500/10"
                    >
                      <span className="text-xs font-bold text-emerald-200">
                        ✓ {t(`${(profile?.subscription_tier ?? "").toUpperCase()} plan active`, `خطتك ${profile?.subscription_tier} فعّالة`)}
                      </span>
                      <span className="text-[10px] text-emerald-300/70 underline">{t("Manage", "إدارة")}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setSubscribeDialogOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-fuchsia-500/20 border border-amber-400/40 text-amber-200 text-xs font-black flex items-center justify-center gap-1.5"
                    >
                      <Crown size={13} /> {t("Upgrade your plan", "ترقية خطتك")}
                    </button>
                  )}


                  <Dialog open={subscribeDialogOpen} onOpenChange={setSubscribeDialogOpen}>
                    <DialogContent className="border-cyan-400/30 bg-black/95 backdrop-blur-md sm:max-w-md max-h-[85vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-400">
                          <Crown size={16} className="text-cyan-300" /> {t("Choose your plan", "اختر خطتك")}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="grid gap-2">
                        {(["basic", "pro", "elite"] as SubTier[]).map((tier) => {
                          const perks: Record<SubTier, string[]> = {
                            basic: [
                              t("Subscriber badge", "شارة مميزة"),
                              t("Arena priority queue", "أولوية دخول المعارك"),
                              t("+1 saved design slot boost", "مساحة إضافية لحفظ التصاميم"),
                            ],
                            pro: [
                              t("Everything in Basic", "كل شي بالأساسي"),
                              t("Exclusive Studio colors & materials", "ألوان وخامات حصرية بالاستوديو"),
                              t("Priority AI judging (faster queue)", "أولوية بتقييم الذكاء الاصطناعي"),
                              t("Instant verified checkmark ✔", "علامة توثيق فورية ✔"),
                              t(`Friends list — add up to ${FRIEND_LIMIT.pro} people (Clan)`, `قائمة أصدقاء — أضف حتى ${FRIEND_LIMIT.pro} أشخاص (كلان)`),
                            ],
                            elite: [
                              t("Everything in Pro", "كل شي بالبرو"),
                              t("Sell without Level 50", "بيع بدون شرط مستوى 50"),
                              t("Zero commission on sales", "بدون عمولة على مبيعاتك"),
                              t("Early access to new drops & features", "وصول مبكر للميزات الجديدة"),
                              t(`Bigger clan — up to ${FRIEND_LIMIT.elite} friends`, `كلان أكبر — حتى ${FRIEND_LIMIT.elite} صديق`),
                            ],
                          };
                          const isCurrent = profile?.subscription_tier === tier;
                          const rank = { basic: 1, pro: 2, elite: 3 }[tier];
                          const currentRank = { free: 0, basic: 1, pro: 2, elite: 3 }[profile?.subscription_tier ?? "free"];
                          return (
                            <div
                              key={tier}
                              className={`rounded-xl p-3 border ${isCurrent ? "border-emerald-400/50 bg-emerald-500/10" : "border-cyan-400/10 bg-gradient-to-br from-cyan-500/5 to-fuchsia-500/5"}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-black uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-300">{tier}</span>
                                <span className="text-cyan-200 font-mono text-xs font-bold">
                                  {currency === "USD"
                                    ? `$${(TIER_PRICES_CENTS[tier] / 100).toFixed(2)}`
                                    : formatMoney(convertUsdCentsToCurrency(TIER_PRICES_CENTS[tier], currency), currency)}
                                  <span className="text-white/40">/{t("mo", "شهر")}</span>
                                </span>
                              </div>
                              <ul className="text-[10px] text-white/50 space-y-0.5 mb-2 list-disc pr-4">
                                {perks[tier].map((p) => <li key={p}>{p}</li>)}
                              </ul>
                              {isCurrent ? (
                                <span className="block text-center text-[10px] font-bold text-emerald-300">
                                  ✓ {t("Active plan", "خطتك الحالية")}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSubscribe(tier)}
                                  disabled={subscribing === tier || currentRank >= rank}
                                  className="w-full py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/30 to-fuchsia-500/30 border border-cyan-400/40 text-cyan-100 text-[11px] font-bold disabled:opacity-40"
                                >
                                  {subscribing === tier ? "..." : t("Subscribe", "اشترك")}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {profile?.stripe_customer_id && (
                        <button
                          onClick={handleManageBilling}
                          className="mt-1 w-full py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white/70"
                        >
                          {t("Manage Subscription", "إدارة الاشتراك")}
                        </button>
                      )}
                    </DialogContent>
                  </Dialog>

                </div>

                )}

                {/* §9 — the payouts section (Card icon + "استلام أرباح
                    الـZONE / اربط حساب الاستلام" Stripe card) is deleted; the
                    Friends tab takes its place in the icon rail. */}

                {profileTab === "friends" && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-fuchsia-300" />
                      <span className="text-sm font-black">{t("Friends (Clan)", "الأصدقاء (كلان)")}</span>
                    </div>
                    <span className="text-[10px] text-white/40">{friends.length}/{FRIEND_LIMIT[profile?.subscription_tier ?? "free"] ?? 0}</span>
                  </div>

                  {/* §9b — incoming friend requests (pending, 30-day expiry).
                      Accept → mutual friendship rows; decline → closed. */}
                  {friendRequests.length > 0 && (
                    <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-2.5 space-y-1.5">
                      <div className="text-[10px] uppercase tracking-widest text-amber-200/80">
                        {t("Friend requests", "طلبات الصداقة")} ({friendRequests.length})
                      </div>
                      {friendRequests.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 rounded-lg bg-black/30 px-2 py-1.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-[10px] font-black text-black overflow-hidden shrink-0">
                            {r.avatarUrl ? <img src={r.avatarUrl} className="w-full h-full object-cover" /> : r.username[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate">{r.username}</div>
                            <div className="text-[9px] text-white/35">LVL {r.level}</div>
                          </div>
                          <button
                            onClick={() => handleRespondRequest(r.id, true)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-black"
                          >
                            {t("Accept", "قبول")}
                          </button>
                          <button
                            onClick={() => handleRespondRequest(r.id, false)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[10px] font-black"
                          >
                            {t("Decline", "رفض")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(FRIEND_LIMIT[profile?.subscription_tier ?? "free"] ?? 0) === 0 ? (
                    <p className="text-[11px] text-white/40">
                      {t("Subscribe to Pro or Elite to unlock a friends list.", "اشترك ببرو أو إيليت عشان تفتح قائمة الأصدقاء.")}
                    </p>
                  ) : (
                    <>
                      {/* §9 — instant search by name / @handle */}
                      <div className="relative mb-2">
                        <input
                          value={friendQuery}
                          onChange={(e) => setFriendQuery(e.target.value)}
                          placeholder={t("Search by name or @handle…", "ابحث بالاسم أو @المعرّف…")}
                          className="w-full rounded-lg bg-black/40 border border-white/10 text-xs px-2.5 py-1.5 text-white outline-none focus:border-fuchsia-400/50"
                        />
                        {friendSearching && (
                          <Loader2 size={13} className="animate-spin absolute left-2.5 top-2 text-white/40" />
                        )}
                      </div>
                      {friendQuery.trim().length >= 2 && (
                        <div className="mb-2 rounded-xl border border-white/10 bg-black/50 divide-y divide-white/5">
                          {friendResults.length === 0 ? (
                            <p className="text-[11px] text-white/30 text-center py-2">
                              {t("No players found", "لا يوجد لاعبون بهذا الاسم")}
                            </p>
                          ) : (
                            friendResults.map((r) => {
                              const already = friends.some((f) => f.id === r.id);
                              return (
                                <div key={r.id} className="flex items-center gap-2 px-2.5 py-1.5">
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-[10px] font-black text-black overflow-hidden shrink-0">
                                    {r.avatar_url ? <img src={r.avatar_url} className="w-full h-full object-cover" /> : r.username[0]?.toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold truncate">@{r.username}</div>
                                    <div className="text-[9px] text-white/35">LVL {r.level}</div>
                                  </div>
                                  <button
                                    onClick={() => { if (!already) handleSendFriendRequest(r.id); }}
                                    disabled={already || friendReqState === "sending" || friendReqState === "pending"}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition ${
                                      already
                                        ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                                        : "bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-100 hover:bg-fuchsia-500/30 disabled:opacity-40"
                                    }`}
                                  >
                                    {already ? t("Friends ✓", "أصدقاء ✓") : t("Request", "طلب")}
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                      {friends.length === 0 ? (
                        <p className="text-[11px] text-white/30 text-center py-2">{t("No friends yet — add some by their Player ID.", "ما فيه أصدقاء بعد — أضف بمعرّف اللاعب.")}</p>
                      ) : (
                        <div className="space-y-1">
                          {friends.map((f) => (
                            <div key={f.id} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-[9px] font-black text-black overflow-hidden">
                                {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : f.username[0]?.toUpperCase()}
                              </div>
                              <span className="flex-1 text-xs font-semibold truncate">{f.username}</span>
                              <RankBadge level={f.level} lang={lang} size={10} />
                              <button onClick={() => setConfirmAction({
                                message: t(`Remove ${f.username} from your clan?`, `إزالة ${f.username} من عشيرتك؟`),
                                confirmLabel: t("Remove", "إزالة"),
                                onConfirm: () => handleRemoveFriend(f.id),
                              })} className="text-white/30 hover:text-red-300"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>


                )}

                {profileTab === "settings" && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings size={14} className="text-cyan-300" />
                    <span className="text-sm font-black">{t("Settings", "الإعدادات")}</span>
                  </div>
                  <SettingsPanel
                    lang={lang} setLang={setLang} quality={quality} setQuality={setQuality}
                    privacy={privacy} setPrivacy={changePrivacy} volume={volume} setVolume={setVolume}
                    visualizer={visualizer} setVisualizer={setVisualizer}
                    currency={currency} setCurrency={setCurrency}
                  />

                  {/* §10 — the bring-your-own-API-keys card was removed:
                      AI generation and supplier lookups always run through
                      the app's managed gateway now. */}
                  <p className="mt-1 text-[10px] text-white/40">
                    {privacy
                      ? t("Privacy ON — visitors only see your name, level and bio.", "الخصوصية مفعّلة — الزوار يشوفون الاسم والمستوى والنبذة فقط.")
                      : t("Privacy OFF — visitors can also see your saved designs.", "الخصوصية معطّلة — الزوار يشوفون كذلك تصاميمك المحفوظة.")}
                  </p>

                  {/* Profile info now lives inside Settings instead of its own tab */}
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <User size={14} className="text-cyan-300" />
                      <span className="text-sm font-black">{t("Edit Profile Information", "تعديل معلومات البروفايل")}</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-white/40 uppercase">{t("Display Name", "اسم العرض")}</label>
                        <div className="relative">
                          <input
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            maxLength={24}
                            className={`w-full mt-1 bg-black/40 border rounded-lg px-3 py-2 text-xs outline-none transition ${
                              settingsNameTaken ? "border-red-400/70" : "border-white/10 focus:border-cyan-400/50"
                            }`}
                          />
                          {settingsNameChecking && <Loader2 size={13} className="absolute left-2.5 top-1/2 mt-1 -translate-y-1/2 animate-spin text-white/40" />}
                        </div>
                        {settingsNameTaken && (
                          <p className="mt-1 text-[10px] font-bold text-red-300" role="alert">{USERNAME_TAKEN_AR}</p>
                        )}
                        {settingsNameInvalid && (
                          <p className="mt-1 text-[10px] font-bold text-amber-300" role="alert">{t("Name must be at least 2 characters", "اكتب اسمًا لا يقل عن حرفين")}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 uppercase">{t("Bio / Tagline", "نبذة")}</label>
                        <input
                          value={profileBio}
                          onChange={(e) => setProfileBio(e.target.value)}
                          className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => { updateProfile({ username: profileName.trim(), bio: profileBio }); toast.success(t("Profile saved", "تم حفظ البروفايل")); }}
                      disabled={settingsNameTaken || settingsNameInvalid || settingsNameChecking || profileName.trim().length < 2}
                      className="mt-3 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-bold disabled:opacity-40"
                    >
                      {t("Save Profile", "حفظ البروفايل")}
                    </button>
                    <button
                      onClick={() => signOut()}
                      className="mt-3 ms-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 text-xs font-bold"
                    >
                      {t("Sign Out", "تسجيل الخروج")}
                    </button>
                  </div>

                  <div className="mt-4 flex justify-center gap-4 text-[10px] text-white/40">
                    <Link to="/privacy" className="hover:text-cyan-300 hover:underline">{t("Privacy Policy", "سياسة الخصوصية")}</Link>
                    <span>·</span>
                    <Link to="/terms" className="hover:text-cyan-300 hover:underline">{t("Terms of Use", "شروط الاستخدام")}</Link>
                  </div>
                </div>
                )}
              </div>
            )}
          </section>

          <aside className="hidden lg:flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 min-h-0 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
              <AIDesignChat onApplyDesign={aiApplyDesign} lang={lang} />
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden flex flex-col max-h-[40%]">
              <div className="p-3 border-b border-white/10 flex items-center gap-2">
                <MessageSquare size={14} className="text-fuchsia-300" />
                <span className="text-xs font-bold uppercase tracking-widest">{t("Arena Chat", "دردشة الساحة")}</span>
              </div>
              <div className="flex-1 overflow-hidden"><ChatPanel /></div>
            </div>
          </aside>
        </div>
      </main>

      <button
        onClick={() => setAiOpen(true)}
        className="lg:hidden fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 shadow-[0_0_25px_rgba(217,70,239,0.6)] flex items-center justify-center"
        aria-label="Open AI stylist"
      >
        <Bot size={22} className="text-black" />
      </button>

      <AnimatePresence>
        {aiOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setAiOpen(false)} className="lg:hidden fixed inset-0 bg-black/70 z-50" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26 }}
              className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-black border-t border-white/10 rounded-t-3xl h-[80vh] flex flex-col">
              <div className="flex justify-between items-center p-3 border-b border-white/10">
                <span className="font-black text-sm">{t("AI Stylist", "المصمم الذكي")}</span>
                <button onClick={() => setAiOpen(false)}><X size={20} /></button>
              </div>
              <div className="flex-1 min-h-0">
                <AIDesignChat onApplyDesign={aiApplyDesign} lang={lang} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-black/90 backdrop-blur-xl border-t border-white/10 px-1 py-2 flex overflow-x-auto items-center">
        {bottomNav.map((n) => {
          const Icon = n.icon;
          const active = tab === n.id;
          // §2 — the "+" action button: raised gradient circle, dead center
          // of the bar. Opens the shared video-upload picker, never changes
          // the active tab itself.
          if (n.id === "upload") {
            return (
              <button
                key={n.id}
                onClick={() => setNavUploadOpen(true)}
                title={t(n.en, n.ar)}
                className="flex-1 min-w-[54px] flex flex-col items-center gap-0.5 py-1"
              >
                <span className="w-11 h-11 -mt-3 rounded-2xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-black flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.45)] border-2 border-black/40 active:scale-95 transition">
                  <Plus size={22} strokeWidth={3} />
                </span>
              </button>
            );
          }
          return (
            <button key={n.id} onClick={() => setTab(n.id as TabId)}
              className={`flex-1 min-w-[54px] flex flex-col items-center gap-0.5 py-1 rounded-lg transition ${active ? "text-cyan-300" : "text-white/50"}`}>
              <Icon size={17} className={active ? "drop-shadow-[0_0_6px_currentColor]" : ""} />
              <span className="text-[9px] font-bold">{t(n.en, n.ar)}</span>
            </button>
          );
        })}
      </nav>

      {/* §2 — shared video-upload flow behind the bottom-bar "+" (same
          components the Reels tab uses). After posting, jumps to Reels. */}
      {user && (
        <>
          <VideoUploadPicker
            lang={lang}
            open={navUploadOpen}
            onClose={() => setNavUploadOpen(false)}
            onFile={(f) => { setNavUploadFile(f); setNavUploadOpen(false); }}
          />
          {/* §1 — the upload dialog only opens after the user explicitly
              picked a file via the "+" nav action. It must NEVER auto-appear
              right after login. */}
          {navUploadFile !== null && (
            <VideoUploadDialog
              lang={lang}
              userId={user.id}
              username={profile?.username ?? "player"}
              initialFile={navUploadFile}
              onClose={() => { setNavUploadFile(null); }}
              onDone={() => {
                setNavUploadFile(null);
                setTab("feed");
                toast(lang === "ar" ? "انطلق للريلز 🎬" : "Jumping to Reels 🎬");
              }}
            />
          )}
        </>
      )}

      <div className="fixed top-20 right-4 z-50 space-y-1 pointer-events-none">
        <AnimatePresence>
          {popups.map((p) => (
            <motion.div key={p.id}
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-xs font-bold shadow-lg">
              {p.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* §14a — floating scroll-to-top on long screens (not over the
          full-screen Reels player, which has its own snap scroll). */}
      {tab !== "feed" && <ScrollTopFab scrollRef={mainScrollRef} />}

      {/* §14e — confirmation before any permanent deletion */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setConfirmAction(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 8 }}
              className="w-full max-w-xs rounded-2xl border border-red-400/30 bg-[#0a0510] p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm font-black mb-1">{t("Are you sure?", "هل أنت متأكد؟")}</div>
              <p className="text-xs text-white/60 leading-relaxed">{confirmAction.message}</p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] text-white/70 text-xs font-bold"
                >
                  {t("Cancel", "إلغاء")}
                </button>
                <button
                  onClick={() => { const a = confirmAction; setConfirmAction(null); a.onConfirm(); }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-400/50 text-red-200 text-xs font-black"
                >
                  {confirmAction.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ShippingAddressDialog
        open={Boolean(shippingListing)}
        lang={lang}
        busy={buyingId === shippingListing?.id}
        onCancel={() => setShippingListing(null)}
        onConfirm={handleConfirmPurchase}
      />

      <ProductionRequestDialog
        open={Boolean(productionDesignId)}
        lang={lang}
        busy={Boolean(requestingProductionId)}
        onCancel={() => setProductionDesignId(null)}
        onConfirm={handleRequestProduction}
      />
    </div>
  );
}

void Sparkles; void RANKS; void ShoppingBag;
