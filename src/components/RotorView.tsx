import { useState } from 'react';
import { slotVector, type Swap, type Vec2 } from '@shared/balance';
import { fmtWeight, slotLabel } from '../lib/format';

interface RotorViewProps {
  holes: number;
  weights: number[];
  locked: boolean[];
  selected: number | null;
  resultant: Vec2;
  magnitude: number;
  angle: number;
  threshold: number;
  highlightSwaps: Swap[];
  onSwap: (a: number, b: number) => void;
  onSelect: (i: number) => void;
}

const CENTER = 220;
const RING_OUT = 200;
const RING_IN = 52;
const SLOT_R = 158;
const NODE_R = 27;
const THRESHOLD_R = 112;

export function RotorView({
  holes,
  weights,
  locked,
  selected,
  resultant,
  magnitude,
  angle,
  threshold,
  highlightSwaps,
  onSwap,
  onSelect,
}: RotorViewProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const nodePos = (i: number): Vec2 => {
    const v = slotVector(i, holes);
    return { x: v.x * SLOT_R, y: v.y * SLOT_R };
  };

  const highlightSet = new Set<number>();
  for (const s of highlightSwaps) {
    highlightSet.add(s.a);
    highlightSet.add(s.b);
  }

  const canDropHere = (i: number) =>
    dragFrom !== null && dragFrom !== i && !locked[dragFrom] && !locked[i];

  const handleDrop = (i: number) => {
    if (canDropHere(i)) onSwap(dragFrom!, i);
    setDragFrom(null);
    setDragOver(null);
  };

  // 合力箭头：阈值圈半径代表阈值大小；合力为 0 时不画
  const over = magnitude > threshold;
  const arrowLen =
    magnitude > 0
      ? Math.min(RING_OUT - 26, (magnitude / Math.max(threshold, 1e-9)) * THRESHOLD_R)
      : 0;
  const arrowEnd: Vec2 = magnitude > 0
    ? {
        x: (resultant.x / magnitude) * arrowLen,
        y: (resultant.y / magnitude) * arrowLen,
      }
    : { x: 0, y: 0 };

  return (
    <svg
      className="rotor-svg"
      viewBox={`0 0 ${CENTER * 2} ${CENTER * 2}`}
      role="img"
      aria-label={`${holes} 孔转子示意图`}
    >
      <defs>
        <radialGradient id="rotorBody" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#2a3342" />
          <stop offset="100%" stopColor="#141a23" />
        </radialGradient>
        <marker
          id="arrowRed"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#f85149" />
        </marker>
        <marker
          id="arrowGreen"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#3fb950" />
        </marker>
      </defs>

      {/* 转子本体 */}
      <circle cx={CENTER} cy={CENTER} r={RING_OUT} fill="url(#rotorBody)" stroke="#33404f" strokeWidth={2} />
      <circle cx={CENTER} cy={CENTER} r={RING_IN} fill="#0d1117" stroke="#33404f" strokeWidth={2} />

      {/* 槽位刻度线 */}
      {Array.from({ length: holes }, (_, i) => {
        const p = nodePos(i);
        return (
          <line
            key={`tick-${i}`}
            x1={CENTER + p.x * 0.83}
            y1={CENTER + p.y * 0.83}
            x2={CENTER + p.x * 0.9}
            y2={CENTER + p.y * 0.9}
            stroke="#3a4656"
            strokeWidth={1}
          />
        );
      })}

      {/* 阈值参考圈（半径表示阈值） */}
      {threshold > 0 && (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={THRESHOLD_R}
          fill="none"
          stroke={over ? '#f85149' : '#3fb950'}
          strokeWidth={1.5}
          strokeDasharray="5 5"
          opacity={0.7}
        />
      )}

      {/* 推荐交换连线 */}
      {highlightSwaps.map((s, k) => {
        const p1 = nodePos(s.a);
        const p2 = nodePos(s.b);
        return (
          <line
            key={`hl-${k}`}
            x1={CENTER + p1.x}
            y1={CENTER + p1.y}
            x2={CENTER + p2.x}
            y2={CENTER + p2.y}
            stroke="#4da3ff"
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.85}
          />
        );
      })}

      {/* 合力箭头 */}
      {magnitude > 0 && (
        <g className="balance-vector">
          <line
            x1={CENTER}
            y1={CENTER}
            x2={CENTER + arrowEnd.x}
            y2={CENTER + arrowEnd.y}
            stroke={over ? '#f85149' : '#3fb950'}
            strokeWidth={3}
            markerEnd={`url(#${over ? 'arrowRed' : 'arrowGreen'})`}
          />
        </g>
      )}

      {/* 中心读数 */}
      <text
        x={CENTER}
        y={CENTER - 8}
        textAnchor="middle"
        fill={over ? '#f85149' : '#3fb950'}
        fontSize={17}
        fontWeight={700}
        fontFamily="SFMono-Regular, Consolas, monospace"
      >
        {magnitude === 0 ? '0' : magnitude.toFixed(2)} g
      </text>
      <text x={CENTER} y={CENTER + 11} textAnchor="middle" fill="#93a0b0" fontSize={11}>
        {magnitude > 0 ? `方向 ${angle.toFixed(1)}°` : '完全平衡'}
      </text>

      {/* 槽位节点 */}
      {Array.from({ length: holes }, (_, i) => {
        const p = nodePos(i);
        const w = weights[i];
        const isLocked = locked[i];
        const isEmpty = w === 0;
        const isSelected = selected === i;
        const isHighlight = highlightSet.has(i);
        const isDragOver = dragOver === i && canDropHere(i);
        const fill = isLocked ? '#20262f' : '#1c2634';
        const stroke = isLocked
          ? '#5a6472'
          : isHighlight
            ? '#4da3ff'
            : isEmpty
              ? '#33404f'
              : '#44546a';

        return (
          <g
            key={`slot-${i}`}
            className={[
              'slot-node',
              isLocked ? 'locked' : '',
              isEmpty ? 'empty' : '',
              dragFrom === i ? 'dragging' : '',
              isDragOver ? 'drop-target' : '',
              isSelected ? 'selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            transform={`translate(${CENTER + p.x}, ${CENTER + p.y})`}
            // SVG 元素的 draggable 不在 React 类型中；锁定槽置 false 使拖拽不触发
            {...({ draggable: !isLocked } as Record<string, boolean>)}
            onDragStart={(e) => {
              if (isLocked) {
                e.preventDefault();
                return;
              }
              setDragFrom(i);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(i));
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDragOver(null);
            }}
            onDragOver={(e) => {
              if (canDropHere(i)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOver(i);
              }
            }}
            onDragLeave={() => setDragOver((cur) => (cur === i ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(i);
            }}
            onClick={() => onSelect(i)}
          >
            <circle className="outer" r={NODE_R} fill={fill} stroke={stroke} strokeWidth={2} />
            <text className="slot-num" y={-8}>
              {slotLabel(i)}
            </text>
            <text className="slot-weight" y={9}>
              {fmtWeight(w)}
            </text>
            {isLocked && (
              <text x={NODE_R - 4} y={-NODE_R + 9} fontSize={12} textAnchor="middle">
                🔒
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
