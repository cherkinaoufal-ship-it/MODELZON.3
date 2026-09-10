-- MODELZON — Phase 21: instant signup + unique usernames + AI-challenge channels.
-- Run in Supabase → SQL Editor, AFTER 001-020.
-- Covers:
--   §1  Unique player names (case-insensitive) + instant session signup support.
--   §8  ai_challenge_enabled per user + two fully separate matchmaking channels.
--   §8  Removes the "community topics" voting storage (arena_topic_votes).
--       arena_topics itself STAYS: it is the foreign-key backbone that
--       arena_entries (battles-judged / high-score mission stats) points at,
--       and finalizeBattleRoom registers each battle's topic there. What is
--       being deleted is the PEOPLE-VOTING feature: its table, trigger and
--       UI — not the internal topic registry.

/* ------------------------------------------------------------------ */
/* §1 — unique player names                                            */
/* ------------------------------------------------------------------ */

-- 1a) De-duplicate any existing usernames BEFORE adding the unique index,
--     so the migration can never fail on legacy data. The oldest profile
--     keeps the name; later ones get a numeric suffix (Ghxdv → Ghxdv2 …).
create or replace function public.dedupe_usernames()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  candidate text;
  n integer;
begin
  for r in
    select p.id, p.username
    from public.profiles p
    where exists (
      select 1 from public.profiles q
      where lower(q.username) = lower(p.username) and q.created_at < p.created_at
    )
    order by p.created_at
  loop
    n := 1;
    candidate := r.username;
    while exists (select 1 from public.profiles where lower(username) = lower(candidate) and id <> r.id) loop
      n := n + 1;
      candidate := r.username || n::text;
    end loop;
    if candidate <> r.username then
      update public.profiles set username = candidate where id = r.id;
    end if;
  end loop;
end;
$$;

select public.dedupe_usernames();
drop function if exists public.dedupe_usernames();

-- 1b) The unique constraint itself — case-insensitive so "Ghxdv" and
--     "ghxdv" can never both exist.
drop index if exists public.profiles_username_unique;
create unique index profiles_username_unique
  on public.profiles (lower(username));

-- 1c) Momentary availability check callable by ANYONE (even pre-signup
--     anon visitors typing their name on the signup form). security definer
--     bypasses RLS without exposing the profiles table itself.
create or replace function public.username_available(name text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  clean text;
begin
  clean := lower(btrim(coalesce(name, '')));
  if char_length(clean) < 2 or char_length(clean) > 24 then
    return false;
  end if;
  return not exists (
    select 1 from public.profiles where lower(username) = clean
  );
end;
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- 1d) The signup trigger now also guarantees a collision-free name at
--     account-creation time (last line of defense — the app checks live,
--     but two people submitting the same name in the same instant are
--     still handled gracefully instead of erroring the signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  base := coalesce(btrim(new.raw_user_meta_data ->> 'username'), 'Player');
  if char_length(base) < 2 then
    base := 'Player';
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into public.profiles (id, username)
  values (new.id, candidate);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

/* ------------------------------------------------------------------ */
/* §8 — AI-challenge flag + separated matchmaking channels             */
/* ------------------------------------------------------------------ */

-- Per-user opt-in flag for the AI design challenge / AI-channel matchmaking.
-- Default ON (existing behaviour), changeable from the Arena's AI-challenge
-- card. Matchmaking reads this SERVER-side and never mixes channels.
alter table public.profiles
  add column if not exists ai_challenge_enabled boolean not null default true;

-- Two independent matchmaking channels: 'ai' (player has the AI challenge
-- enabled) and 'classic' (disabled). A waiting room belongs to exactly one
-- channel and joinBattleRoom only ever searches within the caller's own
-- channel — an enabled player can NEVER be matched with a disabled one.
alter table public.battle_rooms
  add column if not exists channel text not null default 'classic'
  check (channel in ('ai', 'classic'));

/* ------------------------------------------------------------------ */
/* §8 — remove the community-topics voting storage                     */
/* ------------------------------------------------------------------ */

drop trigger if exists bump_topic_votes on public.arena_topic_votes;
drop function if exists public.bump_topic_votes();
drop table if exists public.arena_topic_votes;
