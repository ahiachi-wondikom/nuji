# How to apply these files

Drop these files into your `nuji` repo at the same paths, overwriting the
existing ones:

- `package.json`
- `.gitignore`
- `HANDOVER.md`
- `supabase-schema.sql`
- `server/server.js`
- `server/server.supabase.js`
- `server/db.js`

## Two things a zip can't do for you — do these manually

1. **Delete `server/db.json`** from the repo and stop tracking it.
   It held the hardcoded demo/seed users (Amina, Chiamaka, Tunde, Blessing,
   Sani) that could leak into leaderboard data. It's already listed in the
   updated `.gitignore` so it won't come back.

   ```
   git rm server/db.json
   ```

2. **Stop tracking `.env.local` and rotate your Supabase key.**
   `.env.local` is currently committed to this repo's git history with a
   live Supabase `service_role` key and project URL — that key grants full
   read/write access to your database. Removing it from tracking going
   forward does **not** remove it from history, so if this repo is or has
   ever been public/shared:

   - Rotate the Supabase service key immediately (Supabase dashboard →
     Settings → API → regenerate the `service_role` key), and update
     `SUPABASE_SERVICE_KEY` wherever it's deployed (Render, etc.).
   - Then:
     ```
     git rm --cached .env.local
     ```
     (keeps the file on your machine for local dev, just stops committing it)
   - For a public repo, consider also scrubbing it from history
     (`git filter-repo` or BFG Repo-Cleaner) once the key is rotated.

## What changed, briefly

- **`package.json`** — `start`/`server` scripts now run `server.supabase.js`
  directly.
- **`server/server.js`** — reduced to a one-line redirect into
  `server.supabase.js`, so it can never fall back to local JSON storage.
- **`server/db.js`** — local JSON file storage and hardcoded demo users
  removed entirely; only stateless scoring/badge/activity helpers remain.
- **`server/server.supabase.js`** — hardcoded fallback admin credentials
  removed (admin login now returns 503 until `ADMIN_EMAIL`,
  `ADMIN_PASSWORD`, and a signing secret are set via env vars); prompt
  endpoints now surface real Supabase errors instead of silently returning
  empty/fake data.
- **`supabase-schema.sql`** — added the `category` column to `prompts`
  (with a safe `alter table ... add column if not exists` for existing
  databases).
- **`HANDOVER.md`** — two lines updated to match the above (no more
  auto-seeded prompts; admin env var notes).
