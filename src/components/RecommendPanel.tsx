import type { BalanceAnalysis, BalanceCandidate } from '@shared/balance';
import { fmt, slotLabel, swapLabel } from '../lib/format';

export interface RecommendResult {
  analysis: BalanceAnalysis;
  source: 'server' | 'local';
}

interface RecommendPanelProps {
  current: BalanceAnalysis;
  result: RecommendResult | null;
  loading: boolean;
  onRecommend: () => void;
  onApply: (c: BalanceCandidate) => void;
}

function describeSwaps(c: BalanceCandidate): string {
  if (c.kind === 'none') return '保持当前布局（0 次交换）';
  const prefix = c.kind === 'one' ? '交换 1 次：' : '交换 2 次：';
  return prefix + c.swaps.map((s) => swapLabel(s.a, s.b)).join('，');
}

export function RecommendPanel({
  current,
  result,
  loading,
  onRecommend,
  onApply,
}: RecommendPanelProps) {
  const freeCount = current.locked.filter((l) => !l).length;
  const over = !current.balanced;

  return (
    <section className="panel">
      <h2>
        配平推荐
        <span className="hint">枚举未锁定槽位间至多两次交换，取失衡最小方案</span>
      </h2>

      <div className="recommend-summary">
        未锁定槽位 {freeCount} / {current.holes}，共枚举 {current.totalCandidates} 个有效候选
        （已跳过等重交换）。
      </div>

      <button
        type="button"
        className="primary"
        onClick={onRecommend}
        disabled={loading || freeCount < 2}
      >
        {loading ? '计算中…' : over ? '枚举交换方案并推荐' : '当前已平衡，仍可枚举优化'}
      </button>

      {result && (
        <>
          <div className="recommend-summary" style={{ marginTop: 12 }}>
            最优失衡 <strong style={{ color: 'var(--ok)' }}>{fmt(result.analysis.best.magnitude, 3)} g</strong>
            {' '}（当前 {fmt(current.current.magnitude, 3)} g，方向{' '}
            {result.analysis.best.magnitude > 0
              ? `${fmt(result.analysis.best.angle, 1)}°`
              : '完全对消'}
            ）；达到该最优的方案共 <strong>{result.analysis.bestCount}</strong> 个，
            同值方案已按交换槽号升序排列。计算来源：
            {result.source === 'server' ? 'Node 服务端' : '浏览器本地（服务端不可用）'}。
          </div>

          <div className="candidate-list">
            {result.analysis.top.map((c, idx) => {
              const isBest = idx === 0;
              const improvedBy = current.current.magnitude - c.magnitude;
              return (
                <div key={candidateKey(c)} className={`candidate${isBest ? ' best' : ''}`}>
                  <span className="rank">{idx + 1}</span>
                  <div className="desc">
                    <div className="line1">
                      {c.swaps.map((s, k) => (
                        <span key={k} className="swap-tag">
                          {swapLabel(s.a, s.b)}
                        </span>
                      ))}
                      {c.kind === 'none' && '不交换'}
                      {isBest && <span style={{ color: 'var(--ok)' }}> ★ 推荐</span>}
                    </div>
                    <div className="line2">
                      {describeSwaps(c)}
                      {improvedBy > 1e-7 && `　↓ 改善 ${fmt(improvedBy, 3)} g`}
                    </div>
                  </div>
                  <span
                    className={`mag ${c.magnitude <= current.threshold ? 'good' : 'bad'}`}
                  >
                    {fmt(c.magnitude, 2)} g
                  </span>
                  <button
                    type="button"
                    className={isBest ? 'primary' : ''}
                    onClick={() => onApply(c)}
                    disabled={c.kind === 'none'}
                    title={c.kind === 'none' ? '当前布局无需应用' : `应用：槽 ${c.swaps.map((s) => `${slotLabel(s.a)}↔${slotLabel(s.b)}`).join('，')}`}
                  >
                    应用
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function candidateKey(c: BalanceCandidate): string {
  return c.kind + ':' + c.swaps.map((s) => `${s.a}-${s.b}`).join('|');
}
