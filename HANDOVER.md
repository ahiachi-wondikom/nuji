#  Nuji — Project Handover Guide

Everything you need to launch Nuji on **your own** accounts (Supabase + Render + Vercel/Netlify).
Total time: ~20 minutes. No coding needed — just copy & paste.

---

## 0. Get the code
```bash
git clone https://github.com/ahiachi-wondikom/nuji-next.git
cd nuji-next
```
(Use the actual repository URL.)

---

## 1. Database — Supabase (5 min)
1. Go to **supabase.com** → Sign in → **New project** (free plan). Choose a name + password + region (pick one close to Nigeria, e.g. *eu-west-1*).
2. Wait ~2 minutes for it to start.
3. Left sidebar → **SQL Editor** → **New query**.
4. Open the file **`supabase-schema.sql`** from this project, copy ALL of it, paste into the editor, click **Run**.
   - You should see *"Success. No rows returned."* ✅
   - (This creates the `users`, `contributions`, `prompts` tables + the voice-recordings storage bucket. The server fills the prompt library automatically on first start.)
5. Left sidebar → **Settings (⚙) → API**. Copy these two values and keep them in a note:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **service_role key** → click *Reveal* → copy (🔒 secret — never share it publicly or put it in frontend code)

---

## 2. Backend — Render (7 min)
1. Go to **render.com** → Sign in → **New → Web Service**.
2. Connect your GitHub account → choose the **nuji-next** repository.
3. Settings:
   - **Name:** `nuji-api` (anything)
   - **Build Command:** `npm install`
   - **Start Command:** `npm run start:supabase`
4. Add **Environment Variables** (left menu → Environment → Add):

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL from step 1.5 |
   | `SUPABASE_SERVICE_KEY` | your service_role key |
   | `ADMIN_EMAIL` | choose an admin email, e.g. `admin@nuji.ng` |
   | `ADMIN_PASSWORD` | choose a strong password |

5. Click **Create Web Service**. Wait for deploy (~2 min).
6. Copy your backend URL → looks like `https://nuji-api.onrender.com`.
   - Test: open `https://nuji-api.onrender.com/api/leaderboard` → you should see `[]` ✅
   - First visit can take ~30 seconds (free plan wakes up).

---

## 3. Frontend — Vercel **or** Netlify (5 min)

**Option A — Vercel:**
1. **vercel.com** → **Add New → Project** → import the same GitHub repo.
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`, output `dist` (automatic).
3. **Environment Variables** → Add: `VITE_API_URL` = your Render URL from step 2.6 (e.g. `https://nuji-api.onrender.com`).
4. **Deploy**. (The included `vercel.json` makes `/admin` and all routes work.)

**Option B — Netlify:**
1. **netlify.com** → **Add new site → Import an existing project** → choose the repo.
2. Build command `npm run build`, publish directory `dist`.
3. Site settings → Environment variables → add `VITE_API_URL` = your Render URL → redeploy.
   (The included `public/_redirects` handles `/admin`.)

---

## 4. Test everything 🎉
1. Open your site URL.
2. Enter a phone number → create a profile → submit a contribution (type + record).
3. Open **`/admin`** → sign in with the ADMIN_EMAIL / ADMIN_PASSWORD you set on Render.
   - You'll see the dashboard: overview, submissions (approve/flag/reject, attach missing voice by recording or upload), contributors, prompt manager, analytics, annotation, WhatsApp digest.
4. Check **Leaderboard** and **State vs State** on the site — your data appears live.

---

## Notes
- **Voice quality control** is automatic: recordings under 3s, silent, or extremely noisy are rejected at submission.
- **Prompts are rationed:** each prompt shows to max 2 contributors, then rotates.
- **Data privacy:** only phone, state, LGA, age range, gender are stored; contributors can stay anonymous.
- **Cost:** all free tiers (Supabase free, Render free, Vercel/Netlify free) are enough to start.

Enjoy — you now own a complete voice-data platform for Nigerian languages. 🇳🇬
