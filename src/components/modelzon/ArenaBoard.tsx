import type { Lang } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles, Loader2, Wand2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { generateChallenge } from "@/lib/arena-ai.functions";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import CommunityChat from "@/components/modelzon/CommunityChat";
import { toast } from "sonner";

interface Props {
  lang: Lang;
  garment: string;
  /** Chat identity (§7) — the current player's public name + avatar. */
  username: string;
  avatarUrl: string | null;
}

type Challenge = Awaited<ReturnType<typeof generateChallenge>>;

/**
 * §8 — the community-topics card ("مواضيع الناس": suggest / vote / topic
 * leaderboard) is DELETED entirely — UI, logic and storage
 * (arena_topic_votes + bump_topic_votes are dropped in migration 021;
 * the arena_topics table itself stays only as the battle-room topic
 * registry). What remains is the AI Challenge card — now persisted to
 * profiles.ai_challenge_enabled — plus the live community chat.
 */
export default function ArenaBoard({ lang, garment, username, avatarUrl }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const challengeFn = useServerFn(generateChallenge);
  const { user } = useAuth();

  const [aiChallengeOn, setAiChallengeOn] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // §8 — persist the AI-challenge toggle per user. Server matchmaking reads
  // profiles.ai_challenge_enabled and only ever matches players whose flag
  // matches (two independent channels: 'ai' vs 'classic').
  useEffect(() => {
    if (!user) return;
    (supabase
      .from("profiles")
      .select("ai_challenge_enabled") as any)
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: { data: { ai_challenge_enabled: boolean } | null }) => {
        if (data && typeof data.ai_challenge_enabled === "boolean") setAiChallengeOn(data.ai_challenge_enabled);
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleChallenge = async () => {
    const next = !aiChallengeOn;
    setAiChallengeOn(next); // optimistic
    if (!user) return;
    const { error: err } = await (supabase
      .from("profiles") as any)
      .update({ ai_challenge_enabled: next })
      .eq("id", user.id);
    if (err) {
      setAiChallengeOn(!next);
      toast.error(t("Couldn't save your setting", "تعذّر حفظ الإعداد"));
    }
  };

  const runChallenge = async () => {
    if (!user) return;
    setChallengeBusy(true);
    setError(null);
    try {
      setChallenge(await challengeFn({ data: { userId: user.id, lang, garment } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChallengeBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI challenge — the tab content, kept exactly as it was; the topics
          sub-tab is gone so the card lives directly on the board. */}
      <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 size={15} className="text-fuchsia-300" />
          <span className="text-sm font-black">{t("AI Challenge", "تحدي الذكاء الاصطناعي")}</span>
        </div>
        <button
          onClick={toggleChallenge}
          className="w-full flex items-center gap-2"
        >
          <span className="text-xs font-bold text-white/70">{t("Participate in the AI challenge", "المشاركة في تحدي الذكاء الاصطناعي")}</span>
          {aiChallengeOn ? (
            <ToggleRight size={26} className="ml-auto text-cyan-300" />
          ) : (
            <ToggleLeft size={26} className="ml-auto text-white/30" />
          )}
        </button>
        <p className="text-[11px] text-white/50 mt-1">
          {t(
            "When on, the AI gives you a professional-grade reference design and you must recreate it by hand. You are only matched with other AI-challenge players.",
            "عند تشغيله يعطيك الذكاء الاصطناعي تصميماً مرجعياً بمستوى احترافي وعليك رسمه بيدك مثله. ستُطابق فقط مع لاعبي التحدي نفسه.",
          )}
        </p>

        <AnimatePresence>
          {aiChallengeOn && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <button
                onClick={runChallenge}
                disabled={challengeBusy}
                className="mt-3 px-3 py-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-100 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {challengeBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {t("Generate challenge", "توليد تحدٍ")}
              </button>

              {challenge && (
                <div className="mt-3 rounded-xl p-3 bg-black/40 border border-white/10">
                  <div className="font-black text-sm">{challenge.title}</div>
                  <p className="text-[11px] text-white/60 mt-1 leading-relaxed">{challenge.brief}</p>
                  <ol className="mt-2 space-y-1">
                    {challenge.steps.map((s, i) => (
                      <li key={i} className="text-[11px] text-white/70 flex gap-2">
                        <span className="text-cyan-300 font-mono">{i + 1}.</span> {s}
                      </li>
                    ))}
                  </ol>
                  <div className="flex gap-2 mt-2">
                    {challenge.colors.map((c) => (
                      <span key={c} className="w-6 h-6 rounded-md border border-white/20" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
      </div>

      {/* §7 — live community chat (kept; the topics card above it is gone) */}
      {user && <CommunityChat lang={lang} userId={user.id} username={username} avatarUrl={avatarUrl} />}
    </div>
  );
}
