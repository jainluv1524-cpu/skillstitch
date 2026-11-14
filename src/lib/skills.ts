export type RoleKey = "frontend" | "backend" | "fullstack" | "ml";

export type SkillImportance = "core" | "familiar" | "learning";

/** Importance of a skill within a role */
export type SkillImportanceMap = Record<string, SkillImportance>;

/** A role with its skills and importance levels */
export type RoleDefinition = {
  key: RoleKey;
  label: string;
  skills: string[];
  importance: SkillImportanceMap;
};

/** All available roles */
export const ROLES: Record<RoleKey, RoleDefinition> = {
  frontend: {
    key: "frontend",
    label: "Frontend Developer",
    skills: [
      "html",
      "css",
      "javascript",
      "typescript",
      "react",
      "nextjs",
      "tailwind",
      "testing",
      "accessibility",
      "git",
    ],
    importance: {
      html: "core",
      css: "core",
      javascript: "core",
      typescript: "core",
      react: "core",
      nextjs: "core",
      tailwind: "familiar",
      testing: "familiar",
      accessibility: "learning",
      git: "core",
    },
  },
  backend: {
    key: "backend",
    label: "Backend Developer",
    skills: [
      "node",
      "express",
      "api",
      "sql",
      "postgres",
      "auth",
      "testing",
      "docker",
      "git",
      "redis",
    ],
    importance: {
      node: "core",
      express: "core",
      api: "core",
      sql: "core",
      postgres: "core",
      auth: "core",
      testing: "core",
      docker: "familiar",
      git: "core",
      redis: "learning",
    },
  },
  fullstack: {
    key: "fullstack",
    label: "Full-Stack Developer",
    skills: [
      "html",
      "css",
      "javascript",
      "typescript",
      "react",
      "nextjs",
      "node",
      "api",
      "sql",
      "postgres",
      "auth",
      "git",
      "testing",
    ],
    importance: {
      html: "core",
      css: "core",
      javascript: "core",
      typescript: "core",
      react: "core",
      nextjs: "core",
      node: "core",
      api: "core",
      sql: "core",
      postgres: "core",
      auth: "core",
      git: "core",
      testing: "core",
    },
  },
  ml: {
    key: "ml",
    label: "ML-Aware Full-Stack Developer",
    skills: ["python", "data", "pandas", "numpy", "scikit-learn", "ml", "api", "sql", "react", "git"],
    importance: {
      python: "core",
      data: "core",
      pandas: "core",
      numpy: "core",
      "scikit-learn": "core",
      ml: "core",
      api: "core",
      sql: "core",
      react: "familiar",
      git: "core",
    },
  },
};

/** Importance of a skill within a project */
export type ProjectImportanceMap = Record<string, SkillImportance>;

/** A project idea with its skills and importance levels */
export type ProjectIdea = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  steps: string[];
  resources: string[];
  importance?: ProjectImportanceMap | undefined;
};

/** All project ideas */
export const PROJECTS: ProjectIdea[] = [
  {
    id: "task-dashboard",
    title: "Personal Task Dashboard",
    description: "Build a CRUD dashboard with filters, persistence, and clean UI states.",
    skills: ["react", "typescript", "css", "api", "git"],
    steps: [
      "Design task model and UI",
      "Implement CRUD and filters",
      "Persist data via API/database",
      "Add loading/error/empty states",
    ],
    resources: ["React docs", "Next.js App Router", "MDN Fetch API"],
    importance: {
      react: "core",
      typescript: "core",
      css: "core",
      api: "familiar",
      git: "core",
    },
  },
  {
    id: "auth-notes",
    title: "Authenticated Notes App",
    description: "Create a notes app with login, protected routes, and per-user data.",
    skills: ["nextjs", "auth", "api", "sql", "postgres", "node"],
    steps: [
      "Set up auth/session flow",
      "Create notes schema and API",
      "Protect pages and actions",
      "Deploy with environment variables",
    ],
    resources: ["Auth.js/NextAuth", "PostgreSQL basics", "OWASP auth tips"],
    importance: {
      nextjs: "core",
      auth: "core",
      api: "core",
      sql: "core",
      postgres: "core",
      node: "core",
    },
  },
  {
    id: "recipe-api",
    title: "Recipe Search & Pantry API",
    description: "Serve searchable recipes and ingredient-based matching from a backend service.",
    skills: ["node", "express", "api", "sql", "testing", "docker"],
    steps: [
      "Model recipes/ingredients",
      "Build search endpoints",
      "Add matching logic",
      "Write API tests and containerize",
    ],
    resources: ["Express routing", "SQL joins", "Supertest/Jest"],
    importance: {
      node: "core",
      express: "core",
      api: "core",
      sql: "core",
      testing: "familiar",
      docker: "learning",
    },
  },
  {
    id: "splitwise-lite",
    title: "Splitwise Lite Expense Tracker",
    description: "Track group expenses, balances, and settlements with a full-stack app.",
    skills: ["react", "node", "api", "sql", "postgres", "testing"],
    steps: [
      "Design groups/expenses schema",
      "Build balance calculation logic",
      "Create UI for groups and settlements",
      "Add tests for edge cases",
    ],
    resources: ["Database schema design", "React forms", "Unit testing basics"],
    importance: {
      react: "core",
      node: "core",
      api: "core",
      sql: "core",
      postgres: "familiar",
      testing: "core",
    },
  },
  {
    id: "skill-matcher",
    title: "Resume Skill Matcher (Light NLP)",
    description: "Extract skills from text and rank matching opportunities or projects.",
    skills: ["python", "ml", "scikit-learn", "api", "data", "pandas"],
    steps: [
      "Collect skill keywords/taxonomy",
      "Extract and normalize tokens from text",
      "Score matches with similarity/weights",
      "Expose results via an API/UI",
    ],
    resources: ["scikit-learn text features", "Basic NLP preprocessing", "FastAPI/Flask"],
    importance: {
      python: "core",
      ml: "core",
      "scikit-learn": "core",
      api: "familiar",
      data: "learning",
      pandas: "learning",
    },
  },
  {
    id: "feedback-insights",
    title: "Feedback Insights Dashboard",
    description: "Analyze user feedback text for themes and sentiment trends.",
    skills: ["python", "pandas", "numpy", "ml", "data", "sql"],
    steps: [
      "Ingest feedback dataset",
      "Clean/tokenize text",
      "Run simple sentiment/topic analysis",
      "Visualize trends in a dashboard",
    ],
    resources: ["Pandas cookbook", "Intro sentiment analysis", "Charting libraries"],
    importance: {
      python: "core",
      pandas: "core",
      numpy: "core",
      ml: "core",
      data: "learning",
      sql: "core",
    },
  },
  {
    id: "nextjs-portfolio",
    title: "Production-Ready Portfolio with CMS-style Data",
    description: "Ship a polished portfolio with projects, blog/content, and SEO basics.",
    skills: ["nextjs", "react", "typescript", "tailwind", "accessibility", "git"],
    steps: [
      "Structure content model",
      "Build responsive pages/components",
      "Add accessibility and SEO metadata",
      "Deploy and iterate",
    ],
    resources: ["Next.js docs", "Web accessibility checklist", "Tailwind UI patterns"],
    importance: {
      nextjs: "core",
      react: "core",
      typescript: "core",
      tailwind: "familiar",
      accessibility: "learning",
      git: "core",
    },
  },
];

export const SKILL_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  "node.js": "node",
  nodejs: "node",
  postgres: "postgres",
  postgresql: "postgres",
  "next.js": "nextjs",
  reactjs: "react",
  "rest api": "api",
  apis: "api",
  sklearn: "scikit-learn",
  "scikit learn": "scikit-learn",
  mlops: "ml",
  "machine learning": "ml",
  dockerfile: "docker",
  tests: "testing",
  unit: "testing",
};

export function normalizeSkill(token: string): string {
  const t = String(token).toLowerCase().trim();
  return SKILL_ALIASES[t] ?? t;
}

/** Get the importance of a skill */
export function getSkillImportance(skill: string): SkillImportance {
  const normalized = normalizeSkill(skill);
  // Check in role skills importance first
  for (const role of Object.values(ROLES)) {
    if (normalized in role.importance) {
      return role.importance[normalized];
    }
  }
  // Check in project importance
  for (const project of PROJECTS) {
    if (normalized in (project.importance ?? {})) {
      return project.importance![normalized];
    }
  }
  // Default to "familiar" for unknown skills
  return "familiar";
}

/** Check if a skill is "core" */
export function isCoreSkill(skill: string): boolean {
  return getSkillImportance(skill) === "core";
}

/** Check if a skill is "learning" */
export function isLearningSkill(skill: string): boolean {
  return getSkillImportance(skill) === "learning";
}