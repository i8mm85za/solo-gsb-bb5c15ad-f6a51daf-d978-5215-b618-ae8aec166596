/** 重量/矢量数值的统一显示格式，避免 -0 与过长小数 */
export function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '0';
  const v = Math.abs(n) < 0.5 * 10 ** -digits ? 0 : n;
  return v.toFixed(digits).replace(/\.?0+$/, '');
}

export function fmtWeight(n: number): string {
  return n === 0 ? '0' : fmt(n, 2);
}

/** 0 起槽号 → 展示用 1 起槽号 */
export function slotLabel(i: number): number {
  return i + 1;
}

/** 交换对的可读描述，如 “#3 ↔ #7” */
export function swapLabel(a: number, b: number): string {
  return `#${slotLabel(a)} ↔ #${slotLabel(b)}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
