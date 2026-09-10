import type { Lang } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles, Plus, ArrowBigUp, Loader2, Wand2, ToggleLeft, ToggleRight, Users, Trophy,
} from "lucide-react";
import { generateChallenge } from "@/lib/arena-ai.functions";
import { listTopics, addTopic as addTopicDb, voteTopic, fetchTopicLeaderboard, type ArenaTopic, type ArenaEntry } from "@/lib/arena";
import { useAuth } from "@/lib/auth";
import CommunityChat from "@/components/modelzon/CommunityChat";
import { toast } from "sonner";

interface Props {
  lang: Lang;
  garment: string;
  topic: string;
  /** Chat identity (§7) — the current player's public name + avatar. */
  username: string;
  avatarUrl: string | null;
  onTopic: (text: string) => void;
}

type Challenge = Awaited<ReturnType<typeof generateChallenge>>;

/**
 * §8 — the old manual "AI judge" card (describe your design / upload an
 * image / "Score my design" button) is GONE from the visible UI. AI judging
 * now runs automatically in the background when a battle-room round timer
 * ends (see finalizeBattleRoom in lib/battle.functions.ts): everyone's
 * submission is scored, ranked, and the XP stakes are applied
 * (top 2 → +500 XP each · 3rd → unchanged · 4th → −350 XP), then the
 * round-results card shows the final ranking before returning to the arena.
 */
export default function ArenaBoard({ lang, garment, topic, username, avatarUrl, onTopic }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const challengeFn = useServerFn(generateChallenge);
  const { user } = useAuth();

  const [topics, setTopics] = useState<ArenaTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [draft, setDraft] = useState("");

  const [aiChallengeOn, setAiChallengeOn] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [section, setSection] = useState<"topics" | "challenge">("topics");

  const [topicLeaderboard, setTopicLeaderboard] = useState<ArenaEntry[]>([]);

  const currentTopicId = topics.find((x) => x.text === topic)?.id ?? null;

  const loadTopics = async () => {
    if (!user) return;
    setTopicsLoading(true);
    const rows = await listTopics(user.id);
    setTopics(rows);
    setTopicsLoading(false);
  };

  useEffect(() => {
    loadTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!currentTopicId) {
      setTopicLeaderboard([]);
      return;
    }
    fetchTopicLeaderboard(currentTopicId).then(setTopicLeaderboard);
  }, [currentTopicId]);

  const addTopic = async () => {
    const text = draft.trim();
    if (!text || !user) return;
    const created = await addTopicDb(text, user.id);
    if (created) {
      setDraft("");
      onTopic(text);
      loadTopics();
    } else {
      toast.error(t("Couldn't add topic", "تعذّر إضافة الموضوع"));
    }
  };

  const vote = async (id: string) => {
    if (!user) return;
    setTopics((prev) => prev.map((x) => (x.id === id ? { ...x, votes_count: x.votes_count + 1, votedByMe: true } : x)));
    const ok = await voteTopic(id, user.id);
    if (!ok) loadTopics(); // revert the optimistic update by re-syncing with the server
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
      {/* Icon sub-tabs — the manual "Judge Me" tool is gone (§8): judging is
          automatic at the end of every battle round now. */}
      <div className="flex rounded-xl border border-white/10 overflow-hidden text-[11px] font-bold">
        {([
          ["topics", Users, t("Topics & Chat", "المواضيع والدردشة")],
          ["challenge", Wand2, t("AI Challenge", "تحدي الذكاء الاصطناعي")],
        ] as const).map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition ${
              section === id ? "bg-cyan-500/20 text-cyan-100" : "bg-white/[0.02] text-white/50 hover:bg-white/[0.05]"
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Community topics — people decide, not the AI */}
      {section === "topics" && (
      <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <Users size={15} className="text-cyan-300" />
          <span className="text-sm font-black">{t("Community topics", "مواضيع الناس")}</span>
          <span className="ml-auto text-[10px] text-white/40">
            {t("Voted by players", "بتصويت اللاعبين")}
          </span>
        </div>
        <p className="text-[11px] text-white/50 mb-3">
          {t("Players suggest and vote on what the arena designs. The AI never chooses the topic.", "اللاعبون يقترحون ويصوّتون على موضوع الساحة. الذكاء الاصطناعي لا يحدد الموضوع أبداً.")}
        </p>

        <div className="flex gap-2 mb-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTopic()}
            placeholder={t("Suggest a topic…", "اقترح موضوعاً…")}
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50"
          />
          <button
            onClick={addTopic}
            className="px-3 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center gap-1"
          >
            <Plus size={13} /> {t("Add", "إضافة")}
          </button>
        </div>

        <div className="space-y-2">
          {topicsLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-white/40" size={18} /></div>
          ) : (
            topics.map((x) => {
              const active = topic === x.text;
              return (
                <div
                  key={x.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition ${
                    active ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-black/30"
                  }`}
                >
                  <button onClick={() => onTopic(x.text)} className="flex-1 text-start">
                    <div className="text-xs font-bold leading-tight">{x.text}</div>
                    <div className="text-[10px] text-white/40">{x.author_username ?? "Player"}</div>
                  </button>
                  <button
                    onClick={() => vote(x.id)}
                    disabled={x.votedByMe}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border ${
                      x.votedByMe
                        ? "bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-200"
                        : "bg-white/5 border-white/10 text-white/60"
                    }`}
                  >
                    <ArrowBigUp size={13} /> {x.votes_count}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* §7 — live community chat, right below the topic-suggestion card */}
      {section === "topics" && user && (
        <CommunityChat lang={lang} userId={user.id} username={username} avatarUrl={avatarUrl} />
      )}

      {section === "topics" && currentTopicId && topicLeaderboard.length > 0 && (
        <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={14} className="text-yellow-400" />
            <span className="text-sm font-black">{t("Topic Leaderboard", "متصدرو الموضوع")}</span>
          </div>
          <div className="space-y-1.5">
            {topicLeaderboard.map((e, i) => (
              <div key={e.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${i < 2 ? "bg-amber-500/10 border border-amber-400/30" : "bg-white/[0.02]"}`}>
                <span className="w-4 text-center font-mono text-white/40">{i + 1}</span>
                <span className="flex-1 truncate">{e.username ?? "Player"}</span>
                <span className="font-mono text-cyan-300">{e.score.toFixed(1)}</span>
                {i < 2 && <span>🏆</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional AI challenge */}
      {section === "challenge" && (
      <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
        <button
          onClick={() => setAiChallengeOn((v) => !v)}
          className="w-full flex items-center gap-2"
        >
          <Wand2 size={15} className="text-fuchsia-300" />
          <span className="text-sm font-black">{t("AI design challenge", "تحدي الذكاء الاصطناعي")}</span>
          {aiChallengeOn ? (
            <ToggleRight size={26} className="ml-auto text-cyan-300" />
          ) : (
            <ToggleLeft size={26} className="ml-auto text-white/30" />
          )}
        </button>
        <p className="text-[11px] text-white/50 mt-1">
          {t("Optional. When on, the AI gives you a professional-grade reference design and you must recreate it by hand.", "اختياري. عند تشغيله يعطيك الذكاء الاصطناعي تصميماً مرجعياً بمستوى احترافي وعليك رسمه بيدك مثله.")}
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
      )}
    </div>
  );
}
