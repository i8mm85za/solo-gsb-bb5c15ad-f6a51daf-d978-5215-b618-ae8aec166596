import type { HoleCount } from '@shared/balance';

/** 浏览器持久化的方案快照 */
export interface PlanState {
  holes: HoleCount;
  weights: number[];
  locked: boolean[];
  threshold: number;
}

export interface SavedPlan extends PlanState {
  id: string;
  name: string;
  savedAt: number;
}

const AUTOSAVE_KEY = 'cbb:autosave:v1';
const PLANS_KEY = 'cbb:plans:v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/* ---------- 自动保存（最近一次工作状态） ---------- */

export function saveAutosave(state: PlanState): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
  } catch {
    /* 存储不可用时静默降级 */
  }
}

export function loadAutosave(): (PlanState & { updatedAt?: number }) | null {
  if (typeof localStorage === 'undefined') return null;
  return safeParse<(PlanState & { updatedAt?: number }) | null>(
    localStorage.getItem(AUTOSAVE_KEY),
    null,
  );
}

/* ---------- 命名方案 ---------- */

export function listPlans(): SavedPlan[] {
  const plans = safeParse<SavedPlan[]>(localStorage.getItem(PLANS_KEY), []);
  return plans.sort((a, b) => b.savedAt - a.savedAt);
}

export function savePlan(name: string, state: PlanState): SavedPlan {
  const plans = listPlans().filter((p) => p.name !== name); // 同名覆盖
  const plan: SavedPlan = {
    ...state,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    savedAt: Date.now(),
  };
  plans.unshift(plan);
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans.slice(0, 50)));
  return plan;
}

export function deletePlan(id: string): void {
  const plans = listPlans().filter((p) => p.id !== id);
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}
