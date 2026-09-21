import { underCoveredSegments, totalSeconds, mergeSegments } from '../src/lib/coverage';
import { findBestMove } from '../src/lib/optimize';
import { createSampleProject } from '../src/lib/sample';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

// 1. 半开区间相邻不重叠：[0,2) 与 [2,4) 同一时刻最多 1 人换气 → 2 人声部 min 1 达标
check('half-open adjacency', underCoveredSegments([{ start: 0, end: 2 }, { start: 2, end: 4 }], 2, 1, 10), []);

// 2. 合并相接的不足时段：3 人 min 2（允许 1 人换气），[0,2)[1,3)[2,4) → [1,3)
{
  const segs = underCoveredSegments(
    [{ start: 0, end: 2 }, { start: 1, end: 3 }, { start: 2, end: 4 }],
    3, 2, 10,
  );
  check('merge touching', segs.map((s) => [s.start, s.end]), [[1, 3]]);
  check('merge stats', [segs[0].minSinging, segs[0].deficit], [1, 1]);
}

// 3. 歌手总数低于最低要求 → 全曲不足
{
  const segs = underCoveredSegments([], 1, 2, 10);
  check('always short', segs.map((s) => [s.start, s.end, s.deficit]), [[0, 10, 1]]);
}

// 4. minSingers = 0 → 无要求
check('no requirement', underCoveredSegments([{ start: 0, end: 5 }], 1, 0, 10), []);

// 5. 示例工程基线：女高 4s + 女低 5s + 男高 2s = 11s
{
  const p = createSampleProject();
  const perPart = p.parts.map((part) => {
    const breaths = p.singers.filter((s) => s.partId === part.id).flatMap((s) => s.breaths);
    const n = p.singers.filter((s) => s.partId === part.id).length;
    return totalSeconds(underCoveredSegments(breaths, n, part.minSingers, p.duration));
  });
  check('sample per-part under', perPart, [4, 5, 2, 0]);
  check('sample baseline', perPart.reduce((a, b) => a + b, 0), 11);
}

// 6. 寻优：李雪 [19,22) ±10 → 最优 +2s，全曲未达标 11 → 9
{
  const p = createSampleProject();
  const li = p.singers.find((s) => s.name === '李雪')!;
  const iv = li.breaths[0]; // [19,22)
  const r = findBestMove(p, li.id, iv.id, 10)!;
  check('optimize baseline', r.baseline, 11);
  check('optimize best offset', r.best.offset, 2);
  check('optimize best under', r.best.underSeconds, 9);
  check('optimize best range', [r.best.start, r.best.end], [21, 24]);
  check('optimize current', r.current.offset, 0);
}

// 7. 寻优平局取更早时刻：赵敏 [44,46) ±10 → -2 与 +3 同为 9s，|−2| 更小 → -2
{
  const p = createSampleProject();
  const zhao = p.singers.find((s) => s.name === '赵敏')!;
  const iv = zhao.breaths[0]; // [44,46)
  const r = findBestMove(p, zhao.id, iv.id, 10)!;
  check('tie-break offset', r.best.offset, -2);
  check('tie-break under', r.best.underSeconds, 9);
}

// 8. 寻优不重叠约束：移动后不得与同歌手其它区间重叠（王芳 [18,21) 不能移到 [44,47) 附近）
{
  const p = createSampleProject();
  const wang = p.singers.find((s) => s.name === '王芳')!;
  const iv = wang.breaths[0]; // [18,21)
  const r = findBestMove(p, wang.id, iv.id, 30)!;
  const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE;
  const bad = r.candidates.filter((c) =>
    wang.breaths.filter((b) => b.id !== iv.id).some((o) => overlaps(c.start, c.end, o.start, o.end)),
  );
  check('no-overlap candidates', bad.length, 0);
  check('overlap skipped counted', r.infeasible.overlap > 0, true);
}

// 9. 边界：区间不能移出 [0, duration)
{
  const p = createSampleProject();
  const zheng = p.singers.find((s) => s.name === '郑伟')!;
  const iv = zheng.breaths[0]; // [10,13)
  const r = findBestMove(p, zheng.id, iv.id, 20)!;
  const out = r.candidates.filter((c) => c.start < 0 || c.end > p.duration);
  check('bounds respected', out.length, 0);
  check('bounds skipped counted', r.infeasible.bounds > 0, true);
}

// 10. mergeSegments 基本行为
check(
  'mergeSegments',
  mergeSegments([{ start: 5, end: 6 }, { start: 1, end: 2 }, { start: 2, end: 3 }, { start: 2.5, end: 4 }]),
  [{ start: 1, end: 4 }, { start: 5, end: 6 }],
);

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
