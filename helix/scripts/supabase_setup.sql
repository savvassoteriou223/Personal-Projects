-- ─── Run this in Supabase dashboard → SQL Editor ────────────────────────────
-- Do this BEFORE running the seed script.

-- 1. Enable fuzzy-search extension
create extension if not exists pg_trgm;

-- 2. Create the table
create table if not exists exercise_gifs (
  name    text primary key,   -- normalised lowercase exercise name
  gif_url text not null
);

-- 3. RLS: public read-only (service role used in seed script bypasses this)
alter table exercise_gifs enable row level security;

create policy "Public read"
  on exercise_gifs for select
  to anon using (true);

-- 4. Fuzzy lookup function called by the app
create or replace function find_exercise_gif(search_name text)
returns text language sql stable security definer as $$
  select gif_url
  from exercise_gifs
  where similarity(name, search_name) > 0.25
  order by similarity(name, search_name) desc
  limit 1;
$$;

grant execute on function find_exercise_gif(text) to anon;
