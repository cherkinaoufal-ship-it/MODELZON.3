import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Lock, Mail, User as UserIcon, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useUsernameAvailability, USERNAME_TAKEN_AR, USERNAME_TAKEN_EN } from "@/lib/username";

/**
 * Full-screen gate shown when there is no authenticated user. Sign-up is a
 * two-step flow as requested: step 1 is just email + password, step 2 is
 * choosing a display name — THEN straight into the app.
 *
 * §1 — email confirmation is FULLY disabled: signUp creates the session
 * immediately (see auth.tsx which even auto-signs-in as a safety net), so
 * there is no "check your email" waiting state anywhere in this flow —
 * success lands straight on the home screen.
 *
 * §1 — player names are unique: the name field checks availability live
 * (debounced RPC) and blocks the continue button while the name is taken.
 */
export default function AuthGate() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // §1 — live uniqueness check on the display name.
  const nameStatus = useUsernameAvailability(username);
  const nameTaken = nameStatus === "taken";
  const nameInvalid = nameStatus === "invalid";
  const nameChecking = nameStatus === "checking";
  const nameBlocker =
    nameTaken ? USERNAME_TAKEN_AR
    : nameInvalid ? "اكتب اسمًا لا يقل عن حرفين"
    : null;

  const resetToStart = (m: "signin" | "signup") => {
    setMode(m); setStep(1); setError(null);
  };

  const handleStep1Next = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || password.length < 6) {
      setError("اكتب بريد صحيح وكلمة مرور 6 أحرف على الأقل");
      return;
    }
    setStep(2);
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) setError(translateError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleFinishSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (username.trim().length < 2) {
      setError("اكتب اسم عرض لا يقل عن حرفين");
      return;
    }
    if (nameTaken || nameChecking) return; // blocked below anyway
    setBusy(true);
    try {
      const { error } = await signUp(email.trim(), password, username.trim());
      // §1 — no CONFIRM_EMAIL branch anymore: signUp guarantees a session
      // (auto-sign-in fallback included). On success the auth listener
      // unmounts this gate and the user lands straight on the home screen.
      if (error) setError(translateError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black px-6" dir="rtl">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-lg font-black text-white">
            MZ
          </div>
          <h1 className="text-xl font-bold text-white">MODELZON</h1>
          <p className="mt-1 text-sm text-white/50">
            {mode === "signin" ? "سجّل دخولك لمتابعة تصاميمك ومستواك" : step === 1 ? "الخطوة 1 من 2 — بيانات الدخول" : "الخطوة 2 من 2 — اختر اسمك"}
          </p>
        </div>

        <div className="mb-5 flex rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => resetToStart("signin")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${mode === "signin" ? "bg-white/10 text-white" : "text-white/40"}`}
          >
            دخول
          </button>
          <button
            type="button"
            onClick={() => resetToStart("signup")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-white/10 text-white" : "text-white/40"}`}
          >
            حساب جديد
          </button>
        </div>

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-3">
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr"
                className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pr-10 pl-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-cyan-400/50 text-right" />
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr"
                className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pr-10 pl-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-cyan-400/50 text-right" />
            </div>
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
            <button type="submit" disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 py-3 text-sm font-bold text-black disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} دخول
            </button>
          </form>
        ) : (
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form key="step1" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} onSubmit={handleStep1Next} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr"
                    className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pr-10 pl-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-cyan-400/50 text-right" />
                </div>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr"
                    className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pr-10 pl-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-cyan-400/50 text-right" />
                </div>
                {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
                <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 py-3 text-sm font-bold text-black">
                  التالي <ArrowLeft className="h-4 w-4" />
                </button>
              </motion.form>
            ) : (
              <motion.form key="step2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} onSubmit={handleFinishSignup} className="space-y-3">
                <div className="relative">
                  <UserIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input type="text" placeholder="اسم العرض" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus maxLength={24}
                    className={`w-full rounded-xl border bg-black/30 py-3 pr-10 pl-3 text-sm text-white placeholder:text-white/30 outline-none transition ${
                      nameTaken ? "border-red-400/70 focus:border-red-400" : "border-white/10 focus:border-cyan-400/50"
                    }`} />
                  {nameChecking && <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40" />}
                </div>
                {nameBlocker && (
                  <p className={`rounded-lg px-3 py-2 text-xs ${nameTaken ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300"}`} role="alert">
                    {nameBlocker}
                  </p>
                )}
                {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button type="submit" disabled={busy || nameTaken || nameInvalid || nameChecking}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 py-3 text-sm font-bold text-black disabled:opacity-60">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} إنشاء الحساب والدخول
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
}

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "الإيميل أو كلمة المرور غير صحيحة";
  if (m.includes("already registered") || m.includes("already exists")) return "هذا الإيميل مسجّل مسبقاً";
  if (m.includes("password") && m.includes("6")) return "كلمة المرور لازم تكون 6 أحرف على الأقل";
  if (m.includes("email") && m.includes("invalid")) return "صيغة الإيميل غير صحيحة";
  // §1 — DB unique-index violation on the display name (the last-line
  // authority when two people submit the same name simultaneously).
  if (m.includes("duplicate key") || m.includes("profiles_username_unique") || (m.includes("username") && m.includes("unique"))) {
    return USERNAME_TAKEN_AR + " | " + USERNAME_TAKEN_EN;
  }
  return msg;
}
