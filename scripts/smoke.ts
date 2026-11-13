import { analyze, extractSkills } from "../src/lib/analyzer";

const text =
  "Built React and Next.js apps with TypeScript, REST APIs in Node.js, basic SQL. Used Git and wrote some unit tests. Familiar with Python and scikit-learn.";

const skills = extractSkills(text);
console.log("Extracted:", skills.join(", "));

const result = analyze({ skillsText: text, targetRole: "fullstack" });
console.log("Role:", result.targetRole?.label);
console.log("Matched:", result.matchedSkills.join(", "));
console.log("Missing:", result.missingSkills.join(", "));
console.log("Top recommendations:");
for (const p of result.recommendations) {
  console.log(`- ${p.title} (score ${p.score}) covers: ${p.covers.join(", ") || "reinforcement"}`);
}

const missingRequired = ["react", "nextjs", "typescript", "api", "node", "sql", "git", "testing", "python", "scikit-learn"];
for (const s of missingRequired) {
  if (!skills.includes(s)) throw new Error(`Expected extracted skill: ${s}`);
}
if (!result.missingSkills.length) throw new Error("Expected some missing skills for fullstack role");
if (result.recommendations.length !== 5) throw new Error("Expected 5 recommendations");
console.log("Smoke test passed ✅");
