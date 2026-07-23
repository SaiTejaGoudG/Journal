# Deploying to Vercel

## What changed

| Before | After |
|--------|-------|
| CRA (`react-scripts`) frontend | Next.js 15 App Router |
| Python FastAPI backend | Next.js API Route Handlers (`app/api/`) |
| `react-router-dom` | `next/navigation` + file-system routing |
| Separate frontend & backend processes | Single Next.js app — one Vercel project |
| WebSocket real-time sync | No-op shim (app works fine without cross-tab sync) |
| `emergentintegrations` LLM lib | OpenAI SDK directly |

---

## 1 — Prerequisites

- Node.js ≥ 18
- A [MongoDB Atlas](https://cloud.mongodb.com) cluster (free M0 is fine)
- An [OpenAI API key](https://platform.openai.com/api-keys) (optional — only for AI features)

---

## 2 — Local development

```bash
cd nextjs-app

# 1. Install dependencies
npm install

# 2. Copy env template and fill in your values
cp .env.local.example .env.local
# Edit .env.local — at minimum set MONGO_URL, DB_NAME, JWT_SECRET

# 3. Run dev server
npm run dev
# → http://localhost:3000
```

### Required `.env.local` values

```
MONGO_URL=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=personal_knowledge_management
JWT_SECRET=<generate with: openssl rand -hex 32>

# Optional — enables AI summarise / expand / transcribe
OPENAI_API_KEY=sk-...

# Optional — admin seed account (created automatically on first login)
ADMIN_EMAIL=admin@yourapp.com
ADMIN_PASSWORD=YourStrongPassword!
```

> **MongoDB Atlas network access:** whitelist `0.0.0.0/0` (allow from anywhere) so Vercel's
> dynamic IPs can reach your cluster. You can tighten this later with
> [Vercel's static IPs add-on](https://vercel.com/docs/security/deployment-protection/methods-to-protect-deployments/ip-allowlisting).

---

## 3 — Deploy to Vercel

### Option A — Vercel CLI (fastest)

```bash
npm i -g vercel
cd nextjs-app
vercel

# Follow the prompts, then set env vars:
vercel env add MONGO_URL
vercel env add DB_NAME
vercel env add JWT_SECRET
vercel env add OPENAI_API_KEY   # optional

# Redeploy to pick up the env vars
vercel --prod
```

### Option B — Vercel Dashboard (GitHub)

1. Push the repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository**.
3. Set **Root Directory** to `nextjs-app`.
4. Add all env vars under **Settings → Environment Variables**.
5. Click **Deploy** — Vercel detects Next.js automatically.

---

## 4 — Project structure

```
nextjs-app/
├── app/
│   ├── layout.tsx          ← root HTML shell + providers
│   ├── providers.tsx        ← AuthProvider + ThemeProvider
│   ├── page.tsx             ← / → redirects to /dashboard or /auth
│   ├── auth/page.tsx
│   ├── dashboard/page.tsx
│   ├── notes/
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── search/page.tsx
│   ├── collections/page.tsx
│   ├── favorites/page.tsx
│   ├── daily-dump/page.tsx
│   ├── settings/page.tsx
│   ├── shared/[token]/page.tsx
│   └── api/                ← all backend logic lives here
│       ├── auth/{register,login,logout,me}/route.ts
│       ├── notes/route.ts + [noteId]/{favorite,pin,archive,share,related,export}/route.ts
│       ├── categories/route.ts + subcategory/route.ts
│       ├── tags/route.ts
│       ├── collections/route.ts + [collId]/route.ts
│       ├── ai/{action,transcribe}/route.ts
│       ├── images/upload/route.ts
│       ├── stats/route.ts
│       └── public/notes/[token]/route.ts
├── views/          ← original React page components (adapted)
├── components/     ← Layout, Sidebar, NoteCard, shadcn/ui
├── contexts/       ← AuthContext, ThemeContext
├── hooks/          ← useWebSocket (no-op), use-toast
├── lib/
│   ├── db.ts       ← MongoDB connection pool
│   ├── auth.ts     ← JWT helpers (jose), bcrypt, seedAdmin
│   └── utils.ts    ← cn(), docToDict()
└── services/
    ├── api.js      ← axios client pointing to /api
    └── offlineSync.js  ← no-op stubs
```

---

## 5 — Known differences from the original

| Feature | Status |
|---------|--------|
| All CRUD, auth, AI, collections, tags | ✅ Fully ported |
| Shared note public links | ✅ Works |
| Image upload (base64 in MongoDB) | ✅ Works |
| Audio transcription (Whisper) | ✅ Works (requires `OPENAI_API_KEY`) |
| Real-time cross-tab WebSocket sync | ⚠️ Removed — Vercel serverless doesn't support persistent WS. Notes still update instantly within the same tab. |
| Offline sync / service worker | ⚠️ Removed (CRA-specific). Replaced with no-op stubs. |
| Admin seed on startup | ✅ Runs automatically on the first `/api/auth/login` call |

---

## 6 — Troubleshooting

**`MongoServerError: bad auth`** — double-check `MONGO_URL` includes the correct username/password and the DB user has `readWrite` permissions.

**`401 Not authenticated` on all requests** — make sure `JWT_SECRET` is set in Vercel env vars and is the same value you used locally.

**Build error `Cannot find module '@/views/...'`** — run `npm install` inside `nextjs-app/` first.

**AI features return 500** — set `OPENAI_API_KEY` in your Vercel project's environment variables.
