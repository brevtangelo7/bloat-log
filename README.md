# Bloat Log 🌿

A multi-user food & bloating tracker. Log meals, track bloating severity, and visualise patterns over time.

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd bloat-log
npm install
```

### 2. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it.
3. After the schema runs, add your admin email:
   ```sql
   insert into public.admin_emails (email) values ('you@example.com');
   ```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → anon public key |
| `VITE_ADMIN_EMAIL` | The email you want as admin (must match what you inserted above) |
| `VITE_POSTHOG_KEY` | PostHog Dashboard → Project Settings → Project API Key (leave blank to disable analytics) |

### 4. Enable Magic Link auth in Supabase

In the Supabase Dashboard → **Authentication → Providers**, make sure **Email** is enabled and **"Confirm email"** is on (magic link mode is the default).

Set your **Site URL** under Authentication → URL Configuration to your deployed URL (or `http://localhost:5173` for local dev).

---

## Running locally

```bash
npm run dev
```

Opens at `http://localhost:5173`.

---

## Deploying to GitHub Pages

### One-time setup

```bash
npm install -g gh-pages   # if not already installed
```

Make sure your `package.json` `homepage` or `VITE_BASE_PATH` matches your repo path. For a repo at `github.com/YOU/bloat-log`:

```
VITE_BASE_PATH=/bloat-log/
```

Add that to your production environment or set it before building.

### Deploy

```bash
npm run deploy
```

This builds to `dist/` and pushes it to the `gh-pages` branch. GitHub Pages will serve it automatically.

Update your Supabase **Authentication → URL Configuration → Site URL** to your GitHub Pages URL (`https://YOU.github.io/bloat-log/`) and add it to the **Redirect URLs** list.

---

## Supabase schema (summary)

```sql
profiles (id, display_name, created_at, last_seen_at, is_disabled)
entries  (id, user_id, foods, severity, time_to_bloat, note, created_at)
admin_emails (email)
```

RLS is enabled on all tables. Users can only read/write their own rows. The admin email can read all rows. Full SQL is in `supabase/schema.sql`.

---

## Features

- **Magic link auth** — passwordless, no passwords to manage
- **Log tab** — foods, severity (Low/Med/High), time-to-bloat, notes. All fields optional.
- **History tab** — newest-first, inline edit (including timestamp), 2-step delete
- **Charts tab** — foods by severity, foods by speed, bloating over time
- **Export** — self-contained HTML report with charts
- **Settings** — display name, export, sign out, delete account
- **Admin dashboard** — user stats, DAU/WAU/MAU, per-user disable/enable
- **PWA** — installable, offline shell cache
- **localStorage migration** — first login imports old single-user data automatically
