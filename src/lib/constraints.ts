import type { Segment } from './coverage';

export const MIN_DURATION = 0.5;

const EPS = 1e-6;

/** 吸附到 0.1 秒 */
export const snap = (v: number) => Math.round(v * 10) / 10;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 拖动整个区间时，起点的合法范围（不越界、不与同歌手其它区间重叠）。 */
export function moveRange(start: number, end: number, others: Segment[], songDuration: number) {
  const dur = end - start;
  let lo = 0;
  let hi = Math.max(0, songDuration - dur);
  for (const o of others) {
    if (o.end <= start + EPS) lo = Math.max(lo, o.end);
    else if (o.start >= end - EPS) hi = Math.min(hi, o.start - dur);
  }
  return { lo, hi: Math.max(lo, hi) };
}

/** 拖动左边缘（改变起点）时的合法范围。 */
export function resizeLeftRange(start: number, end: number, others: Segment[]) {
  let lo = 0;
  for (const o of others) {
    if (o.end <= start + EPS) lo = Math.max(lo, o.end);
  }
  return { lo, hi: end - MIN_DURATION };
}

/** 拖动右边缘（改变终点）时的合法范围。 */
export function resizeRightRange(start: number, end: number, others: Segment[], songDuration: number) {
  let hi = songDuration;
  for (const o of others) {
    if (o.start >= end - EPS) hi = Math.min(hi, o.start);
  }
  return { lo: start + MIN_DURATION, hi };
}

/** 在 t 所在的空隙放置一个默认时长的新换气段；放不下则返回 null。 */
export function placeNewInterval(t: number, others: Segment[], songDuration: number, dur = 2): Segment | null {
  const sorted = others.slice().sort((a, b) => a.start - b.start);
  const gaps: { lo: number; hi: number }[] = [];
  let cursor = 0;
  for (const o of sorted) {
    if (o.start > cursor) gaps.push({ lo: cursor, hi: o.start });
    cursor = Math.max(cursor, o.end);
  }
  if (cursor < songDuration) gaps.push({ lo: cursor, hi: songDuration });

  const gap = gaps.find((g) => t >= g.lo - EPS && t <= g.hi + EPS);
  if (!gap || gap.hi - gap.lo < MIN_DURATION) return null;
  const d = Math.min(dur, gap.hi - gap.lo);
  const start = clamp(t, gap.lo, gap.hi - d);
  return { start, end: start + d };
}
