import type { Lang } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * §7 — Live community chat under the topic-suggestion field in the Arena's
 * "Judge Me / Topics" area. Real-time via a shared Supabase broadcast
 * channel: everyone currently on this screen sees new messages the moment
 * they're sent. Own messages hug the END edge, everyone else's hug the
 * START edge (WhatsApp/Telegram layout), each with avatar + username.
 */

interface ChatMsg {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  text: string;
  ts: number;
}

interface Props {
  lang: Lang;
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export default function CommunityChat({ lang, userId, username, avatarUrl }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // self: true → the sender's own message arrives through the same
    // broadcast pipeline as everyone else's (single source of truth).
    const channel = supabase.channel("arena-community-chat", { config: { broadcast: { self: true } } });
    channelRef.current = channel;
    channel.on("broadcast", { event: "msg" }, ({ payload }: { payload: ChatMsg }) => {
      setMsgs((m) => [...m.slice(-149), payload]); // keep the last 150
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  const send = () => {
    const text = draft.trim();
    if (!text || !channelRef.current) return;
    const msg: ChatMsg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId, username, avatarUrl, text,
      ts: Date.now(),
    };
    channelRef.current.send({ type: "broadcast", event: "msg", payload: msg });
    setDraft("");
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <MessageSquare size={14} className="text-fuchsia-300" />
        <span className="text-sm font-black">{t("Community chat", "دردشة المجتمع")}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {t("Live", "مباشر")}
        </span>
      </div>

      <div ref={scrollRef} className="h-56 overflow-y-auto p-3 space-y-2.5">
        {msgs.length === 0 ? (
          <p className="text-[11px] text-white/30 text-center py-8">
            {t("No messages yet — say hi to the arena! 👋", "ما فيه رسائل بعد — سلّم على أهل الساحة! 👋")}
          </p>
        ) : (
          msgs.map((m) => {
            const self = m.userId === userId;
            return (
              <div key={m.id} className={`flex gap-2 items-end ${self ? "flex-row-reverse" : ""}`}>
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-[10px] font-black text-black shrink-0">
                  {m.avatarUrl
                    ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : (m.username[0]?.toUpperCase() ?? "?")}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 border text-[12px] leading-snug ${
                    self
                      ? "bg-cyan-500/15 border-cyan-400/30 rounded-br-sm"
                      : "bg-white/[0.05] border-white/10 rounded-bl-sm"
                  }`}
                >
                  <div className={`text-[9px] font-bold mb-0.5 ${self ? "text-cyan-300" : "text-fuchsia-300"}`}>
                    {self ? t("You", "أنت") : m.username}
                  </div>
                  <span className="text-white/85 break-words">{m.text}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2 p-3 border-t border-white/10">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("Message the community…", "اكتب رسالة للمجتمع…")}
          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-fuchsia-400/50"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="px-3 rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black font-black disabled:opacity-40"
          aria-label={t("Send", "إرسال")}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
