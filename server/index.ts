import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  analyzeBalance,
  isValidHoleCount,
  TOP_LIMIT,
  type BalanceAnalysis,
  type Swap,
} from '../shared/balance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'centrifuge-balance-bench' });
});

interface BalanceRequestBody {
  holes?: unknown;
  weights?: unknown;
  locked?: unknown;
  threshold?: unknown;
}

app.post('/api/balance', (req, res) => {
  const body = (req.body ?? {}) as BalanceRequestBody;

  if (!isValidHoleCount(body.holes)) {
    res.status(400).json({ error: 'holes 必须为 8、12 或 24' });
    return;
  }
  const holes = body.holes;

  if (!Array.isArray(body.weights) || body.weights.length !== holes) {
    res.status(400).json({ error: `weights 必须是长度 ${holes} 的数组` });
    return;
  }
  const weights = body.weights.map((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  });

  let locked: boolean[];
  if (body.locked === undefined) {
    locked = new Array(holes).fill(false);
  } else if (Array.isArray(body.locked) && body.locked.length === holes) {
    locked = body.locked.map((v) => !!v);
  } else {
    res.status(400).json({ error: `locked 必须是长度 ${holes} 的数组` });
    return;
  }

  const threshold = Number(body.threshold);
  if (!Number.isFinite(threshold) || threshold < 0) {
    res.status(400).json({ error: 'threshold 必须为非负数字' });
    return;
  }

  const analysis = analyzeBalance({
    holes,
    weights,
    locked,
    threshold,
    topLimit: TOP_LIMIT,
  });

  // 服务端响应仅携带展示所需字段，避免重复下发每个候选的完整重量数组
  res.json(serializeAnalysis(analysis));
});

interface CandidateDTO {
  kind: string;
  swaps: Swap[];
  magnitude: number;
  angle: number;
  resultant: { x: number; y: number };
}

interface AnalysisDTO {
  holes: number;
  threshold: number;
  balanced: boolean;
  current: CandidateDTO;
  best: CandidateDTO;
  bestCount: number;
  totalCandidates: number;
  top: CandidateDTO[];
}

function toCandidateDTO(c: BalanceAnalysis['current']): CandidateDTO {
  return {
    kind: c.kind,
    swaps: c.swaps,
    magnitude: c.magnitude,
    angle: c.angle,
    resultant: c.resultant,
  };
}

function serializeAnalysis(a: BalanceAnalysis): AnalysisDTO {
  return {
    holes: a.holes,
    threshold: a.threshold,
    balanced: a.balanced,
    current: toCandidateDTO(a.current),
    best: toCandidateDTO(a.best),
    bestCount: a.bestCount,
    totalCandidates: a.totalCandidates,
    top: a.top.map(toCandidateDTO),
  };
}

// 静态资源（生产构建产物）
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .send(
        'API 已启动，但尚未构建前端。开发模式请运行 npm run dev（前端 http://localhost:5173）。',
      );
  });
}

app.listen(PORT, () => {
  console.log(`[centrifuge-balance-bench] listening on http://0.0.0.0:${PORT}`);
});
