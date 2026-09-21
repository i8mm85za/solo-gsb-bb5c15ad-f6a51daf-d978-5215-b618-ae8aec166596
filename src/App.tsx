import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeBalance,
  applySwaps,
  HOLE_COUNTS,
  type BalanceAnalysis,
  type BalanceCandidate,
  type HoleCount,
} from '@shared/balance';
import { RotorView } from './components/RotorView';
import { VectorPanel } from './components/VectorPanel';
import { SlotTable } from './components/SlotTable';
import { RecommendPanel, type RecommendResult } from './components/RecommendPanel';
import { SavedPlansPanel } from './components/SavedPlansPanel';
import { checkHealth, fetchBalance, type AnalysisDTO } from './lib/api';
import {
  deletePlan,
  listPlans,
  loadAutosave,
  saveAutosave,
  savePlan,
  type PlanState,
  type SavedPlan,
} from './lib/storage';
import { demoWeights } from './lib/demo';

function emptyState(holes: HoleCount): { weights: number[]; locked: boolean[] } {
  return { weights: new Array(holes).fill(0), locked: new Array(holes).fill(false) };
}

function dtoToCandidate(dto: AnalysisDTO['best'], weights: number[]): BalanceCandidate {
  const moved = applySwaps(weights, dto.swaps);
  return {
    kind: dto.kind,
    swaps: dto.swaps,
    weights: moved,
    resultant: dto.resultant,
    magnitude: dto.magnitude,
    angle: dto.angle,
  };
}

export function App() {
  const [holes, setHoles] = useState<HoleCount>(8);
  const [weights, setWeights] = useState<number[]>(() => new Array(8).fill(0));
  const [locked, setLocked] = useState<boolean[]>(() => new Array(8).fill(false));
  const [threshold, setThreshold] = useState(0.5);
  const [selected, setSelected] = useState<number | null>(null);

  const [recommend, setRecommend] = useState<RecommendResult | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [hasAutosave, setHasAutosave] = useState(false);

  // 实时配平分析（任何输入变化立即重算）
  const analysis = useMemo(
    () => analyzeBalance({ holes, weights, locked, threshold }),
    [holes, weights, locked, threshold],
  );

  /* ---------- 健康检查 ---------- */
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const ok = await checkHealth();
      if (alive) setServerOnline(ok);
    };
    void ping();
    const timer = setInterval(ping, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  /* ---------- 初始读取本地存储 ---------- */
  useEffect(() => {
    setPlans(listPlans());
    setHasAutosave(!!loadAutosave());
  }, []);

  /* ---------- 自动保存工作状态 ---------- */
  const stateRef = useRef<PlanState>({ holes, weights, locked, threshold });
  stateRef.current = { holes, weights, locked, threshold };
  useEffect(() => {
    const t = setTimeout(() => saveAutosave(stateRef.current), 400);
    return () => clearTimeout(t);
  }, [holes, weights, locked, threshold]);

  // 任何编辑都使旧推荐失效（推荐对应某一快照）
  const invalidate = useCallback(() => setRecommend(null), []);

  /* ---------- 操作 ---------- */
  const changeHoles = (n: HoleCount) => {
    setHoles(n);
    const { weights: w, locked: l } = emptyState(n);
    setWeights(w);
    setLocked(l);
    setSelected(null);
    invalidate();
  };

  const changeWeight = (i: number, value: number) => {
    setWeights((prev) => {
      const next = prev.slice();
      next[i] = Number.isFinite(value) && value > 0 ? value : 0;
      return next;
    });
    invalidate();
  };

  const toggleLock = (i: number) => {
    setLocked((prev) => {
      const next = prev.slice();
      next[i] = !next[i];
      return next;
    });
    invalidate();
  };

  const swapSlots = (a: number, b: number) => {
    if (a === b || locked[a] || locked[b]) return;
    setWeights((prev) => applySwaps(prev, [{ a, b }]));
    invalidate();
  };

  const resetAll = () => {
    const s = emptyState(holes);
    setWeights(s.weights);
    setLocked(s.locked);
    setSelected(null);
    invalidate();
  };

  const lockAllFilled = () => {
    setLocked(weights.map((w) => w > 0));
    invalidate();
  };

  const loadDemo = () => {
    const d = demoWeights(holes);
    setWeights(d.weights);
    setLocked(d.locked);
    setSelected(null);
    invalidate();
  };

  const runRecommend = async () => {
    setRecommending(true);
    // 本地先按同一套共享算法完整计算（含榜单），服务端可用时再以服务端结果为准
    const local = analyzeBalance({ holes, weights, locked, threshold, topLimit: 10 });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const dto = await fetchBalance({
        holes,
        weights,
        locked,
        threshold,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (Math.abs(dto.best.magnitude - local.best.magnitude) > 1e-6) {
        console.warn('[balance] 服务端与本地结果不一致', dto.best, local.best);
      }
      const merged: BalanceAnalysis = {
        ...local,
        balanced: dto.balanced,
        bestCount: dto.bestCount,
        totalCandidates: dto.totalCandidates,
        best: dtoToCandidate(dto.best, weights),
        top: dto.top.map((c) => dtoToCandidate(c, weights)),
      };
      setRecommend({ analysis: merged, source: 'server' });
    } catch {
      clearTimeout(timer);
      // 服务端不可用：浏览器本地同一套算法兜底
      setRecommend({ analysis: local, source: 'local' });
    } finally {
      setRecommending(false);
    }
  };

  const applyCandidate = (c: BalanceCandidate) => {
    if (c.kind === 'none') return;
    const blocked = c.swaps.some((s) => locked[s.a] || locked[s.b]);
    if (blocked) return;
    setWeights((prev) => applySwaps(prev, c.swaps));
    setRecommend(null);
  };

  const handleSavePlan = (name: string) => {
    savePlan(name, { holes, weights, locked, threshold });
    setPlans(listPlans());
    setHasAutosave(true);
  };

  const applyLoadedState = (s: PlanState) => {
    setHoles(s.holes);
    setWeights(s.weights.slice(0, s.holes));
    setLocked(s.locked.slice(0, s.holes));
    setThreshold(s.threshold);
    setSelected(null);
    invalidate();
  };

  const handleLoadPlan = (plan: SavedPlan) => applyLoadedState(plan);

  const handleDeletePlan = (id: string) => {
    deletePlan(id);
    setPlans(listPlans());
  };

  const handleRestoreAutosave = () => {
    const s = loadAutosave();
    if (s) {
      applyLoadedState({
        holes: s.holes,
        weights: s.weights,
        locked: s.locked,
        threshold: s.threshold,
      });
    }
  };

  // 转子上高亮当前推荐的交换
  const highlightSwaps = recommend?.analysis.best.swaps ?? [];

  return (
    <div className="app">
      <header className="app-header">
        <h1>离心机转子配平工作台</h1>
        <span className="subtitle">实时矢量失衡分析 · 至多两次交换枚举推荐</span>
        <div className="header-right">
          <span
            className={`status-dot ${serverOnline ? 'online' : 'offline'}`}
            title={serverOnline ? 'Node 服务端在线' : '服务端不可用，使用本地计算'}
          />
          {serverOnline === null
            ? '检测服务端…'
            : serverOnline
              ? 'Node 服务端在线'
              : '本地计算模式'}
        </div>
      </header>

      <div className="layout">
        {/* 左列：转子 + 录入 */}
        <div>
          <section className="panel">
            <div className="toolbar">
              <label htmlFor="holes-select">转子规格</label>
              <select
                id="holes-select"
                value={holes}
                onChange={(e) => changeHoles(Number(e.target.value) as HoleCount)}
              >
                {HOLE_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n} 孔
                  </option>
                ))}
              </select>

              <label htmlFor="threshold-input">失衡阈值 (g)</label>
              <input
                id="threshold-input"
                type="number"
                min={0}
                step="0.1"
                value={threshold}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setThreshold(Number.isFinite(v) && v >= 0 ? v : 0);
                  invalidate();
                }}
              />

              <button type="button" onClick={loadDemo}>
                载入示例
              </button>
              <button type="button" onClick={lockAllFilled}>
                全部锁定(有试管)
              </button>
              <button type="button" onClick={resetAll} className="danger-text">
                清空
              </button>
            </div>

            <div className="rotor-wrap">
              <RotorView
                holes={holes}
                weights={weights}
                locked={locked}
                selected={selected}
                resultant={analysis.current.resultant}
                magnitude={analysis.current.magnitude}
                angle={analysis.current.angle}
                threshold={threshold}
                highlightSwaps={highlightSwaps}
                onSwap={swapSlots}
                onSelect={setSelected}
              />
            </div>

            <div className="legend">
              <span className="item">
                <span className="swatch" style={{ background: '#1c2634', borderColor: '#44546a' }} />
                未锁定槽
              </span>
              <span className="item">
                <span className="swatch" style={{ background: '#20262f', borderColor: '#5a6472' }} />
                🔒 锁定槽（不可拖动/交换）
              </span>
              <span className="item">
                <span className="swatch" style={{ background: 'transparent', borderColor: '#4da3ff' }} />
                蓝色虚线：推荐交换
              </span>
              <span className="item">
                <span className="swatch" style={{ background: 'transparent', borderColor: '#3fb950' }} />
                绿色/红色箭头：合力方向；虚线圆：阈值
              </span>
            </div>
            <p className="empty-note" style={{ marginTop: 8 }}>
              操作：拖拽两个未锁定槽即可交换重量；也可在下方表格点选槽位后录入重量、切换锁定。
            </p>
          </section>

          <SlotTable
            holes={holes}
            weights={weights}
            locked={locked}
            selected={selected}
            onSelect={setSelected}
            onWeightChange={changeWeight}
            onToggleLock={toggleLock}
          />
        </div>

        {/* 右列：读数 + 推荐 + 保存 */}
        <div>
          <VectorPanel analysis={analysis} />
          <div style={{ marginTop: 16 }}>
            <RecommendPanel
              current={analysis}
              result={recommend}
              loading={recommending}
              onRecommend={() => void runRecommend()}
              onApply={applyCandidate}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <SavedPlansPanel
              plans={plans}
              onSave={handleSavePlan}
              onLoad={handleLoadPlan}
              onDelete={handleDeletePlan}
              onLoadAutosave={handleRestoreAutosave}
              hasAutosave={hasAutosave}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
