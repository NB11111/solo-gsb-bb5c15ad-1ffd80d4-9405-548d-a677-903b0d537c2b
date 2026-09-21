/** 换气区间：半开区间 [start, end)，单位秒。歌手在该区间内不发声。 */
export interface BreathInterval {
  id: string;
  /** 起始秒（含） */
  start: number;
  /** 结束秒（不含） */
  end: number;
}

export interface Singer {
  id: string;
  name: string;
  partId: string;
  breaths: BreathInterval[];
}

export interface VoicePart {
  id: string;
  name: string;
  color: string;
  /** 该声部任意时刻的最低发声人数 */
  minSingers: number;
}

export interface Project {
  name: string;
  /** 全曲时长（秒） */
  duration: number;
  parts: VoicePart[];
  singers: Singer[];
}

/** 当前选中的换气段 */
export interface Selection {
  singerId: string;
  intervalId: string;
}
