"use client";

import { useEffect, useState } from "react";

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

const ROLES = [
  { key: "frontend", label: "Frontend Developer" },
  { key: "backend", label: "Backend Developer" },
  { key: "fullstack", label: "Full-Stack Developer" },
  { key: "ml", label: "ML-Aware Full-Stack Developer" },
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

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
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
      result.extractedSkills.length ? result.extractedSkills.map((s) => `- ${s}`).join("\n") : "_None detected_",
      "",
      "## Matched skills",
      result.matchedSkills.length ? result.matchedSkills.map((s) => `- ${s}`).join("\n") : "_None_",
      "",
      "## Skill gaps",
      result.missingSkills.length ? result.missingSkills.map((s) => `- ${s}`).join("\n") : "_No major gaps_",
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
        p.covers.length ? `**Covers gaps:** ${p.covers.join(", ")}` : "**Reinforces existing skills**",
        "",
        "**Steps:**",
        ...p.steps.map((s) => `1. ${s}`),
        "",
        `**Resources:** ${p.resources.join(" · ")}`,
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="mb-2 inline-block rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
          Phase 2 · Server-side persistence + light NLP matching
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">SkillStitch</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Personalized project & skill-gap planner. Paste your skills or experience, pick a target role, and get tailored mini-projects to close your gaps.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <form onSubmit={onAnalyze} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
          <label className="mb-2 block text-sm font-medium text-slate-200">Your skills / resume / project experience</label>
          <textarea
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            rows={10}
            placeholder="e.g. Built React and Next.js apps with TypeScript, REST APIs in Node.js, basic SQL. Used Git and wrote some unit tests..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none ring-cyan-400/40 placeholder:text-slate-500 focus:ring"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Target role</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm outline-none ring-cyan-400/40 focus:ring"
              >
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {loading ? "Analyzing..." : "Analyze & Recommend"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
          <p className="mt-4 text-xs text-slate-400">
            How it works: keyword/NLP-style extraction identifies known skills, compares them against the target role, then a weighted similarity score ranks projects that best fill your gaps.
          </p>
        </form>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold">Skill Gap Snapshot</h2>
            {!result ? (
              <p className="mt-2 text-sm text-slate-400">Run an analysis to see extracted skills, gaps, and recommendations.</p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="text-slate-400">Extracted skills</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {result.extractedSkills.length ? result.extractedSkills.map((s) => <span key={s} className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-200">{s}</span>) : <span className="text-slate-500">None detected</span>}
                  </div>
                </div>
                <div>
                  <p className="text-slate-400">Matched for {result.targetRole?.label}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {result.matchedSkills.length ? result.matchedSkills.map((s) => <span key={s} className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">{s}</span>) : <span className="text-slate-500">No matches yet</span>}
                  </div>
                </div>
                <div>
                  <p className="text-slate-400">Missing / to grow</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {result.missingSkills.length ? result.missingSkills.map((s) => <span key={s} className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-300">{s}</span>) : <span className="text-emerald-300">No major gaps for this role profile</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recent analyses</h2>
              {history.length > 0 && (
                <button type="button" onClick={clearHistory} className="text-xs text-slate-400 underline-offset-2 hover:text-rose-300 hover:underline">
                  Clear
                </button>
              )}
            </div>
            {historyLoading ? (
              <p className="mt-2 text-sm text-slate-400">Loading saved analyses...</p>
            ) : history.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">
                Your last {MAX_HISTORY} analyses are saved to your anonymous session on the server.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => restoreHistory(h)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-left transition hover:border-cyan-400/40 hover:bg-slate-950"
                    >
                      <span className="block text-sm font-medium text-slate-200">{ROLES.find((r) => r.key === h.targetRole)?.label ?? h.targetRole}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">
                        {new Date(h.createdAt).toLocaleString()} · {h.result.missingSkills.length} gaps
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {result && (
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Recommended Mini-Projects</h2>
            <button
              type="button"
              onClick={exportRoadmap}
              className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/20"
            >
              Export roadmap (.md)
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {result.recommendations.map((p) => (
              <article key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-100">{p.title}</h3>
                  <span className="rounded-md bg-cyan-500/15 px-2 py-1 text-xs font-medium text-cyan-300">score {p.score}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{p.description}</p>
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Covers gaps</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {p.covers.length ? p.covers.map((s) => <span key={s} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">{s}</span>) : <span className="text-xs text-slate-500">Reinforces existing skills</span>}
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Skills practiced</p>
                  <p className="mt-1 text-sm text-slate-200">{p.skills.join(", ")}</p>
                </div>
                <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-200">Steps & resources</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
                    {p.steps.map((s) => <li key={s}>{s}</li>)}
                  </ol>
                  <p className="mt-2 text-sm text-slate-400"><span className="font-medium text-slate-300">Resources:</span> {p.resources.join(" · ")}</p>
                </details>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-12 border-t border-slate-800 pt-4 text-xs text-slate-500">
        SkillStitch · Phase 2 · SQLite-backed anonymous sessions · Light NLP matching, no external ML services required.
      </footer>
    </main>
  );
}
