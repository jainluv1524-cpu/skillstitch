# SkillStitch — Getting Started

## Overview

SkillStitch turns your skills and experience into a focused project roadmap — with optional local AI for deeper skill extraction, custom roles from job descriptions, and a week-by-week study plan.

**Default mode: anonymous**. No signup, no password. Just visit and start.

---

## 🚀 Quick Start (Local)

```bash
# 1. Clone / open the project
git clone <repo-url>
cd skillstitch

# 2. Install dependencies
npm install

# 3. Copy env config
cp .env.example .env

# 4. Fill in the blanks
#    - NEXTAUTH_SECRET: generate with `openssl rand -hex 32`
#    - NEXTAUTH_URL: http://localhost:3000 (or your domain)
#    - GITHUB_ID / GITHUB_SECRET: optional, for GitHub OAuth

# 5. Start the dev server
npm run dev
```

Open `http://localhost:3000` in your browser.

### What you'll see

- **Hero banner** — "Every skill. A clearer path."
- **Sidebar** — Navigation: Profile, Skill gaps, History, Projects, AI plan
- **Metrics row** — Skills detected, Role alignment, Skill gaps, Projects matched
- **Analysis form** — Paste skills, pick a target role, optional "Local AI" toggle
- **Results** — Extracted skills, matched strengths, skill gaps, recommended mini-projects
- **History panel** — Saved analyses in your anonymous session (cookie-backed, 1-year expiry)

### No login required

- Every visitor gets a `skillstitch_uid` cookie automatically
- Analyses are isolated per session cookie
- History persists for 1 year (or until you clear it)
- Optional: set `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` to enable "Sign in with GitHub"

---

## 🐳 Docker

### Build and run

```bash
# Build the image
docker build -t skillstitch .

# Run it
docker run -d -p 3000:3000 \
  -e SKILLSTITCH_DB_PATH=/data/skillstitch.db \
  -e NEXTAUTH_URL=http://localhost:3000 \
  --name skillstitch \
  skillstitch
```

Open `http://localhost:3000`.

### Dockerfile features

- **Multi-stage build** — `deps` → `builder` → `runner` (final image ~100 MB)
- **Non-root user** — `nextjs` user with `/data` volume for SQLite
- **HEALTHCHECK** — Verifies `/api/ai/status` every 30s (fails if app not responding)
- **Production-ready** — `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`

### docker-compose.yml

```yaml
services:
  skillstitch:
    build: .
    ports:
      - "3000:3000"
    environment:
      SKILLSTITCH_DB_PATH: /data/skillstitch.db
      # Optional GitHub OAuth:
      # GITHUB_ID: your-github-client-id
      # GITHUB_SECRET: your-github-client-secret
      # NEXTAUTH_SECRET: a-long-random-string
      # NEXTAUTH_URL: http://localhost:3000
    volumes:
      - skillstitch-data:/data
    restart: unless-stopped
```

### CI container smoke test (GitHub Actions)

The `.github/workflows/ci.yml` includes a step that builds the Docker image and validates the health endpoint:

```yaml
- name: Test built container (quick smoke)
  run: |
    docker build -t skillstitch-test .
    docker run -d -p 3000:3000 \
      -e SKILLSTITCH_DB_PATH=/data/skillstitch.db \
      -e NEXTAUTH_URL=http://localhost:3000 \
      --name skillstitch-container skillstitch-test
    sleep 10
    if curl -f http://localhost:3000/api/ai/status; then
      echo "Container health check PASSED"
    else
      echo "Container health check FAILED"
      docker logs skillstitch-container
      exit 1
    fi
    docker stop skillstitch-container
    docker rm skillstitch-container
    docker rmi skillstitch-test
```

### Environment variables (.env.example)

| Variable | Required? | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | ✅ | JWT signing key (≥32 chars). Generate: `openssl rand -hex 32` |
| `NEXTAUTH_URL` | ✅ | Base URL (`http://localhost:3000` or `https://yourdomain.com`) |
| `GITHUB_ID` | Optional | GitHub OAuth client ID |
| `GITHUB_SECRET` | Optional | GitHub OAuth client secret |
| `SKILLSTITCH_AI` | Optional | `on`/`off` (default: off) — enables local AI features |
| `OLLAMA_BASE_URL` | Optional | `http://127.0.0.1:11434` (default) |
| `OLLAMA_MODEL` | Optional | Model name (e.g. `gemma4:26b`) |
| `OLLAMA_TIMEOUT_MS` | Optional | `240000` (ms, default 240s) |
| `SKILLSTITCH_DB_PATH` | Optional | `./data/skillstitch.db` (default, relative to project root) |

---

## 📡 API Reference

### POST `/api/analyze`

Analyze skills text and return role recommendations.

**Request:**

```json
{
  "skillsText": "Built React and Next.js apps with TypeScript, REST APIs in Node.js, basic SQL.",
  "targetRole": "fullstack",     // preset: frontend, backend, fullstack, ml, custom
  "useAi": true,                 // optional — enables local AI extraction
  "jobDescription": "..."        // required if targetRole === "custom"
}
```

**Response:**

```json
{
  "targetRole": { "key": "fullstack", "label": "Full-Stack Developer" },
  "extractedSkills": ["react", "typescript", "node"],
  "matchedSkills": ["react", "typescript"],
  "missingSkills": ["node", "api"],
  "recommendations": [
    {
      "id": "auth-notes",
      "title": "Auth Notes App",
      "description": "A full-stack authentication system...",
      "score": 0.8231,
      "skills": ["nextjs", "typescript", "sql"],
      "covers": ["auth", "postgres"]
    }
    // ...up to 5 recommendations
  ],
  "embeddingSimilarity": 0.6325,   // ← new: semantic overlap (0–1)
  "ai": {
    "requested": true,
    "extraction": { "used": true, "model": "gemma4:26b", "addedSkills": ["scikit-learn"] },
    "role": { "used": false },
    "notices": ["+1 skill identified by local AI"]
  },
  "saved": { "id": "17-cl...", "createdAt": "2026-11-14T23:45:00Z" }
}
```

**Error responses:**

- `400` — Missing or invalid `skillsText`
- `413` — Input exceeds character limit
- `503` — Custom role needs `SKILLSTITCH_AI=on`; Ollama unreachable

---

### GET `/api/ai/status`

Check local AI availability.

**Response:**

```json
{
  "enabled": true,     // from SKILLSTITCH_AI env var
  "reachable": true,   // can connect to Ollama
  "modelAvailable": true,  // model is pulled and ready
  "model": "gemma4:26b",
  "baseUrl": "http://127.0.0.1:11434",
  "models": ["gemma4:26b", "llama3.2:3b"]
}
```

---

### POST `/api/ai/plan`

Generate a 4-week study plan based on analysis results.

**Request:**

```json
{
  "skillsText": "Built React and Next.js apps with TypeScript, REST APIs in Node.js, basic SQL.",
  "targetRole": "fullstack",
  "jobDescription": "..."  // optional, for custom roles
}
```

**Response:**

```json
{
  "plan": {
    "summary": "Four weeks to full-stack mastery",
    "weeks": [
      {
        "week": 1,
        "theme": "Foundations",
        "focus": ["typescript", "node"],
        "actions": ["Build a Todo API", "Set up SQLite"],
        "deliverable": "Schema and CRUD endpoints"
      }
      // ...weeks 2-4
    ],
    "rationale": [
      { "projectId": "auth-notes", "why": "Closes auth and postgres gaps" }
    ]
  },
  "model": "gemma4:26b"
}
```

---

### GET `/api/analyses`

List saved analyses for the current anonymous session.

---

### DELETE `/api/analyses`

Clear all saved analyses for the current session.

---

## 🤖 Local AI (Ollama)

SkillStitch can run **entirely on your machine** via [Ollama](https://ollama.ai/). No data leaves your computer.

### Requirements

1. [Install Ollama](https://ollama.ai/download) (macOS / Windows / Linux)
2. Pull a model: `ollama pull gemma4:26b` (or your preferred model)

### How to enable

```bash
# In .env
SKILLSTITCH_AI=on
# Or pass at runtime: SKILLSTITCH_AI=on npm run dev
```

### Features enabled

- **Skill extraction** — LLM extracts skills from your text, constrained to the known taxonomy
- **Custom role profiles** — Paste a job description → SkillStitch derives required skills + role label
- **4-week study plan** — AI generates a themed, actionable plan tailored to your gaps

### Notices you'll see

When local AI is used, the results panel shows:

- `"+2 skills identified by local AI"` — skills the LLM found that the rule-based extractor missed
- `"AI role profile"` — displayed when a custom role was derived from a job description

### AI is optional

- Toggle "Local AI" on/off in the UI
- When disabled, the rule-based extractor runs alone
- All existing functionality (role matching, project recommendations) works without AI

---

## 📦 Self-Hosted Walkthrough

### 1. Prerequisites

- [Node.js](https://nodejs.org/) 24+ (or your preferred LTS)
- [Docker](https://www.docker.com/) (optional, for containerized deployment)
- [Ollama](https://ollama.ai/) (optional, for local AI)
- [Git](https://git-scm.com/) (for cloning / versioning)

### 2. Clone and configure

```bash
git clone <repo-url>
cd skillstitch
cp .env.example .env
# Edit .env — at minimum: NEXTAUTH_SECRET, NEXTAUTH_URL
# Optional: GITHUB_ID, GITHUB_SECRET for OAuth
# Optional: SKILLSTITCH_AI=on for AI features
```

### 3. Start the app

**Development:**

```bash
npm run dev     # Turbopack, http://localhost:3000
```

**Production build:**

```bash
npm run build   # Creates .next/standalone
npm start       # Serves the production build
```

### 4. Docker (production)

```bash
docker build -t skillstitch .
docker run -d -p 3000:3000 \
  -e NEXTAUTH_URL=https://yourdomain.com \
  -e NEXTAUTH_SECRET=$(openssl rand -hex 32) \
  -e SKILLSTITCH_DB_PATH=/data/skillstitch.db \
  --name skillstitch \
  skillstitch
```

Health check: `docker inspect --format='{{.State.Health.Status}} skillstitch'`

### 5. HTTPS / Production

- Set `NEXTAUTH_URL` to your domain (e.g. `https://skillstitch.example.com`)
- `NEXTAUTH_SECRET` must be kept secret (never commit to repo)
- `GITHUB_ID`/`GITHUB_SECRET` from [GitHub OAuth](https://github.com/settings/developers)
- SQLite data persists at the path specified by `SKILLSTITCH_DB_PATH`
- HEALTHCHECK (`/api/ai/status`) works out-of-the-box in the Dockerfile

### 6. Maintenance

- **Clear history**: Visit the app and click "Clear" in the History section, or call `DELETE /api/analyses`
- **Rotate NEXTAUTH_SECRET** periodically (generate with `openssl rand -hex 32`)
- **Update Ollama models** as needed: `ollama pull <new-model>`

---

## 🛠 Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Page loads but "Checking local AI…" never resolves | Ollama not running | Start `ollama serve`, then `ollama pull <model>` |
| Analysis fails with "Invalid request" | Missing `skillsText` or empty input | Provide at least a few words of skills/text |
| "Custom roles need local AI" | `SKILLSTITCH_AI` not set to `on` | Set `SKILLSTITCH_AI=on` in `.env` |
| GitHub OAuth "Sign in with GitHub" doesn't appear | OAuth env vars not set | Set `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |
| History empty on return | Cookie cleared / private browsing | Analyses are cookie‑scoped; re-run an analysis to repopulate |
| Docker container crashes on start | Missing env vars or DB path issues | Check `docker logs skillstitch`; ensure `NEXTAUTH_URL` and `NEXTAUTH_SECRET` are set |

---

## 📦 Project Structure (high level)

```
src/
├── app/              # Next.js 16 App Router
│   ├── page.tsx      # Full dashboard UI
│   ├── api/          # API routes: /analyze, /ai/status, /ai/plan, /analyses
│   └── auth/         # Optional GitHub OAuth (route template)
├── lib/
│   ├── analyzer.ts   # Skill extraction + role matching + embedding similarity
│   ├── ai/           # Ollama client, config, cache, analysis prompts
│   ├── embeddings.ts # @xenova/transformers sentence transformers
│   ├── db.ts         # SQLite schema + queries
│   └── session.ts    # Anonymous cookie sessions (skillstitch_uid)
├── scripts/          # Smoke test runners
├── scripts/          # CI workflow
├── Dockerfile        # Multi-stage build + HEALTHCHECK
├── docker-compose.yml # Service orchestration
├── .env.example      # All environment variables with defaults
└── README.md         # High-level overview + no-license statement
```

---

## 🎯 Next steps after this tutorial

1. **Enable GitHub OAuth** — Set `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` and create the callback route
2. **Add embedding similarity display** — The UI can show `embeddingSimilarity` alongside the keyword score
3. **Multi-user persistence** — Replace SQLite with PostgreSQL for real user accounts
4. **Custom embeddings model** — Swap `Xenova/all-MiniLM-L6-v2` for a domain‑specific model

---

*SkillStitch · Phase 3 · Local AI · Nov 2026*