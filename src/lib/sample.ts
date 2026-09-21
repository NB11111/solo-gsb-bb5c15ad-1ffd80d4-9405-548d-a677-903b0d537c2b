import type { Project } from '../types'

/**
 * 示例：40 秒片段，女高 / 女低 / 男高 三个声部，每声部 4 人、最低发声 3 人。
 * 女高声部张三 [10,13) 与王五 [11,14) 在 11–13s 换气撞车导致人数不足。
 * 选中张三该换气段，取 ±5s 穷举即可找到把全曲未达标总秒数降为 0 的
 * 最佳位置 [8,11)（与王五区间端点相接，位移仅 2 秒）。
 */
export function sampleProject(): Project {
  return {
    title: '示例 · 40 秒合唱片段',
    duration: 40,
    parts: [
      {
        id: 'part_s',
        name: '女高 S',
        color: '#e85d75',
        minSounding: 3,
        singers: [
          {
            id: 's1',
            name: '张三',
            breaths: [
              { id: 's1b1', start: 10, end: 13 },
              { id: 's1b2', start: 28, end: 30 },
            ],
          },
          { id: 's2', name: '李四', breaths: [{ id: 's2b1', start: 2, end: 6 }] },
          { id: 's3', name: '王五', breaths: [{ id: 's3b1', start: 11, end: 14 }] },
          { id: 's4', name: '赵六', breaths: [{ id: 's4b1', start: 30, end: 33 }] },
        ],
      },
      {
        id: 'part_a',
        name: '女低 A',
        color: '#f0a04b',
        minSounding: 3,
        singers: [
          { id: 'a1', name: '钱七', breaths: [{ id: 'a1b1', start: 4, end: 8 }] },
          { id: 'a2', name: '孙八', breaths: [{ id: 'a2b1', start: 12, end: 15 }] },
          { id: 'a3', name: '周九', breaths: [{ id: 'a3b1', start: 20, end: 23 }] },
          { id: 'a4', name: '吴十', breaths: [{ id: 'a4b1', start: 28, end: 31 }] },
        ],
      },
      {
        id: 'part_t',
        name: '男高 T',
        color: '#3a86ff',
        minSounding: 3,
        singers: [
          { id: 't1', name: '郑一', breaths: [{ id: 't1b1', start: 6, end: 9 }] },
          { id: 't2', name: '王二', breaths: [{ id: 't2b1', start: 16, end: 19 }] },
          { id: 't3', name: '冯三', breaths: [{ id: 't3b1', start: 24, end: 27 }] },
          { id: 't4', name: '陈四', breaths: [{ id: 't4b1', start: 33, end: 36 }] },
        ],
      },
    ],
  }
}
