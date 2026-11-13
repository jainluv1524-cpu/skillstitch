# SkillStitch

**Personalized project & skill-gap planner** — paste your skills, resume, or project experience, pick a target role, and get a tailored set of mini-projects that close your gaps.

![SkillStitch](https://img.shields.io/badge/status-phase%201-cyan) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Why

Most learning roadmaps are generic. SkillStitch makes the plan **personal**:

1. Extract known skills from free text (resume, bio, project notes).
2. Compare them against a target role profile.
3. Rank mini-projects by how well they fill the biggest gaps.

## Features (Phase 1)

- **Skill extraction** from free text using tokenization, alias normalization, and a curated skill taxonomy.
- **Role profiles** for Frontend, Backend, Full-Stack, and ML-aware Full-Stack paths.
- **Gap analysis**: matched skills vs. missing skills for the selected role.
- **Weighted project recommendations**: cosine-similarity-style scoring that prioritizes projects covering missing skills.
- **Actionable project cards** with steps and resource pointers.
- **Local history** of recent analyses and **Markdown roadmap export**.
- Clean, responsive dark UI with Tailwind CSS.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) |
| Language | TypeScript |
| UI | React + Tailwind CSS |
| API | Next.js Route Handler (`POST /api/analyze`) |
| "ML" | Lightweight NLP: tokenization, alias matching, weighted cosine similarity |

No external ML services or API keys are required for Phase 1.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

```bash
npm run dev      # start the dev server
npm run build    # production build
npm run start    # run the production build
npm run lint     # lint
npm run typecheck # type-check
npm test         # analyzer smoke test
```

## How it works

```
Free text ──► tokenize + normalize aliases ──► known-skill set
                                                   │
Target role ──► required skills ──► matched / missing gaps
                                                   │
                                                   ▼
                              weighted similarity scoring over project ideas
                                                   │
                                                   ▼
                                   ranked recommendations + next steps
```

The scoring is intentionally lightweight and explainable:

- `coverage` — how many of your missing skills a project covers (highest weight).
- `known` — how much of the project you can already build with current skills.
- `similarity` — cosine similarity between your skill vector and each project's skill vector.
- `focus` — how concentrated a project is on your gaps rather than unrelated skills.

## Project structure

```
src/
├── app/
│   ├── api/analyze/route.ts   # POST endpoint for analysis
│   ├── layout.tsx             # root layout + metadata
│   └── page.tsx               # interactive planner UI
└── lib/
    ├── analyzer.ts            # extraction, gap analysis, scoring
    └── skills.ts              # roles, projects, aliases, normalization
```

## Roadmap

- [x] Phase 1 — MVP: skill extraction, gap analysis, recommendations, history/export
- [ ] Phase 2 — Persistence & accounts: DB-backed profiles, saved roadmaps, progress tracking
- [ ] Phase 3 — Smarter matching: embeddings/classifier-based skill extraction and ranking
- [ ] Phase 4 — Imports: resume PDF and GitHub profile ingestion
- [ ] Phase 5 — Polish & deploy: tests, accessibility pass, CI, production deployment

## License

MIT
