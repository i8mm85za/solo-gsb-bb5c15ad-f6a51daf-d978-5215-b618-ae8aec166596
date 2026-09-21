/**
 * 算法自检：npx tsx scripts/verify.ts
 * 1) 对径等重 → 合力为 0
 * 2) 对 N=8 随机情形，用“所有 ≤2 次交换（含跨锁定边界的过滤）”暴力集对照
 * 3) 同值方案排序稳定性（槽号字典序）
 */
import {
  analyzeBalance,
  applySwaps,
  resultantOf,
  magnitudeOf,
  type Swap,
} from '../shared/balance';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('✖', msg);
  } else {
    console.log('✔', msg);
  }
}

// 1) 对径等重合力为 0
for (const n of [8, 12, 24] as const) {
  const w = new Array(n).fill(0);
  for (let i = 0; i < n / 2; i++) {
    w[i] = 10 + (i % 3);
    w[i + n / 2] = w[i];
  }
  const m = magnitudeOf(resultantOf(w, n));
  assert(m < 1e-9, `${n} 孔对径等重合力≈0（得到 ${m}）`);
}

// 2) 暴力对照：枚举出所有 0/1/2 次交换（互不相交），求最小合力
function bruteForceBest(weights: number[], holes: number, locked: boolean[]) {
  const free: number[] = [];
  for (let i = 0; i < holes; i++) if (!locked[i]) free.push(i);

  let bestMag = magnitudeOf(resultantOf(weights, holes));
  let bestKey: number[] = [];

  const consider = (swaps: Swap[]) => {
    const w2 = applySwaps(weights, swaps);
    const mag = magnitudeOf(resultantOf(w2, holes));
    const key = swaps.flatMap((s) => [s.a, s.b]);
    if (mag < bestMag - 1e-7 || (Math.abs(mag - bestMag) < 1e-7 && lexLess(key, bestKey))) {
      bestMag = mag;
      bestKey = key;
    }
  };

  for (let p = 0; p < free.length; p++) {
    for (let q = p + 1; q < free.length; q++) {
      consider([{ a: free[p], b: free[q] }]);
    }
  }
  // 任意两对互不相交的交换（不做规范化，直接全枚举，覆盖面更广）
  const singles: Swap[] = [];
  for (let p = 0; p < free.length; p++)
    for (let q = p + 1; q < free.length; q++) singles.push({ a: free[p], b: free[q] });
  for (let i = 0; i < singles.length; i++) {
    for (let j = i + 1; j < singles.length; j++) {
      const s1 = singles[i];
      const s2 = singles[j];
      const slots = new Set([s1.a, s1.b, s2.a, s2.b]);
      if (slots.size === 4) consider([s1, s2]);
    }
  }
  return { bestMag, bestKey };
}

function lexLess(a: number[], b: number[]): boolean {
  if (b.length === 0) return false;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return a.length < b.length;
}

// 固定种子的伪随机，保证可复现
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

let cases = 0;
for (const n of [8, 12] as const) {
  for (let t = 0; t < 200; t++) {
    const weights = Array.from({ length: n }, () =>
      rand() < 0.25 ? 0 : Math.round(rand() * 5 * 100) / 100 + 8,
    );
    const locked = Array.from({ length: n }, () => rand() < 0.2);
    const a = analyzeBalance({ holes: n, weights, locked, threshold: 0.5 });
    const b = bruteForceBest(weights, n, locked);
    cases++;
    if (Math.abs(a.best.magnitude - b.bestMag) > 1e-6) {
      failures++;
      console.error('✖ 最小失衡不一致', { n, weights, locked, got: a.best.magnitude, want: b.bestMag });
    } else {
      const gotKey = a.best.swaps.flatMap((s) => [s.a, s.b]);
      if (JSON.stringify(gotKey) !== JSON.stringify(b.bestKey)) {
        failures++;
        console.error('✖ 同值排序键不一致', { n, gotKey, want: b.bestKey, mag: b.bestMag });
      }
    }
  }
}
assert(failures === 0, `${cases} 组随机用例最小失衡与排序键全部与暴力枚举一致`);

// 3) 候选计数：8 孔全空锁 0 时 1 次交换全为等重，应全部跳过，候选仅当前布局
const zero = analyzeBalance({
  holes: 8,
  weights: new Array(8).fill(0),
  locked: new Array(8).fill(false),
  threshold: 0.1,
});
assert(zero.totalCandidates === 1, `全 0 重量无有效交换（候选数 ${zero.totalCandidates}）`);
assert(zero.balanced, '全 0 重量判定平衡');

// 4) 锁定槽不被移动：手工构造只能靠锁定位之外解决的情形
{
  const w = [10, 11, 10, 11, 10, 11, 10, 11];
  const locked = [true, false, true, false, true, false, true, false];
  const a = analyzeBalance({ holes: 8, weights: w, locked, threshold: 0.01 });
  const touchesLocked = a.best.swaps.some((s) => locked[s.a] || locked[s.b]);
  assert(!touchesLocked, '推荐方案不触及任何锁定槽');
  // 只剩 4 个全 11 的自由槽，交换无效，最佳即当前
  assert(a.best.kind === 'none', `无改善余地时 best.kind=none（得到 ${a.best.kind}）`);
}

console.log(failures === 0 ? '\n全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
