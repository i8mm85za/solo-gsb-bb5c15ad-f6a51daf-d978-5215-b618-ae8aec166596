import type { HoleCount, Swap, Vec2 } from '@shared/balance';

/** /api/balance 返回的精简结构（不含各候选完整重量数组） */
export interface CandidateDTO {
  kind: 'none' | 'one' | 'two';
  swaps: Swap[];
  magnitude: number;
  angle: number;
  resultant: Vec2;
}

export interface AnalysisDTO {
  holes: number;
  threshold: number;
  balanced: boolean;
  current: CandidateDTO;
  best: CandidateDTO;
  bestCount: number;
  totalCandidates: number;
  top: CandidateDTO[];
}

export async function fetchBalance(params: {
  holes: HoleCount;
  weights: number[];
  locked: boolean[];
  threshold: number;
  signal?: AbortSignal;
}): Promise<AnalysisDTO> {
  const res = await fetch('/api/balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      holes: params.holes,
      weights: params.weights,
      locked: params.locked,
      threshold: params.threshold,
    }),
    signal: params.signal,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `服务端返回 ${res.status}`);
  }
  return (await res.json()) as AnalysisDTO;
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { signal });
    return res.ok;
  } catch {
    return false;
  }
}
