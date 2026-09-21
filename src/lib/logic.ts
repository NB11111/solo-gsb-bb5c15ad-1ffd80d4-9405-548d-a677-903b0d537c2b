import type {
  Breath,
  Candidate,
  MoveDiff,
  Part,
  Project,
  RatedSegment,
  Segment,
  Singer,
} from '../types'

/** 两个半开区间是否重叠（端点相接不算重叠） */
export function overlaps(a: Segment, b: Segment): boolean {
  return a.start < b.end && b.start < a.end
}

export function segLength(s: Segment): number {
  return s.end - s.start
}

/** 把 [start, end) 限制在 [0, duration) 内 */
function clampSeg(start: number, end: number, duration: number): Segment {
  return {
    start: Math.max(0, Math.min(start, duration)),
    end: Math.max(0, Math.min(end, duration)),
  }
}

/** 把相邻/重叠且数值相同的区间合并 */
export function mergeAdjacent(segs: RatedSegment[]): RatedSegment[] {
  const sorted = [...segs].sort((a, b) => a.start - b.start || a.end - b.end)
  const out: RatedSegment[] = []
  for (const s of sorted) {
    if (s.end <= s.start) continue
    const last = out[out.length - 1]
    if (last && last.value === s.value && last.end === s.start) {
      last.end = s.end
    } else {
      out.push({ ...s })
    }
  }
  return out
}

/**
 * 逐秒统计一个声部中正在换气的人数，并合并为连续区间。
 * 每位歌手同一秒至多换气一次（区间互不重叠的前提下）。
 */
export function breathLoadSegments(part: Part, duration: number): RatedSegment[] {
  const load = new Array<number>(duration).fill(0)
  for (const singer of part.singers) {
    for (const b of singer.breaths) {
      for (let t = b.start; t < b.end; t++) {
        if (t >= 0 && t < duration) load[t]++
      }
    }
  }
  const segs: RatedSegment[] = []
  let t = 0
  while (t < duration) {
    const value = load[t]
    let end = t + 1
    while (end < duration && load[end] === value) end++
    segs.push({ start: t, end, value })
    t = end
  }
  return mergeAdjacent(segs)
}

/**
 * 一个声部的未达标区间：正在发声人数 = 总人数 - 换气人数 < 最低发声人数。
 * 即换气人数 > totalSingers - minSounding。
 */
export function deficientSegments(part: Part, duration: number): RatedSegment[] {
  const threshold = part.singers.length - part.minSounding
  return breathLoadSegments(part, duration).filter(
    (s) => s.value > threshold,
  )
}

/** 未达标区间总秒数 */
export function deficientSeconds(part: Part, duration: number): number {
  return deficientSegments(part, duration).reduce(
    (acc, s) => acc + segLength(s),
    0,
  )
}

/** 全曲未达标总秒数（各声部未达标秒数之和，同秒多个声部不足会累计） */
export function totalDeficientSeconds(project: Project): number {
  return project.parts.reduce(
    (acc, p) => acc + deficientSeconds(p, project.duration),
    0,
  )
}

/**
 * 在 [0, duration] 上寻找放置长度为 length 的区间的整数起点，
 * 使其不与 forbidden 中任何区间重叠，并尽量靠近 preferredStart。
 * 找不到（含长度非法）时返回 null。
 */
export function nearestFreeStart(
  preferredStart: number,
  length: number,
  duration: number,
  forbidden: Segment[],
): number | null {
  if (length <= 0 || length > duration) return null
  const blocked = forbidden
    .map((f) => clampSeg(f.start, f.end, duration))
    .filter((f) => f.end > f.start)
    .sort((a, b) => a.start - b.start)

  // 自由窗口（候选起点 s 的区间 [s, s+length) 必须整体落在窗口内）
  const windows: Segment[] = []
  let cursor = 0
  for (const b of blocked) {
    if (b.start > cursor) windows.push({ start: cursor, end: b.start })
    cursor = Math.max(cursor, b.end)
  }
  if (cursor < duration) windows.push({ start: cursor, end: duration })

  let best: number | null = null
  let bestDist = Infinity
  for (const w of windows) {
    if (w.end - w.start < length) continue
    // 窗口内距 preferredStart 最近的起点；平局取更早（较小）者
    const s = Math.max(w.start, Math.min(preferredStart, w.end - length))
    const dist = Math.abs(s - preferredStart)
    if (dist < bestDist || (dist === bestDist && best !== null && s < best)) {
      best = s
      bestDist = dist
    }
  }
  return best
}

/**
 * 穷举移动选中换气段的所有可行位置：
 * 起点取 [curStart - range, curStart + range] 内的整数，
 * 保持时长不变，区间整体位于 [0, duration]，且不与该歌手的其他区间重叠。
 * 候选依次按「应用后全曲未达标总秒数 → 位移量 → 更早时刻」排序。
 */
export function enumerateCandidates(
  project: Project,
  partId: string,
  singerId: string,
  breathId: string,
  range: number,
): { candidates: Candidate[]; part: Part; singer: Singer; breath: Breath } | null {
  const part = project.parts.find((p) => p.id === partId)
  const singer = part?.singers.find((s) => s.id === singerId)
  const breath = singer?.breaths.find((b) => b.id === breathId)
  if (!part || !singer || !breath) return null

  const length = breath.end - breath.start
  const others = singer.breaths
    .filter((b) => b.id !== breathId)
    .map((b) => ({ start: b.start, end: b.end }))

  const lo = Math.max(0, breath.start - range)
  const hi = Math.min(breath.start + range, project.duration - length)

  const candidates: Candidate[] = []
  for (let s = lo; s <= hi; s++) {
    const trial = { start: s, end: s + length }
    if (others.some((o) => overlaps(trial, o))) continue
    const moved: Project = {
      ...project,
      parts: project.parts.map((p) =>
        p.id !== partId
          ? p
          : {
              ...p,
              singers: p.singers.map((sg) =>
                sg.id !== singerId
                  ? sg
                  : {
                      ...sg,
                      breaths: sg.breaths.map((b) =>
                        b.id === breathId ? { ...b, start: s, end: s + length } : b,
                      ),
                    },
              ),
            },
      ),
    }
    candidates.push({
      start: s,
      end: s + length,
      deficientSeconds: totalDeficientSeconds(moved),
      displacement: Math.abs(s - breath.start),
      isCurrent: s === breath.start,
    })
  }

  candidates.sort(
    (a, b) =>
      a.deficientSeconds - b.deficientSeconds ||
      a.displacement - b.displacement ||
      a.start - b.start,
  )
  return { candidates, part, singer, breath }
}

/** 把一条换气段替换为候选位置后，各声部未达标区间的前后差异 */
export function buildMoveDiff(
  project: Project,
  partId: string,
  singerId: string,
  breathId: string,
  candidate: Candidate,
): MoveDiff {
  const before = totalDeficientSeconds(project)
  const parts: MoveDiff['parts'] = project.parts.map((p) => {
    const beforeSegs = deficientSegments(p, project.duration)
    const movedPart =
      p.id !== partId
        ? p
        : {
            ...p,
            singers: p.singers.map((sg) =>
              sg.id !== singerId
                ? sg
                : {
                    ...sg,
                    breaths: sg.breaths.map((b) =>
                      b.id === breathId
                        ? { ...b, start: candidate.start, end: candidate.end }
                        : b,
                    ),
                  },
            ),
          }
    const afterSegs = deficientSegments(movedPart, project.duration)
    return {
      partId: p.id,
      partName: p.name,
      color: p.color,
      before: beforeSegs,
      after: afterSegs,
      beforeSeconds: beforeSegs.reduce((a, s) => a + segLength(s), 0),
      afterSeconds: afterSegs.reduce((a, s) => a + segLength(s), 0),
    }
  })
  return {
    beforeTotal: before,
    afterTotal: parts.reduce((a, p) => a + p.afterSeconds, 0),
    parts,
  }
}

/** 人类可读的区间描述，如 12.0s–15.0s */
export function fmtSeg(s: Segment): string {
  return `${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s`
}
