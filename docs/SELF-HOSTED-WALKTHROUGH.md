# SkillStitch — Self-Hosted Walkthrough

This guide walks through deploying SkillStitch from scratch, from local development to production Docker hosting.

## 📋 Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| **Node.js** | 24+ | Run the Next.js app locally |
| **npm / pnpm** | 10+ | Install dependencies |
| **Docker** | 27+ | Containerized production deployment |
| **Ollama** | Optional | Local AI (skill extraction, custom roles, study plans) |
| **Git** | Any | Clone the repository |
| **SQLite** | Built‑in | Local data persistence (no separate server needed) |

## 🛠 Step 1: Clone & Configure

```bash
# 1. Clone the repository
git clone <repo-url>
cd skillstitch

# 2. Install dependencies
npm install  # or: pnpm install

# 3. Copy environment config
cp .env.example .env

# 4. Edit .env — at minimum, fill these in:
#    NEXTAUTH_SECRET=replace-with-a-long-random-string
#    NEXTAUTH_URL=http://localhost:3000   # or your domain

# Optional for GitHub OAuth:
#    GITHUB_ID=your-github-client-id
#    GITHUB_SECRET=your-github-client-secret

# Optional for Local AI:
#    SKILLSTITCH_AI=on
#    OLLAMA_BASE_URL=http://127.0.0.1:11434
#    OLLAMA_MODEL=gemma4:26b
```

## ▶️ Step 2: Run Locally (Development)

```bash
npm run dev
```

- Opens `http://localhost:3000` in your browser
- Anonymous cookie session (`skillstitch_uid`) is set automatically
- No login, no signup required
- Try pasting skills and selecting a target role

### Verify it works

1. Paste: `"Built React and Next.js apps with TypeScript, REST APIs in Node.js, basic SQL."`
2. Select role: `fullstack`
3. Click **Analyze & recommend**
4. See extracted skills, matched/gaps, and project recommendations
5. Check the History sidebar — your analysis is saved to the anonymous session

### Stop dev server

`Ctrl+C` in the terminal.

## 📦 Step 3: Production Build (without Docker)

```bash
npm run build   # creates .next/standalone directory
npm start       # serves the production build on port 3000
```

- `npm run build` uses Turbopack for fast compilation
- `npm start` runs the Node.js production server
- Set `NODE_ENV=production` automatically (via `.env`)

### For systemd / PM2

```bash
# Using PM2
pm2 start npm -- run start
# Using systemd
# (create a service file pointing to the project)
```

## 🐳 Step 4: Docker Deployment

### 4.1 Build the image

```bash
docker build -t skillstitch .
```

### 4.2 Run the container

```bash
docker run -d -p 3000:3000 \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NEXTAUTH_SECRET=$(openssl rand -hex 32) \
  -e SKILLSTITCH_DB_PATH=/data/skillstitch.db \
  --name skillstitch \
  skillstitch
```

### 4.3 Verify it's running

```bash
# Check health endpoint
curl -f http://localhost:3000/api/ai/status && echo "✅ Healthy"

# Open in browser
open http://localhost:3000
```

### 4.4 Docker Compose (recommended)

```bash
docker-compose up -d
```

Or via `docker compose` (v2):

```bash
docker compose up -d
```

### 4.5 Custom domain (HTTPS)

```bash
# In .env or Docker run
-e NEXTAUTH_URL=https://skillstitch.example.com \
-e NEXTAUTH_SECRET=$(openssl rand -hex 32)

# Behind a reverse proxy (NGINX, Cloudflare, etc.)
#   - Terminate TLS at the proxy
#   - Forward HTTP::3000 to the container
#   - Set X-Forwarded-Proto, X-Forwarded-Host headers
```

### 4.6 Volume persistence (SQLite data)

```bash
# The docker-compose.yml already defines:
volumes:
  - skillstitch-data:/data

# This persists the SQLite database across container restarts.
# To reset: rm -rf the named volume or stop the container
```

### 4.7 Restart policy

The `docker-compose.yml` includes `restart: unless-stopped`, so the container will auto‑restart after reboots or crashes (unless explicitly stopped).

### 4.8 Health checks

The Dockerfile includes:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/ai/status || exit 1
```

- Checks every 30 seconds that `/api/ai/status` responds
- Fails (exit 1) if the app doesn't respond within 5 seconds
- 3 retries after a 5‑second start period
- Visible in `docker inspect --format='{{.State.Health.Status}} skillstitch'`

GitHub Actions CI also runs a container smoke test (see `.github/workflows/ci.yml`).

## 🤖 Step 5: Enable Local AI (Ollama)

### 5.1 Install Ollama

Follow the official guide: <https://ollama.ai/download>

### 5.2 Pull a model

```bash
ollama serve              # start the Ollama server
ollama pull gemma4:26b   # download the recommended model
# Or: ollama pull llama3.2:3b
```

### 5.3 Enable in SkillStitch

```bash
# In .env
SKILLSTITCH_AI=on

# Or pass at runtime:
SKILLSTITCH_AI=on npm run dev
```

### 5.4 What opens up

| Feature | What it does |
|---|---|
| **Skill extraction** | LLM extracts skills from your text, constrained to the known taxonomy; "added skills" appear with `"+N skills identified by local AI"` notices |
| **Custom role profiles** | Paste a job description → SkillStitch derives required skills + role label |
| **4‑week study plan** | AI generates a themed, actionable plan tailored to your skill gaps |

### 5.5 UI changes when AI is on

- The "Local AI" toggle becomes interactive
- Metrics show `"+N skills identified by local AI"` when applicable
- "AI role profile" badge appears when a custom role is derived
- The AI plan generator becomes available

### 5.6 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Checking local AI…" never resolves | Ollama not running | `ollama serve` |
| Model not found | Model not pulled | `ollama pull <model>` |
| "Custom roles need local AI" | `SKILLSTITCH_AI` not `on` | Set `SKILLSTITCH_AI=on` in `.env` |
| Analysis fails with connection error | Ollama port blocked | Ensure `OLLAMA_BASE_URL` reachable; check firewall |

## 🛡 Step 6: GitHub OAuth (optional)

If you want "Sign in with GitHub" instead of anonymous sessions:

### 6.1 Create OAuth app

1. Go to <https://github.com/settings/developers>
2. Click **OAuth Apps** → **Register a new application**
3. **Application name:** `SkillStitch`
4. **Homepage URL:** `http://localhost:3000` (or your domain)
5. **Authorization callback URL:** `http://localhost:3000/api/auth/signin` (or your domain + `/api/auth/signin`)

### 6.2 Fill env vars

```env
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret
NEXTAUTH_SECRET=a-long-random-string  # generate: openssl rand -hex 32
NEXTAUTH_URL=http://localhost:3000    # must match homepage URL
```

### 6.3 Create the auth callback route

The route template already exists at `src/app/api/auth/[...nextauth]/route.ts`. Ensure it's present and the env vars are set. After sign‑in, a JWT session is created and `getUserId()` returns the GitHub user ID.

### 6.4 What changes

- A "Sign in with GitHub" button appears in the UI
- After OAuth, `getUserId()` returns the GitHub user's ID (e.g. `"U01234ABCD"`)
- History and analyses are now associated with the GitHub account (JWT session) instead of the anonymous cookie
- The `skillstitch_uid` cookie is still set as a fallback, but the primary identity is the JWT

### 6.5 Reverting to anonymous

To go back to anonymous-only:

```env
# Comment out or remove:
# GITHUB_ID=...
# GITHUB_SECRET=...

# The app falls back to anonymous cookie sessions automatically.
```

## 📈 Step 7: Maintenance & Operations

### 7.1 Rotate NEXTAUTH_SECRET

```bash
openssl rand -hex 32
# Then set in .env and restart the container
```

### 7.2 Clear saved analyses

```bash
# Via the UI: Click "Clear" in the History section
# Or API: curl -X DELETE http://localhost:3000/api/analyses
```

### 7.3 Update Ollama models

```bash
ollama pull llama3.2:3b   # add new model
# No code change needed — SkillStitch detects available models automatically
```

### 7.4 Backup SQLite data

```bash
# If using Docker volume backup:
docker cp skillstitch:/data/skillstitch.db ./backup/skillstitch.db

# Or if using a mounted host path:
cp /path/to/skillstitch.db ./backup/
```

### 7.5 Logs

```bash
# Docker
docker logs skillstitch

# Local Node.js
npm run dev   # shows console output
# Or: tail -f .next/standalone/.logs/... (production)
```

### 7.6 Scale considerations

- SQLite is fine for single‑instance, low‑traffic deployments
- For multi‑tenant or high‑traffic, consider PostgreSQL (replace `src/lib/db.ts`)
- The app is designed to be swap‑friendly — the DB layer uses a small API surface

---

## 🎯 Quick Checklist

### Local development ✅

- [ ] `npm install` completed
- [ ] `.env` has `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
- [ ] `npm run dev` starts without errors
- [ ] App opens at `http://localhost:3000`
- [ ] Anonymous session works (no login required)
- [ ] Analysis produces recommendations
- [ ] History saves to cookie

### Docker ✅

- [ ] `docker build -t skillstitch .` succeeds
- [ ] `docker run -d -p 3000:3000` starts the container
- [ ] `curl http://localhost:3000/api/ai/status` returns healthy JSON
- [ ] Health check passes (`docker inspect`)
- [ ] `docker compose up -d` works (if using compose)

### Local AI (Ollama) ✅

- [ ] Ollama installed and running
- [ ] `ollama pull gemma4:26b` (or your model)
- [ ] `SKILLSTITCH_AI=on` in `.env`
- [ ] Analysis with `useAi: true` extracts AI‑identified skills
- [ ] Custom role from job description works
- [ ] 4‑week plan generates

### GitHub OAuth (optional) ✅

- [ ] OAuth app registered at GitHub
- [ ] `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` set
- [ ] Auth callback route present at `src/app/api/auth/[...nextauth]/route.ts`
- [ ] "Sign in with GitHub" button appears
- [ ] After sign‑in, `getUserId()` returns GitHub user ID

### Documentation ✅

- [ ] `docs/GETTING-STARTED.md` written
- [ ] `docs/API-REFERENCE.md` written
- [ ] `docs/SELF-HOSTED-WALKTHROUGH.md` written
- [ ] Screenshot in `docs/screenshot.png` updated (optional)

---

## 📞 Need Help?

- **Issues:** Check the troubleshooting tables in this doc
- **Discussions:** Start a thread in the project's discussion area
- **Ollama:** <https://ollama.ai/docs>
- **Next.js:** <https://nextjs.org/docs>

*Document generated for SkillStitch Nov 2026 release. For the latest version, check the repo's `docs/` directory.*