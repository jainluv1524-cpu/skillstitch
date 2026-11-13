# SkillStitch — API Reference

This document describes all public endpoints, request/response formats, and error handling for SkillStitch.

## Base URL

**Development:** `http://localhost:3000`
**Production:** Your deployed domain (e.g. `https://skillstitch.example.com`)

All endpoints are under the same origin as the app.

---

## Endpoints

### POST `/api/analyze`

Analyze a user's skills text against target roles and return recommendations.

#### Request

| Field | Type | Required | Description |
|---|---|---|---|
| `skillsText` | `string` | ✅ | User's skills, resume text, or project experience |
| `targetRole` | `string` | ✅ | Preset role key, or `"custom"` | 
| `useAi` | `boolean` | ❌ | Enable local AI skill extraction (default: `false`) |
| `jobDescription` | `string` | ⚠️ | Required if `targetRole === "custom"` |

**Preset role keys:** `frontend`, `backend`, `fullstack`, `ml`, `custom`

#### Example requests

```bash
# Analyze with preset role (no AI)
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"skillsText":"Built React apps with TypeScript and Node.js","targetRole":"fullstack"}'

# Analyze with local AI
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"skillsText":"Built React apps with TypeScript and Node.js","targetRole":"fullstack","useAi":true}'

# Custom role from job description
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"skillsText":"React, TypeScript, SQL","targetRole":"custom","jobDescription":"Software Engineer - React, Node, PostgreSQL experience required"}'
```

#### Response (200)

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
      "description": "A full-stack authentication system with JWT and OAuth.",
      "score": 0.8231,
      "skills": ["nextjs", "typescript", "sql"],
      "covers": ["auth", "postgres"]
    }
    // ...up to 5 recommendations, sorted by score
  ],
  "embeddingSimilarity": 0.6325,   // cosine similarity 0–1
  "ai": {
    "requested": true,
    "extraction": {
      "used": true,
      "model": "gemma4:26b",
      "addedSkills": ["scikit-learn"]
    },
    "role": { "used": false },
    "notices": ["+1 skill identified by local AI"]
  },
  "saved": {
    "id": "17-cl-hgk4s2",
    "createdAt": "2026-11-14T23:45:00Z"
  }
}
```

#### Error responses

| Status | Meaning |
|---|---|
| `400` | Missing `skillsText`, or `skillsText` exceeds `MAX_INPUT_LENGTH` (20_000) |
| `413` | `jobDescription` exceeds `MAX_JD_LENGTH` (8_000) |
| `503` | Custom role requested but `SKILLSTITCH_AI` is not `on`, or Ollama is unreachable |

---

### GET `/api/ai/status`

Check local AI (Ollama) availability.

#### Response (200)

```json
{
  "enabled": true,          // SKILLSTITCH_AI env var
  "reachable": true,        // can connect to Ollama at OLLAMA_BASE_URL
  "modelAvailable": true,   // the configured OLLAMA_MODEL is pulled and ready
  "model": "gemma4:26b",    // currently loaded model
  "baseUrl": "http://127.0.0.1:11434",
  "models": ["gemma4:26b", "llama3.2:3b"]  // all models pulled on this host
}
```

#### Notes

- `enabled` reflects the `SKILLSTITCH_AI` environment variable
- `reachable` = network connectivity to Ollama
- `modelAvailable` = the specific model is registered with Ollama
- If any field is `false`, the UI will disable AI features and show appropriate messaging

---

### POST `/api/ai/plan`

Generate a 4-week study plan based on analysis results.

#### Request

```json
{
  "skillsText": "Built React and Next.js apps with TypeScript, REST APIs in Node.js, basic SQL.",
  "targetRole": "fullstack",
  "jobDescription": "..."  // optional, for custom role derivation
}
```

#### Response (200)

```json
{
  "plan": {
    "summary": "Four weeks to full-stack mastery",
    "weeks": [
      {
        "week": 1,
        "theme": "Foundations",
        "focus": ["typescript", "node"],
        "actions": ["Build a Todo API", "Set up SQLite schema"],
        "deliverable": "CRUD API with authentication"
      },
      {
        "week": 2,
        "theme": "Backend Services",
        "focus": ["sql", "auth"],
        "actions": ["Model data", "Implement JWT auth"],
        "deliverable": "Secure API endpoints"
      },
      {
        "week": 3,
        "theme": "Frontend Integration",
        "focus": ["react", "nextjs"],
        "actions": ["Build user dashboard", "Add routing"],
        "deliverable": "Deployed Next.js app"
      },
      {
        "week": 4,
        "theme": "Capstone Project",
        "focus": ["full-cycle", "deployment"],
        "actions": ["Portfolio site", "CI/CD setup"],
        "deliverable": "Live portfolio with custom domain"
      }
    ],
    "rationale": [
      { "projectId": "auth-notes", "why": "Closes auth and postgres gaps" },
      { "projectId": "react-calendar", "why": "Reinforces React state skills" }
    ]
  },
  "model": "gemma4:26b"
}
```

#### Error responses

- `503` — Local AI disabled or unreachable
- `400` — Missing required fields

---

### GET `/api/analyses`

List saved analyses for the current anonymous session.

#### Response (200)

```json
{
  "analyses": [
    {
      "id": "17-cl-hgk4s2",
      "createdAt": "2026-11-14T22:18:33Z",
      "skillsText": "React, TypeScript, Node.js, SQL",
      "targetRole": "fullstack",
      "matchedSkills": ["react", "typescript"],
      "missingSkills": ["node", "api"],
      "recommendationCount": 5
    }
  ]
}
```

#### Notes

- Returns analyses stored in the SQLite database under the current session's `skillstitch_uid` cookie
- Maximum of 10 analyses kept (oldest auto‑deleted)

---

### DELETE `/api/analyses`

Clear all saved analyses for the current session.

#### Response (200)

```json
{ "deleted": 3 }  // number of analyses removed
```

#### Notes

- Best‑effort operation; the local in‑memory history is also cleared
- Use with caution — this cannot be undone

---

## Query Parameters (none currently defined)

All endpoints use JSON body (POST) or return JSON (GET). No query parameters are required.

---

## Error Handling

All endpoints return JSON error responses on failure:

```json
{ "error": "Human‑readable description of what went wrong" }
```

The HTTP status code corresponds to the error type:

- `400` — Bad request (missing fields, validation failure)
- `413` — Payload too large
- `503` — Service unavailable (AI disabled, Ollama unreachable, custom role without AI)

---

## Authentication

SkillStitch uses **anonymous cookie sessions** by default. No auth token is required for any endpoint.

**Optional GitHub OAuth:** When `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are set, a `skillstitch_uid` JWT session is created after successful sign-in. The `getUserId()` helper (in `src/lib/session.ts`) returns the user ID from the session, or `null` for anonymous visitors.

Session‑scoped endpoints (`/api/analyses`, `DELETE /api/analyses`) associate data with the current `skillstitch_uid` cookie.

---

## Rate Limiting

No explicit rate limiting is enforced at the framework level. The API is designed for per‑user interaction (one analysis at a time per session cookie). If deploying at scale, consider adding a reverse‑proxy rate limiter (e.g., NGINX, Cloudflare).

---

## Versioning

The API is currently at version **v1** (no explicit version segment in URLs). Backward‑incompatible changes will be documented in future updates. The CI pipeline includes a container smoke test that validates the `/api/ai/status` health endpoint after each build.