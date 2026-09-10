import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export type UsernameCheck = "idle" | "checking" | "available" | "taken" | "invalid";

/**
 * §1 — live username availability check, debounced.
 *
 * Calls the `username_available` Postgres RPC (see
 * 021_instant_signup_ai_channels.sql) — works for ANON visitors too, so the
 * signup form can validate the name the instant it's typed, before any
 * account exists. The DB unique index stays the final authority.
 */
export function useUsernameAvailability(name: string, minLength = 2) {
  const [status, setStatus] = useState<UsernameCheck>("idle");
  const reqId = useRef(0);

  useEffect(() => {
    const clean = name.trim();
    const id = ++reqId.current;

    if (clean.length < minLength) {
      setStatus(clean.length === 0 ? "idle" : "invalid");
      return;
    }

    setStatus("checking");
    const timer = setTimeout(async () => {
      try {
        // `username_available` ships in 021_instant_signup_ai_channels.sql;
        // the generated Database types may predate it, hence the cast.
        const { data, error } = await (supabase.rpc as any)("username_available", { name: clean });
        if (id !== reqId.current) return; // a newer keystroke superseded us
        if (error) {
          // RPC not migrated yet — never block the user on our own infra gap;
          // the server-side unique index still catches true duplicates.
          console.error("username_available failed:", error.message);
          setStatus("available");
          return;
        }
        setStatus(data === true ? "available" : "taken");
      } catch {
        if (id === reqId.current) setStatus("available");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [name, minLength]);

  return status;
}

/** The one canonical Arabic/English message for a taken name (§1). */
export const USERNAME_TAKEN_AR = "هذا الاسم مستعمل، يرجى اختيار اسم آخر";
export const USERNAME_TAKEN_EN = "This name is taken — please choose another one";
