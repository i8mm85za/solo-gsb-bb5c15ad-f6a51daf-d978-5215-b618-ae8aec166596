import { fmtWeight, slotLabel } from '../lib/format';

interface SlotTableProps {
  holes: number;
  weights: number[];
  locked: boolean[];
  selected: number | null;
  onSelect: (i: number) => void;
  onWeightChange: (i: number, value: number) => void;
  onToggleLock: (i: number) => void;
}

export function SlotTable({
  holes,
  weights,
  locked,
  selected,
  onSelect,
  onWeightChange,
  onToggleLock,
}: SlotTableProps) {
  return (
    <section className="panel">
      <h2>
        槽位录入
        <span className="hint">空槽按 0 处理；点击 🔒 锁定/解锁，锁定槽不参与交换</span>
      </h2>
      <div className="slot-table">
        {Array.from({ length: holes }, (_, i) => (
          <div
            key={i}
            className={`slot-row${selected === i ? ' active' : ''}`}
            onClick={() => onSelect(i)}
          >
            <span className="idx">#{slotLabel(i)}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={weights[i] === 0 ? '' : fmtWeight(weights[i])}
              placeholder="0"
              disabled={locked[i]}
              onChange={(e) => onWeightChange(i, e.target.value === '' ? 0 : Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              aria-label={`槽 ${slotLabel(i)} 重量`}
            />
            <button
              type="button"
              className={`lock-btn${locked[i] ? ' locked' : ''}`}
              title={locked[i] ? '点击解锁' : '点击锁定'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(i);
              }}
            >
              {locked[i] ? '🔒' : '🔓'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
