import type { BalanceAnalysis } from '@shared/balance';
import { fmt } from '../lib/format';

export function VectorPanel({ analysis }: { analysis: BalanceAnalysis }) {
  const { current, threshold, balanced, holes } = analysis;
  const { x, y } = current.resultant;

  return (
    <section className="panel">
      <h2>
        实时矢量和
        <span className="hint">
          各槽重量按等角方向求和（槽 1 朝上，顺时针 {holes} 等分）
        </span>
      </h2>
      <div className="vector-readout">
        <div className="metric">
          <div className="label">失衡合力 |ΣF|（g）</div>
          <div className="value" style={{ color: balanced ? 'var(--ok)' : 'var(--danger)' }}>
            {fmt(current.magnitude, 3)}
          </div>
        </div>
        <div className="metric">
          <div className="label">合力方向（° 自正上方顺时针）</div>
          <div className="value">{current.magnitude > 0 ? fmt(current.angle, 1) : '—'}</div>
        </div>
        <div className="metric">
          <div className="label">X 分量（g）</div>
          <div className="value">{fmt(x, 3)}</div>
        </div>
        <div className="metric">
          <div className="label">Y 分量（g）</div>
          <div className="value">{fmt(y, 3)}</div>
        </div>
      </div>

      <div className={`status-bar ${balanced ? 'ok' : 'over'}`}>
        <span>{balanced ? '✔ 处于阈值内' : '⚠ 超过失衡阈值'}</span>
        <span className="sub">
          当前 {fmt(current.magnitude, 3)} g / 阈值 {fmt(threshold, 3)} g
        </span>
      </div>
    </section>
  );
}
