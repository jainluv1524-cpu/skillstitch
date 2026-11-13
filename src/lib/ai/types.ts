export type AiStatus = {
  enabled: boolean;
  reachable: boolean;
  modelAvailable: boolean;
  model: string;
  baseUrl: string;
  models: string[];
};

export type AiExtractionMeta = {
  used: boolean;
  model?: string;
  addedSkills?: string[];
};

export type AiRoleMeta = {
  used: boolean;
  model?: string;
  label?: string;
};

export type AiRunMeta = {
  requested: boolean;
  extraction?: AiExtractionMeta;
  role?: AiRoleMeta;
  notices?: string[];
};

export type AiPlanWeek = {
  week: number;
  theme: string;
  focus: string[];
  actions: string[];
  deliverable: string;
};

export type AiPlan = {
  summary: string;
  weeks: AiPlanWeek[];
  rationale: Array<{ projectId: string; why: string }>;
};
