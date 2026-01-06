# Night Drive

Night Drive is a WebGL driving mini-game built with Next.js and Three.js. Race around a tiny planet for two minutes, hit as many objects as possible, and climb a Supabase-backed leaderboard.

![Gameplay preview](./Screenshot%202026-01-06%20133558.png)

![Landing animation](./m.gif)

## Gameplay Overview
- 2-minute timed run on a curved planet; collide with lit props (palm trees/boxes) to increase the `Hits` counter.
- Keyboard: `WASD` or arrow keys; touch devices get an on-screen D-pad (`MobileControls`).
- HUD shows remaining time (color-coded), hit count, and active player. Game over modal offers replay or logout.
- Username is stored locally; returning players go straight to `/game`.
- Optional geolocation (ipapi.co) sets a country flag on the leaderboard; game continues if the lookup fails.

## Tech Stack
- Next.js 15 (App Router) + React 19 + TypeScript 5; Turbopack is used in dev/build scripts.
- Three.js 0.180 for rendering a custom spherical world: `GameEngine`, `Car`, `DustParticleSystem`, and palm-tree assets loaded via `FBXLoader`.
- Styling via Tailwind CSS 4 + bespoke CSS in `app/globals.css` (animated landing page, HUD, mobile controls).
- Supabase JS v2 for auth/leaderboards; IP geolocation via `https://ipapi.co/json/`.

## Project Structure (key files)
- `app/page.tsx`: Landing page with username form, leaderboard tabs, and animated background using `m.gif`.
- `app/game/page.tsx`: Gameplay loop (timer, HUD, mobile controls) and lifecycle hooks for focus/touch handling.
- `components/UsernameForm.tsx`: Validates usernames, detects country, logs in or registers, then routes to `/game`.
- `components/Leaderboard.tsx`: Daily/weekly/monthly/all-time tabs fed by Supabase RPC functions, with country flags.
- `components/MobileControls.tsx`: Pointer/touch-safe virtual D-pad that drives `GameEngine#setKeyState`.
- `lib/game/`: Rendering and physics helpers - `GameEngine.ts`, `car.ts`, `environment.ts` (planet + trees + collisions), `dustParticleSystem.ts`, `noise.ts`, `config.ts`, `useGameEngine.ts`.
- `lib/auth.ts`, `lib/geo.ts`, `lib/scores.ts`, `lib/supabase.ts`: Auth/localStorage helpers, IP geolocation, leaderboard queries, and Supabase client.
- Assets: `public/modals/Environment_PalmTree_3.fbx` (palm trees), `public/m.gif` (landing background).

## Data Layer (Supabase)
- Required env vars in `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
  ```
- Tables expected by the app:
  ```sql
  create table public.users (
    id uuid primary key default gen_random_uuid(),
    username text unique not null,
    country text,
    last_played timestamptz default now()
  );

  create table public.scores (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    score integer not null,
    created_at timestamptz default now()
  );

  create index on public.scores (created_at);
  create index on public.scores (score desc);
  ```
- RPC functions used by the leaderboard (all return `id, user_id, score, created_at, username, country`):
  ```sql
  -- Highest score per user (all time)
  create or replace function public.get_top_scores(score_limit int default 100)
  returns table (id uuid, user_id uuid, score int, created_at timestamptz, username text, country text)
  language sql stable as $$
    with per_user as (
      select distinct on (s.user_id) s.*, u.username, u.country
      from public.scores s
      join public.users u on u.id = s.user_id
      order by s.user_id, s.score desc, s.created_at asc
    )
    select * from per_user
    order by score desc, created_at asc
    limit score_limit;
  $$;

  -- Highest per user within a window; adjust interval for each variant
  create or replace function public.get_top_scores_weekly(score_limit int default 100) ...
    where s.created_at >= now() - interval '7 days';

  create or replace function public.get_top_scores_monthly(score_limit int default 100) ...
    where s.created_at >= now() - interval '30 days';

  create or replace function public.get_top_scores_daily(score_limit int default 100) ...
    where s.created_at >= now() - interval '24 hours';
  ```
- Runtime flow: username is validated client-side -> `loginOrRegister` (creates user or logs in) -> optional `updateUserCountry` and `updateLastPlayed` -> `saveScore` writes `{ user_id, score }` on game end -> leaderboard queries the RPC endpoints above.

## Running the Project
1) Install dependencies (Node 18+ recommended): `npm install`
2) Add `.env.local` with the Supabase values above.
3) Start dev server: `npm run dev` (Turbopack) then open `http://localhost:3000`.
4) Production build: `npm run build` then `npm start`.

## Gameplay Notes
- Scoring: each collision with a tree/obstacle increments `Hits`; clearing the 2-minute timer stops the engine and saves the score.
- Visuals: headlights reveal nearby objects, fog and night-sky dome frame the scene, and a GPU-driven dust system trails the car.
- Mobile: layout shifts HUD, adds the virtual D-pad, and locks body scrolling to prevent accidental pull-to-refresh.

## Performance & Assets
- Trees are cloned from `Environment_PalmTree_3.fbx`; a box fallback is used if the FBX fails to load.
- Renderer caps are not enforced; consider limiting `devicePixelRatio` on low-power devices if you notice frame drops.
- Background/hero animation uses the bundled `m.gif`; keep it in `public/` to avoid broken styles.
