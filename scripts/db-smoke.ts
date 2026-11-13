process.env.SKILLSTITCH_DB_PATH = ":memory:";

async function main() {
  const { analyze } = await import("../src/lib/analyzer");
  const { saveAnalysis, listAnalyses, deleteAnalyses, deleteAnalysis } = await import("../src/lib/db");

  const userId = "00000000-0000-4000-8000-000000000001";
  const result = analyze({
    skillsText: "React, TypeScript, Node.js, SQL, Git, testing",
    targetRole: "fullstack",
  });

  const first = saveAnalysis(userId, {
    skillsText: "React, TypeScript, Node.js, SQL, Git, testing",
    targetRole: "fullstack",
    result,
  });

  const second = saveAnalysis(userId, {
    skillsText: "Python, pandas, scikit-learn",
    targetRole: "ml",
    result: analyze({ skillsText: "Python, pandas, scikit-learn", targetRole: "ml" }),
  });

  const afterSave = listAnalyses(userId, 10);
  if (afterSave.length !== 2) throw new Error(`Expected 2 saved analyses, got ${afterSave.length}`);
  if (afterSave[0].id !== second.id) throw new Error("Expected newest analysis first");

  if (!deleteAnalysis(userId, first.id)) throw new Error("Expected deleteAnalysis to remove the first row");
  const afterOneDelete = listAnalyses(userId, 10);
  if (afterOneDelete.length !== 1) throw new Error(`Expected 1 analysis after delete, got ${afterOneDelete.length}`);

  const deleted = deleteAnalyses(userId);
  if (deleted !== 1) throw new Error(`Expected deleteAnalyses to remove 1 row, got ${deleted}`);
  if (listAnalyses(userId, 10).length !== 0) throw new Error("Expected no analyses after clearing");

  console.log("DB smoke test passed ✅");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
