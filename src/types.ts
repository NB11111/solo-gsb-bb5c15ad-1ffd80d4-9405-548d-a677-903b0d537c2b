// 数据模型：所有时间均为统一秒轴上的整数秒，区间一律使用半开区间 [start, end)

/** 一位歌手的一次换气区间 */
export interface Breath {
  id: string
  start: number
  end: number
}

/** 歌手 */
export interface Singer {
  id: string
  name: string
  breaths: Breath[]
}

/** 声部 */
export interface Part {
  id: string
  name: string
  color: string
  /** 该声部最低发声人数：每秒正在发声（即未在换气）的歌手数不得低于此值 */
  minSounding: number
  singers: Singer[]
}

/** 整个排练工程 */
export interface Project {
  title: string
  /** 全曲总时长（秒），时间轴范围 [0, duration) */
  duration: number
  parts: Part[]
}

/** 选中目标 */
export interface Selection {
  partId: string
  singerId: string
  breathId: string
}

/** 半开区间 */
export interface Segment {
  start: number
  end: number
}

/** 带数值的区间（如某秒正在换气的人数） */
export interface RatedSegment extends Segment {
  value: number
}

/** 穷举出的一个候选位置 */
export interface Candidate {
  start: number
  end: number
  /** 应用后全曲未达标总秒数 */
  deficientSeconds: number
  /** 相对当前位置的位移量（秒） */
  displacement: number
  /** 是否与当前位置一致 */
  isCurrent: boolean
}

/** 移动某换气段前后，一个声部的对比结果 */
export interface PartDiff {
  partId: string
  partName: string
  color: string
  before: RatedSegment[]
  after: RatedSegment[]
  beforeSeconds: number
  afterSeconds: number
}

/** 移动前后的完整对比 */
export interface MoveDiff {
  beforeTotal: number
  afterTotal: number
  parts: PartDiff[]
}
