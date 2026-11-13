import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AnalysisResult } from "./analyzer";

export type SavedAnalysis = {
  id: string;
  skillsText: string;
  targetRole: string;
  result: AnalysisResult;
  createdAt: string;
};

let database: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (database) return database;

  const dbPath =
    process.env.SKILLSTITCH_DB_PATH ?? path.join(process.cwd(), "data", "skillstitch.db");

  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  database = new DatabaseSync(dbPath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skills_text TEXT NOT NULL,
      target_role TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_analyses_user_created
      ON analyses(user_id, created_at DESC);
  `);

  return database;
}

export function touchUser(userId: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)")
    .run(userId, new Date().toISOString());
}

/** Save a new user to the database. Returns true on success. */
export function saveUser(userId: string, email: string): boolean {
  try {
    getDb()
      .prepare("INSERT OR IGNORE INTO users (id, email, created_at) VALUES (?, ?, ?)")
      .run(userId, email, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

export function saveAnalysis(
  userId: string,
  input: { skillsText: string; targetRole: string; result: AnalysisResult }
): SavedAnalysis {
  const db = getDb();
  touchUser(userId);

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO analyses (id, user_id, skills_text, target_role, result_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, input.skillsText, input.targetRole, JSON.stringify(input.result), createdAt);

  return {
    id,
    skillsText: input.skillsText,
    targetRole: input.targetRole,
    result: input.result,
    createdAt,
  };
}

export function listAnalyses(userId: string, limit = 10): SavedAnalysis[] {
  const rows = getDb()
    .prepare(
      `SELECT id, skills_text, target_role, result_json, created_at
       FROM analyses
       WHERE user_id = ?
       ORDER BY created_at DESC, rowid DESC
       LIMIT ?`
    )
    .all(userId, limit);

  return rows.map((row) => ({
    id: String(row.id),
    skillsText: String(row.skills_text),
    targetRole: String(row.target_role),
    result: JSON.parse(String(row.result_json)) as AnalysisResult,
    createdAt: String(row.created_at),
  }));
}

export function deleteAnalyses(userId: string): number {
  const result = getDb()
    .prepare("DELETE FROM analyses WHERE user_id = ?")
    .run(userId);
  return Number(result.changes);
}

export function deleteAnalysis(userId: string, id: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM analyses WHERE user_id = ? AND id = ?")
    .run(userId, id);
  return Number(result.changes) > 0;
}
