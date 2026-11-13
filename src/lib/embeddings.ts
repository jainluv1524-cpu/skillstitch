//
// Embedding-based skill matching for SkillStitch
// Adds sentence-transformer semantic similarity alongside the keyword scorer
// for broader skill recognition beyond exact keyword matches.
//
// Requires: @xenova/transformers installed (npm i @xenova/transformers)
//
// Usage:
//   const embeddings = await computeSentenceTransformersEmbeddings([skillsText, jobDescription]);
//   const similarity = cosineSimilarity(embeddings[0], embeddings[1]);
//   const augmentedResult = augmentAnalysisWithEmbeddings(result, embeddings);
//

import { KNOWN_SKILLS, extractSkills, type AnalysisResult } from "./analyzer";

/** Compute sentence-transformer embeddings for a list of texts.
 *  Uses @xenova/transformers on the Node.js runtime.
 *  Returns an array of number[] vectors (one per input text).
 */
export async function computeSentenceTransformersEmbeddings(
  texts: string[]
): Promise<number[][]> {
  // Lazy import to avoid blocking the event loop during startup
  const { pipeline } = await import("@xenova/transformers");
  // Use a small, fast model for sentence embeddings
  const classifier = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  const embeddings: number[][] = [];
  for (const text of texts) {
    // @ts-ignore – transformers pipeline returns a typed array
    const output = await classifier(text, { pooling: "mean", normalize: true });
    // Convert to number[] (already normalized if normalize: true)
    const vec = Array.from(output.data as Float32Array);
    embeddings.push(vec);
  }
  return embeddings;
}

/** Cosine similarity between two number vectors (already normalized). */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Augment an AnalysisResult with an embedding-based similarity score.
 *  Compares the user's full skillsText against the requiredSkills of the target role.
 *  Returns the original result with an added `embeddingSimilarity` field (0–1).
 */
export async function augmentAnalysisWithEmbeddings(
  result: AnalysisResult,
  skillsText: string
): Promise<AnalysisResult & { embeddingSimilarity: number }> {
  const requiredSkillsText =
    result.requiredSkills.join(" ") + " " + result.missingSkills.join(" ");
  const [userEmbedding, roleEmbedding] = await computeSentenceTransformersEmbeddings([
    skillsText,
    requiredSkillsText,
  ]);
  const similarity = cosineSimilarity(userEmbedding, roleEmbedding);
  return {
    ...result,
    embeddingSimilarity: Math.round(similarity * 10000) / 10000, // 4 decimal places
  };
}

/** Return a human-readable label for the embedding similarity score. */
export function embeddingSimilarityLabel(score: number): string {
  if (score >= 0.8) return "Very high semantic overlap";
  if (score >= 0.6) return "High semantic overlap";
  if (score >= 0.4) return "Moderate semantic overlap";
  if (score >= 0.2) return "Low semantic overlap";
  return "Very low semantic overlap";
}