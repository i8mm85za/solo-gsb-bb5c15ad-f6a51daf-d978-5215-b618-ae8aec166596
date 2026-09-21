/**
 * 离心机转子配平核心算法（浏览器与 Node 服务端共享）。
 *
 * 模型：N 个等角环形槽位，槽号 i（0 起）位于角度 theta = i * 360 / N，
 * 1 号槽位于正上方，顺时针排列。重量 w 的矢量为 w * (sin theta, -cos theta)，
 * 屏幕坐标 x 向右、y 向下，与渲染端约定一致。
 */

export type HoleCount = 8 | 12 | 24;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Swap {
  /** 0 起槽号 */
  a: number;
  b: number;
}

export type SwapKind = 'none' | 'one' | 'two';

export interface BalanceCandidate {
  kind: SwapKind;
  /** 交换对，kind 决定长度（0/1/2） */
  swaps: Swap[];
  /** 交换后的重量数组（仅对最优/榜单候选填充） */
  weights: number[];
  /** 交换后的合力矢量 */
  resultant: Vec2;
  /** 合力大小 |Σwᵢvᵢ|，单位与重量一致（默认 g） */
  magnitude: number;
  /** 合力方向，0-360 度，自正上方顺时针 */
  angle: number;
}

export interface BalanceAnalysis {
  holes: number;
  weights: number[];
  locked: boolean[];
  threshold: number;
  current: BalanceCandidate;
  balanced: boolean;
  /** 未锁定槽位间枚举得到的最优方案（含 0/1/2 次交换） */
  best: BalanceCandidate;
  /** 最优方案总数（达到相同最小失衡的方案数） */
  bestCount: number;
  /** 枚举到的候选方案总数 */
  totalCandidates: number;
  /** 按失衡升序、交换槽号字典序排序后的前若干名（请求 topLimit 时填充） */
  top: BalanceCandidate[];
}

export const TOP_LIMIT = 10;
/** 浮点比较容差：失衡值相差小于该值视为同值 */
export const EPS = 1e-7;

export const HOLE_COUNTS: HoleCount[] = [8, 12, 24];

export function isValidHoleCount(n: unknown): n is HoleCount {
  return typeof n === 'number' && HOLE_COUNTS.includes(n as HoleCount);
}

/** 槽 i 的单位方向矢量（1 号槽朝上，顺时针）。 */
export function slotVector(i: number, holes: number): Vec2 {
  const theta = (i * 2 * Math.PI) / holes;
  return { x: Math.sin(theta), y: -Math.cos(theta) };
}

/** 各槽重量的矢量和。 */
export function resultantOf(weights: number[], holes: number): Vec2 {
  const vecs = ensureUnits(holes);
  let x = 0;
  let y = 0;
  for (let i = 0; i < holes; i++) {
    const v = vecs[i];
    x += weights[i] * v.x;
    y += weights[i] * v.y;
  }
  return { x, y };
}

// 单位方向缓存：避免枚举中反复三角函数
let cachedHoles = 0;
let unit: Vec2[] = [];
function ensureUnits(holes: number): Vec2[] {
  if (cachedHoles !== holes) {
    unit = [];
    for (let i = 0; i < holes; i++) unit.push(slotVector(i, holes));
    cachedHoles = holes;
  }
  return unit;
}

/** 合力大小。 */
export function magnitudeOf(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

/**
 * 合力方向角（度，0-360，自正上方顺时针）。
 * 合力为 0 时返回 0。
 */
export function angleOf(v: Vec2): number {
  if (Math.abs(v.x) < EPS && Math.abs(v.y) < EPS) return 0;
  const deg = (Math.atan2(v.x, -v.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** 对重量数组执行若干次交换（不改变原数组）。 */
export function applySwaps(weights: number[], swaps: Swap[]): number[] {
  const next = weights.slice();
  for (const { a, b } of swaps) {
    const t = next[a];
    next[a] = next[b];
    next[b] = t;
  }
  return next;
}

/**
 * 交换后的合力增量：把槽 a 的 wa 与槽 b 的 wb 互换，
 * 合力变化为 (wa-wb)(v_a-v_b)，新合力 = R - 该增量。
 * 两次交换互不相交时，两个增量可直接相加。
 */
function swapDelta(
  weights: number[],
  a: number,
  b: number,
  vecs: Vec2[],
): Vec2 {
  const d = weights[a] - weights[b];
  const va = vecs[a];
  const vb = vecs[b];
  return { x: d * (va.x - vb.x), y: d * (va.y - vb.y) };
}

interface LightCandidate {
  kind: SwapKind;
  swaps: Swap[];
  rx: number;
  ry: number;
  magnitude: number;
}

function makeLight(
  kind: SwapKind,
  swaps: Swap[],
  base: Vec2,
  weights: number[],
  vecs: Vec2[],
): LightCandidate {
  let dx = 0;
  let dy = 0;
  for (const s of swaps) {
    const d = swapDelta(weights, s.a, s.b, vecs);
    dx += d.x;
    dy += d.y;
  }
  const rx = base.x - dx;
  const ry = base.y - dy;
  return { kind, swaps, rx, ry, magnitude: Math.hypot(rx, ry) };
}

function toFullCandidate(c: LightCandidate, weights: number[]): BalanceCandidate {
  const resultant = { x: c.rx, y: c.ry };
  return {
    kind: c.kind,
    swaps: c.swaps,
    weights: c.kind === 'none' ? weights.slice() : applySwaps(weights, c.swaps),
    resultant,
    magnitude: c.magnitude,
    angle: angleOf(resultant),
  };
}

/**
 * 排序键：先按失衡升序；同值时按“交换槽号序列”字典序排序。
 * - 无交换（0 次）排在同值最前；
 * - 1 次交换按 [a,b]（a<b）；
 * - 2 次交换采用标准形式 (a,b)(c,d)，b<c。
 */
function keyOf(c: LightCandidate): number[] {
  const slots: number[] = [];
  for (const s of c.swaps) slots.push(s.a, s.b);
  return slots;
}

/** 比较：失衡优先（EPS 内视为同值），其次交换槽号字典序 */
function cmpLight(x: LightCandidate, y: LightCandidate): number {
  if (Math.abs(x.magnitude - y.magnitude) > EPS) return x.magnitude - y.magnitude;
  const kx = keyOf(x);
  const ky = keyOf(y);
  const len = Math.min(kx.length, ky.length);
  for (let i = 0; i < len; i++) {
    if (kx[i] !== ky[i]) return kx[i] - ky[i];
  }
  return kx.length - ky.length;
}

export interface AnalyzeInput {
  holes: number;
  weights: number[];
  locked: boolean[];
  threshold: number;
  /** 是否同时产出榜单（榜单需保留全部候选，仅推荐操作时需要）；默认 0 不产出 */
  topLimit?: number;
}

/**
 * 完整配平分析：实时矢量和 + 枚举未锁定槽位间至多两次交换。
 *
 * 枚举范围（仅涉及双方均未锁定的槽位；锁定槽位的重量不参与移动）：
 *   0 次：当前布局；
 *   1 次：任意 a<b 的单交换；
 *   2 次：互不相交的两次交换 (a,b)(c,d)，标准形式 b<c，
 *         四槽 a<b<c<d 的三种配对恰好各枚举一次、无重复。
 * 等重交换（交换后重量布局不变）跳过。
 */
export function analyzeBalance(input: AnalyzeInput): BalanceAnalysis {
  const { holes, threshold } = input;
  const weights = normalizeWeights(input.weights, holes);
  const locked = normalizeLocked(input.locked, holes);
  const topLimit = input.topLimit ?? 0;
  const vecs = ensureUnits(holes);

  const base = resultantOf(weights, holes);
  const currentLight: LightCandidate = {
    kind: 'none',
    swaps: [],
    rx: base.x,
    ry: base.y,
    magnitude: Math.hypot(base.x, base.y),
  };

  const free: number[] = [];
  for (let i = 0; i < holes; i++) {
    if (!locked[i]) free.push(i);
  }

  let best = currentLight;
  let bestCount = 1;
  let totalCandidates = 1;
  // 仅在需要榜单时保留全部候选；否则只维护最优，内存 O(1)
  const all: LightCandidate[] | null = topLimit > 0 ? [currentLight] : null;

  const consider = (c: LightCandidate) => {
    totalCandidates++;
    all?.push(c);
    const cmp = cmpLight(c, best);
    if (cmp < 0) {
      best = c;
      bestCount = 1;
    } else if (cmp === 0) {
      bestCount++;
    }
  };

  const pairingsOf = (a: number, b: number, c: number, d: number): Swap[][] => [
    [
      { a, b },
      { a: c, b: d },
    ],
    [
      { a, b: c },
      { a: b, b: d },
    ],
    [
      { a, b: d },
      { a: b, b: c },
    ],
  ];

  const m = free.length;
  for (let p = 0; p < m; p++) {
    const a = free[p];
    for (let q = p + 1; q < m; q++) {
      const b = free[q];
      if (weights[a] === weights[b]) continue; // 等重交换无物理效果
      consider(makeLight('one', [{ a, b }], base, weights, vecs));
    }
  }

  for (let p = 0; p < m; p++) {
    const a = free[p];
    for (let q = p + 1; q < m; q++) {
      const b = free[q];
      for (let r = q + 1; r < m; r++) {
        const c = free[r];
        for (let s = r + 1; s < m; s++) {
          const d = free[s];
          for (const swaps of pairingsOf(a, b, c, d)) {
            // 两次交换都不改变重量布局时才跳过
            const moved =
              weights[swaps[0].a] !== weights[swaps[0].b] ||
              weights[swaps[1].a] !== weights[swaps[1].b];
            if (!moved) continue;
            consider(makeLight('two', swaps, base, weights, vecs));
          }
        }
      }
    }
  }

  let top: BalanceCandidate[] = [];
  if (all) {
    all.sort(cmpLight);
    top = all.slice(0, topLimit).map((c) => toFullCandidate(c, weights));
  }

  const current = toFullCandidate(currentLight, weights);

  return {
    holes,
    weights,
    locked,
    threshold,
    current,
    balanced: current.magnitude <= threshold + EPS,
    best: toFullCandidate(best, weights),
    bestCount,
    totalCandidates,
    top,
  };
}

export function normalizeWeights(raw: number[], holes: number): number[] {
  const out = new Array<number>(holes).fill(0);
  for (let i = 0; i < holes; i++) {
    const v = raw[i];
    out[i] = typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
  }
  return out;
}

export function normalizeLocked(raw: boolean[], holes: number): boolean[] {
  const out = new Array<boolean>(holes).fill(false);
  for (let i = 0; i < holes; i++) out[i] = !!raw[i];
  return out;
}
