import { useState } from 'react';
import type { SavedPlan } from '../lib/storage';
import { formatTime } from '../lib/format';

interface SavedPlansPanelProps {
  plans: SavedPlan[];
  onSave: (name: string) => void;
  onLoad: (plan: SavedPlan) => void;
  onDelete: (id: string) => void;
  onLoadAutosave: () => void;
  hasAutosave: boolean;
}

export function SavedPlansPanel({
  plans,
  onSave,
  onLoad,
  onDelete,
  onLoadAutosave,
  hasAutosave,
}: SavedPlansPanelProps) {
  const [name, setName] = useState('');

  return (
    <section className="panel">
      <h2>
        方案保存 / 载入
        <span className="hint">存储于浏览器 localStorage</span>
      </h2>

      <div className="save-row">
        <input
          type="text"
          placeholder="方案名称，如 8孔-批次A"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              onSave(name.trim());
              setName('');
            }
          }}
        />
        <button
          type="button"
          className="primary"
          disabled={!name.trim()}
          onClick={() => {
            onSave(name.trim());
            setName('');
          }}
        >
          保存
        </button>
      </div>

      {hasAutosave && (
        <div className="saved-item">
          <div className="meta">
            <div className="name">上次工作状态（自动保存）</div>
          </div>
          <button type="button" onClick={onLoadAutosave}>
            恢复
          </button>
        </div>
      )}

      {plans.length === 0 ? (
        <p className="empty-note">尚无已保存方案。</p>
      ) : (
        plans.map((p) => (
          <div key={p.id} className="saved-item">
            <div className="meta">
              <div className="name">{p.name}</div>
              <div className="sub">
                {p.holes} 孔 · 阈值 {p.threshold} g · 锁定 {p.locked.filter(Boolean).length} ·{' '}
                {formatTime(p.savedAt)}
              </div>
            </div>
            <button type="button" onClick={() => onLoad(p)}>
              载入
            </button>
            <button type="button" className="danger-text" onClick={() => onDelete(p.id)}>
              删除
            </button>
          </div>
        ))
      )}
    </section>
  );
}
