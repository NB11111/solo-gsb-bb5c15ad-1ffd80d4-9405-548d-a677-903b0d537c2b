import { sampleProject } from '../src/lib/sample'
import {
  breathLoadSegments,
  buildMoveDiff,
  deficientSeconds,
  deficientSegments,
  enumerateCandidates,
  nearestFreeStart,
  overlaps,
  totalDeficientSeconds,
} from '../src/lib/logic'

let failures = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    console.log(`  ok - ${name}`)
  } else {
    failures++
    console.error(`  FAIL - ${name} ${extra}`)
  }
}

// 1. 半开区间：端点相接不重叠
check('[2,5) 与 [5,8) 不重叠', !overlaps({ start: 2, end: 5 }, { start: 5, end: 8 }))
check('[2,5) 与 [4,6) 重叠', overlaps({ start: 2, end: 5 }, { start: 4, end: 6 }))

// 2. nearestFreeStart
const f = [{ start: 4, end: 8 }]
check('空位吸附 5 -> 5 (len3, [5,8) 与 [4,8) 重叠)', nearestFreeStart(5, 3, 20, f) === 8)
check('目标 0 保持', nearestFreeStart(0, 3, 20, f) === 0)
check('无处可放返回 null', nearestFreeStart(0, 3, 5, [{ start: 0, end: 5 }]) === null)
check('平局取更早：目标 2 两侧等距', nearestFreeStart(2, 2, 8, [{ start: 0, end: 1 }, { start: 3, end: 4 }]) === 1 ? true : (() => { console.log('    got', nearestFreeStart(2, 2, 8, [{ start: 0, end: 1 }, { start: 3, end: 4 }])); return false })())

// 3. 示例数据：女高有不足，总量与预期一致
const proj = sampleProject()
const s = proj.parts[0]
const segs = deficientSegments(s, proj.duration)
console.log('  S 不足区间:', JSON.stringify(segs))
// 张三[10,13) 王五[11,14)：11、12 秒 2 人换气，4-2=2 发声 < 3；
// 第 13 秒张三已唱完（半开区间不含 13），故不足区间为 [11,13)
check('女高不足区间为 [11,13)', segs.length === 1 && segs[0].start === 11 && segs[0].end === 13)
check('女高不足 2 秒', deficientSeconds(s, proj.duration) === 2)
check('全曲未达标 2 秒（女低男高均达标）', totalDeficientSeconds(proj) === 2)

// 4. 穷举：张三 [10,13) ±5s，最优应使总不足降为 0，且为 [8,11)（位移2，
//    与王五 [11,14) 端点相接），比 [5,8)（位移5）更优
const r = enumerateCandidates(proj, 'part_s', 's1', 's1b1', 5)!
check('候选数量 > 0', r.candidates.length > 0, `got ${r.candidates.length}`)
const best = r.candidates[0]
console.log('  最优候选:', best)
check('最优未达标=0', best.deficientSeconds === 0)
check('最优起点为 8（位移2）', best.start === 8 && best.end === 11, JSON.stringify(best))
// 当前位置 [10,13) 的候选
const cur = r.candidates.find((c) => c.isCurrent)!
check('当前位置对应不足 2 秒', cur.deficientSeconds === 2)
// 不能与本人其他段 [28,30) 重叠：±5 范围 [5,15] 本来就不碰
// 排序稳定性：所有 deficientSeconds=0 的候选中位移最小优先，平局更早优先
const zeroOnes = r.candidates.filter((c) => c.deficientSeconds === 0)
check('平局排序：位移最小', zeroOnes[0].displacement <= zeroOnes[1].displacement)

// 5. 大范围 ±20 时，28-30 区间会阻挡 [28,30) 的放置
const r2 = enumerateCandidates(proj, 'part_s', 's1', 's1b1', 20)!
const bad = r2.candidates.find((c) => c.start === 28 || c.start === 27 || c.start === 29)
check('与本人 [28,30) 重叠的起点被排除', bad === undefined, JSON.stringify(bad))
// 但 [25,28) 合法
check('[25,28) 合法', r2.candidates.some((c) => c.start === 25))

// 6. buildMoveDiff
const diff = buildMoveDiff(proj, 'part_s', 's1', 's1b1', best)
check('diff before=2 after=0', diff.beforeTotal === 2 && diff.afterTotal === 0)
check('diff 中女高 before 2 after 0', diff.parts[0].beforeSeconds === 2 && diff.parts[0].afterSeconds === 0)

// 7. 覆盖计数：合并相邻相同值
const load = breathLoadSegments(s, proj.duration)
// 找到 [11,13) value=2
const peak = load.find((x) => x.start === 11)
check('换气负载 [11,13)=2', !!peak && peak.end === 13 && peak.value === 2, JSON.stringify(peak))

// 8. 越界约束：range=0 只有当前位置
const r0 = enumerateCandidates(proj, 'part_s', 's1', 's1b1', 0)!
check('±0 仅 1 个候选且为当前', r0.candidates.length === 1 && r0.candidates[0].isCurrent)

// 9. 边界处的段
const edgeProj = structuredClone(proj)
// 把 s2 [2,6) 移到 [0,3) 穷举 ±3
;(edgeProj.parts[0].singers[1].breaths[0] as any).start = 0
;(edgeProj.parts[0].singers[1].breaths[0] as any).end = 3
const re = enumerateCandidates(edgeProj, 'part_s', 's2', 's2b1', 3)!
check('起点不能为负', re.candidates.every((c) => c.start >= 0))
check('包含当前 0', re.candidates.some((c) => c.isCurrent && c.start === 0))

// 10. 三级排序：当前位置之后，位移相同（均为 1）且未达标相同时，更早起点优先
const tieProj: any = {
  title: 't',
  duration: 20,
  parts: [
    {
      id: 'p',
      name: 'P',
      color: '#fff',
      minSounding: 1,
      singers: [
        { id: 'a', name: 'A', breaths: [{ id: 'ab', start: 10, end: 12 }] },
        { id: 'b', name: 'B', breaths: [] },
      ],
    },
  ],
}
const rt = enumerateCandidates(tieProj, 'p', 'a', 'ab', 2)!
// 当前 10(disp0) 最先；其后 disp1 的两个位置 9、11 中 9 应排在前
check('平局取更早：9 排在 11 前', rt.candidates[1].start === 9 && rt.candidates[2].start === 11,
  JSON.stringify(rt.candidates.map((c) => c.start)))

console.log(failures === 0 ? '\n全部通过 ✔' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
