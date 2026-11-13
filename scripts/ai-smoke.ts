import { sanitizeExtraction, sanitizePlan, sanitizeRole } from "../src/lib/ai/analysis";
import { checkAiStatus, parseJsonLoose } from "../src/lib/ai/client";
import { analyze } from "../src/lib/analyzer";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  // 1. Lenient JSON parsing (models often wrap output in code fences).
  const fenced = parseJsonLoose<{ ok: boolean }>('```json\n{"ok": true}\n```');
  assert(fenced?.ok === true, "Expected fenced JSON to parse");
  const noisy = parseJsonLoose<{ skills: string[] }>(
    'Sure! Here you go: {"skills":["react"]} — hope that helps.'
  );
  assert(noisy?.skills?.[0] === "react", "Expected embedded JSON to parse");
  assert(parseJsonLoose("not json") === null, "Expected invalid JSON to return null");

  // 2. Extraction is constrained to the taxonomy and normalizes aliases.
  const extracted = sanitizeExtraction({
    skills: ["React", "nodejs", "made-up-framework", "TypeScript", "react"],
  });
  assert(extracted.includes("react"), "Expected react to survive");
  assert(extracted.includes("node"), "Expected nodejs alias to normalize to node");
  assert(extracted.includes("typescript"), "Expected typescript to survive");
  assert(!extracted.includes("made-up-framework"), "Expected unknown skill to be dropped");
  assert(extracted.length === 3, `Expected 3 unique skills, got ${extracted.length}`);

  // 3. Role profiles need a label and enough real skills.
  const role = sanitizeRole({
    label: "  Senior   Platform Engineer  ",
    skills: ["node", "sql", "docker", "made-up"],
  });
  assert(role?.label === "Senior Platform Engineer", "Expected whitespace-collapsed label");
  assert(role?.skills.length === 3, "Expected unknown role skill to be dropped");
  assert(
    sanitizeRole({ label: "Thing", skills: ["react", "nope"] }) === null,
    "Expected role with too few known skills to be rejected"
  );

  // 4. Plans are validated against real project ids and renumbered.
  const plan = sanitizePlan(
    {
      summary: "A focused four-week sprint.",
      weeks: [
        { week: 3, theme: "Auth", focus: ["auth", "invented"], actions: ["Build login"], deliverable: "Auth flow" },
        { week: 1, theme: "Foundations", focus: ["sql"], actions: ["Model data"], deliverable: "Schema" },
        { week: 2, theme: "APIs", actions: ["Ship endpoints"], deliverable: "API" },
      ],
      rationale: [
        { projectId: "auth-notes", why: "Closes auth and postgres." },
        { projectId: "fake-project", why: "Should be dropped." },
        { projectId: "auth-notes", why: "Duplicate should be dropped." },
      ],
    },
    ["auth-notes", "recipe-api"]
  );
  assert(plan !== null, "Expected a valid plan");
  assert(plan.weeks.length === 3, "Expected three weeks");
  assert(
    plan.weeks.map((week) => week.week).join(",") === "1,2,3",
    "Expected weeks to be renumbered in order"
  );
  assert(plan.weeks[0].theme === "Foundations", "Expected weeks sorted by original number");
  assert(!plan.weeks[2].focus.includes("invented"), "Expected invented skill to be dropped");
  assert(plan.rationale.length === 1, "Expected only valid, unique project ids");
  assert(
    sanitizePlan({ summary: "Too short", weeks: [{ week: 1, theme: "One", actions: ["x"] }] }, []) === null,
    "Expected plans with fewer than three weeks to be rejected"
  );

  // 5. AI skills are merged into the deterministic analysis, but only known ones.
  const merged = await analyze({
    skillsText: "Built dashboards with React and SQL.",
    targetRole: "fullstack",
    extraSkills: ["nextjs", "made-up"],
    computeEmbeddings: false,
  });
  assert(merged.extractedSkills.includes("nextjs"), "Expected AI skill to be merged");
  assert(!merged.extractedSkills.includes("made-up"), "Expected unknown AI skill to be ignored");

  // 6. Custom role profiles override preset role requirements.
  const custom = await analyze({
    skillsText: "Node, SQL, Docker",
    targetRole: "custom",
    roleProfile: {
      key: "custom",
      label: "Platform Engineer",
      skills: ["node", "sql", "docker", "kubernetes"],
    },
    computeEmbeddings: false,
  });
  assert(custom.targetRole?.label === "Platform Engineer", "Expected custom role label");
  assert(custom.targetRole?.key === "custom", "Expected custom role key");
  assert(custom.requiredSkills.includes("kubernetes"), "Expected custom required skill");
  assert(custom.missingSkills.includes("kubernetes"), "Expected missing custom skill");

  // 7. Disabling AI must not touch the network.
  process.env.SKILLSTITCH_AI = "off";
  const status = await checkAiStatus();
  assert(status.enabled === false, "Expected AI to be disabled");
  assert(status.reachable === false, "Expected disabled AI to report unreachable");
  delete process.env.SKILLSTITCH_AI;

  console.log("AI smoke test passed ✅");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
