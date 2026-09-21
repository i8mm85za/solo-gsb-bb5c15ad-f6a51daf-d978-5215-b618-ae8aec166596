import type { HoleCount } from '@shared/balance';

/** 生成一组“失衡但可经交换显著改善”的示例重量（同批试管错位放置） */
export function demoWeights(holes: HoleCount): { weights: number[]; locked: boolean[] } {
  // 理想配平：对径等重。这里把对径配好的两组重量打乱几个位置，
  // 再锁定一个槽，便于演示推荐与锁定约束。
  const pairs: Array<[number, number]> =
    holes === 8
      ? [
          [12.0, 12.05],
          [10.4, 10.38],
          [11.2, 11.15],
          [10.9, 12.0],
        ]
      : holes === 12
        ? [
            [12.0, 12.05],
            [10.4, 10.38],
            [11.2, 11.15],
            [10.9, 10.92],
            [11.6, 11.55],
            [10.1, 12.0],
          ]
        : [
            [12.0, 12.05],
            [10.4, 10.38],
            [11.2, 11.15],
            [10.9, 10.92],
            [11.6, 11.55],
            [10.1, 10.12],
            [11.8, 11.77],
            [10.6, 10.61],
            [11.0, 10.98],
            [10.3, 10.33],
            [11.4, 11.42],
            [10.7, 12.0],
          ];

  const weights = new Array<number>(holes).fill(0);
  const half = holes / 2;
  pairs.forEach(([w1, w2], i) => {
    weights[i] = w1;
    weights[i + half] = w2;
  });

  // 打乱：交换几对非对径槽，制造明显失衡
  const swaps: Array<[number, number]> =
    holes === 8
      ? [
          [1, 6],
          [2, 5],
        ]
      : holes === 12
        ? [
            [1, 9],
            [2, 8],
            [4, 10],
          ]
        : [
            [1, 18],
            [3, 16],
            [5, 14],
            [7, 12],
          ];
  for (const [a, b] of swaps) {
    const t = weights[a];
    weights[a] = weights[b];
    weights[b] = t;
  }

  const locked = new Array<boolean>(holes).fill(false);
  locked[0] = true; // 锁定 1 号槽演示约束
  return { weights, locked };
}
