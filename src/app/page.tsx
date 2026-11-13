"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type Recommendation = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  steps: string[];
  resources: string[];
  score: number;
  covers: string[];
};

type AnalysisResult = {
  targetRole: { key: string; label: string } | null;
  extractedSkills: string[];
  requiredSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  recommendations: Recommendation[];
};

type HistoryEntry = {
  id: string;
  createdAt: string;
  skillsText: string;
  targetRole: string;
  result: AnalysisResult;
};

type GlyphKind =
  | "compass"
  | "gauge"
  | "clock"
  | "layers"
  | "spark"
  | "search"
  | "bell"
  | "arrow";

const GLYPHS: Record<GlyphKind, ReactNode> = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.2 5.3-5.3 2.2 2.2-5.3 5.3-2.2Z" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 14a8 8 0 1 1 16 0" />
      <path d="m12 14 4-4" />
      <path d="M4 18h16" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m5.6 5.6 2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
};

function Glyph({ kind, className = "h-4 w-4" }: { kind: GlyphKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {GLYPHS[kind]}
    </svg>
  );
}

const ROLES = [
  { key: "frontend", label: "Frontend Developer" },
  { key: "backend", label: "Backend Developer" },
  { key: "fullstack", label: "Full-Stack Developer" },
  { key: "ml", label: "ML-Aware Full-Stack Developer" },
];

const NAV_ITEMS: Array<{ href: string; label: string; glyph: GlyphKind }> = [
  { href: "#planner", label: "Planner", glyph: "compass" },
  { href: "#gaps", label: "Skill gaps", glyph: "gauge" },
  { href: "#history", label: "History", glyph: "clock" },
  { href: "#projects", label: "Projects", glyph: "layers" },
];

const MAX_HISTORY = 10;

export default function Home() {
  const [skillsText, setSkillsText] = useState("");
  const [targetRole, setTargetRole] = useState("fullstack");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analyses")
      .then((res) => res.json())
      .then((data: { analyses?: HistoryEntry[] }) => {
        if (!cancelled && Array.isArray(data.analyses)) setHistory(data.analyses);
      })
      .catch(() => {
        // History is optional; the planner still works without it.
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!skillsText.trim()) {
      setError("Add your skills, resume text, or project experience first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillsText, targetRole }),
      });
      const data = (await res.json()) as AnalysisResult & {
        error?: string;
        saved?: { id: string; createdAt: string };
      };
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
      if (data.saved) {
        const entry: HistoryEntry = {
          id: data.saved.id,
          createdAt: data.saved.createdAt,
          skillsText,
          targetRole,
          result: data,
        };
        setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function restoreHistory(entry: HistoryEntry) {
    setSkillsText(entry.skillsText);
    setTargetRole(entry.targetRole);
    setResult(entry.result);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function clearHistory() {
    setHistory([]);
    try {
      await fetch("/api/analyses", { method: "DELETE" });
    } catch {
      // best-effort; the local list is already cleared
    }
  }

  function exportRoadmap() {
    if (!result) return;
    const role = result.targetRole?.label ?? "Custom role";
    const lines: string[] = [
      "# SkillStitch Roadmap",
      "",
      `**Target role:** ${role}`,
      `**Generated:** ${new Date().toLocaleString()}`,
      "",
      "## Extracted skills",
      result.extractedSkills.length
        ? result.extractedSkills.map((s) => `- ${s}`).join("\n")
        : "_None detected_",
      "",
      "## Matched skills",
      result.matchedSkills.length
        ? result.matchedSkills.map((s) => `- ${s}`).join("\n")
        : "_None_",
      "",
      "## Skill gaps",
      result.missingSkills.length
        ? result.missingSkills.map((s) => `- ${s}`).join("\n")
        : "_No major gaps_",
      "",
      "## Recommended projects",
    ];

    result.recommendations.forEach((p, i) => {
      lines.push(
        "",
        `### ${i + 1}. ${p.title}`,
        `_Score: ${p.score} · Skills: ${p.skills.join(", ")}_`,
        "",
        p.description,
        "",
        p.covers.length
          ? `**Covers gaps:** ${p.covers.join(", ")}`
          : "**Reinforces existing skills**",
        "",
        "**Steps:**",
        ...p.steps.map((s) => `1. ${s}`),
        "",
        `**Resources:** ${p.resources.join(" · ")}`
      );
    });

    lines.push("", "---", "", "Generated with SkillStitch.");
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skillstitch-roadmap-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredRecommendations =
    result?.recommendations.filter((p) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.skills.some((s) => s.toLowerCase().includes(q))
      );
    }) ?? [];

  const metrics = [
    {
      label: "Skills detected",
      value: result ? String(result.extractedSkills.length) : "—",
      sub: "from your profile",
      glyph: "spark" as GlyphKind,
    },
    {
      label: "Role alignment",
      value: result
        ? `${result.matchedSkills.length}/${result.requiredSkills.length}`
        : "—",
      sub: result?.targetRole?.label ?? "choose a target role",
      glyph: "gauge" as GlyphKind,
    },
    {
      label: "Skill gaps",
      value: result ? String(result.missingSkills.length) : "—",
      sub: "focus areas to grow",
      glyph: "layers" as GlyphKind,
    },
    {
      label: "Projects matched",
      value: result ? String(result.recommendations.length) : "—",
      sub: "tailored next builds",
      glyph: "compass" as GlyphKind,
    },
  ];

  return (
    <div className="flex min-h-screen bg-cream">
      <aside className="topo sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col bg-maroon px-5 py-7 text-cream md:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/30">
            <Glyph kind="spark" className="h-4 w-4" />
          </div>
          <div>
            <p className="font-serif text-lg tracking-[0.18em]">SKILLSTITCH</p>
            <p className="text-[9px] uppercase tracking-[0.28em] text-cream/50">
              Skills at the edge
            </p>
          </div>
        </div>

        <nav className="mt-10 space-y-1.5 text-sm">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-cream/70 transition hover:bg-cream/5 hover:text-cream"
            >
              <Glyph kind={item.glyph} className="h-4 w-4 text-cream/45 transition group-hover:text-cream" />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="mt-auto space-y-4 border-t border-cream/15 pt-5 text-[9px] uppercase tracking-[0.24em] text-cream/40">
          <p>
            Intelligence
            <br />
            in reality
          </p>
          <p>v0.2.0 · Node.js</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_right,rgba(165,79,96,0.06),transparent_38%)]">
        <header className="sticky top-0 z-20 border-b border-line bg-cream/85 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 md:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-maroon text-cream">
                <Glyph kind="spark" className="h-4 w-4" />
              </div>
              <span className="font-serif text-lg tracking-[0.16em]">SKILLSTITCH</span>
            </div>

            <div className="hidden md:block">
              <p className="font-serif text-2xl text-ink">Good morning.</p>
              <p className="text-sm text-muted">Paste your skills. Find your next build.</p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <label className="relative hidden sm:block">
                <span className="sr-only">Search projects</span>
                <Glyph
                  kind="search"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects, roles..."
                  className="h-10 w-52 rounded-full border border-line bg-cream-soft pl-9 pr-4 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-rose/50 focus:ring-2 focus:ring-rose/15"
                />
              </label>

              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-cream-soft text-muted transition hover:text-maroon"
                aria-label="Notifications"
              >
                <Glyph kind="bell" className="h-4 w-4" />
                <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-rose" />
              </button>

              <div className="flex items-center gap-2 rounded-full border border-line bg-cream-soft py-1 pl-1 pr-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-maroon font-serif text-sm text-cream">
                  S
                </span>
                <span className="hidden text-sm text-ink sm:block">Local session</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-2xl bg-maroon text-cream">
            <div className="topo absolute inset-0 opacity-60" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_38%,rgba(244,207,180,0.28),transparent_24%),radial-gradient(circle_at_88%_52%,rgba(165,79,96,0.45),transparent_42%)]" />
            <div className="absolute right-10 top-1/2 hidden h-44 w-44 -translate-y-1/2 rounded-full border border-cream/20 bg-[radial-gradient(circle_at_35%_30%,#f5d9c2,#a54f60_42%,#3a0d18_78%)] shadow-[0_0_90px_rgba(240,180,150,0.35)] sm:block" />
            <svg
              className="absolute bottom-0 right-0 h-24 w-2/3 text-maroon-deep/70"
              viewBox="0 0 600 120"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 100 C80 70 140 95 210 72 C280 49 330 82 400 58 C470 34 520 64 600 42 L600 120 L0 120 Z"
                fill="currentColor"
              />
            </svg>

            <div className="relative px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
              <p className="text-[10px] uppercase tracking-[0.32em] text-cream/60">
                SkillStitch · Phase 2
              </p>
              <h1 className="mt-4 max-w-xl font-serif text-3xl leading-tight sm:text-4xl lg:text-5xl">
                Every skill. A clearer path.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-cream/75 sm:text-base">
                Turn your experience into a focused project roadmap — with light NLP
                matching and a clear view of what to build next.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.22em] text-cream/50">
                <a href="#planner" className="transition hover:text-cream">
                  Profile
                </a>
                <a href="#gaps" className="transition hover:text-cream">
                  Skill gaps
                </a>
                <a href="#history" className="transition hover:text-cream">
                  History
                </a>
                <a href="#projects" className="transition hover:text-cream">
                  Projects
                </a>
                <span className="ml-auto hidden text-cream/35 sm:inline">
                  Observe · Understand · Build
                </span>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-cream-soft px-4 py-4 shadow-[0_1px_0_rgba(42,25,22,0.04)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-maroon/5 text-maroon">
                    <Glyph kind={metric.glyph} className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                      {metric.label}
                    </p>
                    <p className="mt-0.5 font-serif text-2xl leading-none text-ink">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">{metric.sub}</p>
                  </div>
                </div>
                <Glyph
                  kind="arrow"
                  className="h-4 w-4 text-muted/40 transition group-hover:translate-x-0.5 group-hover:text-maroon"
                />
              </div>
            ))}
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <form
              id="planner"
              onSubmit={onAnalyze}
              className="scroll-mt-24 rounded-2xl border border-line bg-cream-soft p-5 shadow-[0_1px_0_rgba(42,25,22,0.04)] sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                    Your profile
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-ink">
                    Build your next roadmap
                  </h2>
                </div>
                <span className="rounded-full border border-line bg-cream px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted">
                  Step 01
                </span>
              </div>

              <label
                htmlFor="skills"
                className="mt-5 block text-sm font-medium text-ink"
              >
                Your skills / resume / project experience
              </label>
              <textarea
                id="skills"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                rows={9}
                placeholder="e.g. Built React and Next.js apps with TypeScript, REST APIs in Node.js, basic SQL. Used Git and wrote some unit tests..."
                className="mt-2 w-full rounded-xl border border-line bg-cream p-3.5 text-sm text-ink outline-none ring-rose/20 placeholder:text-muted/60 focus:border-rose/60 focus:ring-2"
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label
                    htmlFor="role"
                    className="mb-2 block text-sm font-medium text-ink"
                  >
                    Target role
                  </label>
                  <select
                    id="role"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full rounded-xl border border-line bg-cream p-2.5 text-sm text-ink outline-none ring-rose/20 focus:border-rose/60 focus:ring-2"
                  >
                    {ROLES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading || !skillsText.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-maroon px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-maroon-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Analyzing..." : "Analyze & recommend"}
                  <Glyph kind="arrow" className="h-4 w-4" />
                </button>
              </div>

              {error && (
                <p className="mt-3 rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose">
                  {error}
                </p>
              )}

              <p className="mt-4 text-xs leading-5 text-muted">
                How it works: keyword/NLP-style extraction identifies known skills,
                compares them against the target role, then a weighted similarity score
                ranks projects that best fill your gaps.
              </p>
            </form>

            <div className="space-y-4">
              <div
                id="gaps"
                className="scroll-mt-24 rounded-2xl border border-line bg-cream-soft p-5 shadow-[0_1px_0_rgba(42,25,22,0.04)] sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                      Snapshot
                    </p>
                    <h2 className="mt-1 font-serif text-2xl text-ink">Skill gaps</h2>
                  </div>
                  {result && (
                    <span className="rounded-full bg-maroon/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-maroon">
                      {result.targetRole?.label}
                    </span>
                  )}
                </div>

                {!result ? (
                  <p className="mt-4 text-sm leading-6 text-muted">
                    Run an analysis to see extracted skills, matched strengths, and the
                    gaps to work on.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                        Extracted
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.extractedSkills.length ? (
                          result.extractedSkills.map((s) => (
                            <span
                              key={s}
                              className="rounded-full border border-line bg-cream px-2.5 py-1 text-xs text-ink"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted">None detected</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                        Matched
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.matchedSkills.length ? (
                          result.matchedSkills.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-sage px-2.5 py-1 text-xs text-sage-ink"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted">No matches yet</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                        To grow
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.missingSkills.length ? (
                          result.missingSkills.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-maroon/10 px-2.5 py-1 text-xs text-maroon"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-sage-ink">
                            No major gaps for this role profile
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div
                id="history"
                className="scroll-mt-24 rounded-2xl border border-line bg-cream-soft p-5 shadow-[0_1px_0_rgba(42,25,22,0.04)] sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                      Saved locally
                    </p>
                    <h2 className="mt-1 font-serif text-2xl text-ink">
                      Recent analyses
                    </h2>
                  </div>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={clearHistory}
                      className="text-xs text-muted underline-offset-2 transition hover:text-rose hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {historyLoading ? (
                  <p className="mt-3 text-sm text-muted">Loading saved analyses...</p>
                ) : history.length === 0 ? (
                  <p className="mt-3 text-sm leading-6 text-muted">
                    Your last {MAX_HISTORY} analyses are saved to your anonymous session
                    on the server.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {history.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => restoreHistory(h)}
                          className="group flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-cream px-3.5 py-3 text-left transition hover:border-rose/30 hover:bg-sand/40"
                        >
                          <span>
                            <span className="block text-sm font-medium text-ink">
                              {ROLES.find((r) => r.key === h.targetRole)?.label ??
                                h.targetRole}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">
                              {new Date(h.createdAt).toLocaleString()} ·{" "}
                              {h.result.missingSkills.length} gaps
                            </span>
                          </span>
                          <Glyph
                            kind="arrow"
                            className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-maroon"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {result && (
            <section id="projects" className="mt-8 scroll-mt-24">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                    Step 02
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-ink sm:text-3xl">
                    Recommended mini-projects
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Ranked by how well they close your gaps.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exportRoadmap}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-cream-soft px-4 py-2 text-sm font-medium text-maroon transition hover:border-rose/40 hover:bg-sand/40"
                >
                  Export roadmap (.md)
                  <Glyph kind="arrow" className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {filteredRecommendations.map((p) => (
                  <article
                    key={p.id}
                    className="group rounded-2xl border border-line bg-cream-soft p-5 shadow-[0_1px_0_rgba(42,25,22,0.04)] transition hover:-translate-y-0.5 hover:border-rose/30 hover:shadow-lg sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-serif text-xl text-ink">{p.title}</h3>
                      <span className="shrink-0 rounded-full bg-maroon/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-maroon">
                        score {p.score}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-muted">{p.description}</p>

                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                        Covers gaps
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.covers.length ? (
                          p.covers.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-maroon/10 px-2 py-0.5 text-xs text-maroon"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted">
                            Reinforces existing skills
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                        Skills practiced
                      </p>
                      <p className="mt-1 text-sm text-ink">{p.skills.join(", ")}</p>
                    </div>

                    <details className="mt-4 rounded-xl border border-line bg-cream p-3">
                      <summary className="cursor-pointer text-sm font-medium text-ink">
                        Steps & resources
                      </summary>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
                        {p.steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                      <p className="mt-2 text-sm text-muted">
                        <span className="font-medium text-ink">Resources:</span>{" "}
                        {p.resources.join(" · ")}
                      </p>
                    </details>
                  </article>
                ))}
              </div>

              {filteredRecommendations.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line bg-cream-soft p-8 text-center text-sm text-muted">
                  No projects match “{query}”. Try a different skill or role.
                </div>
              )}
            </section>
          )}

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[10px] uppercase tracking-[0.18em] text-muted">
            <span>SkillStitch · Phase 2</span>
            <span>Node.js · SQLite · Light NLP</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
