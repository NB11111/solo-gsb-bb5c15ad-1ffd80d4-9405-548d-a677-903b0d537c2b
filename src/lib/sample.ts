import type { Project } from '../types';
import { uid } from './storage';

/**
 * 示例工程：96 秒四部合唱。
 * 女高/女低各 3 人（需 ≥2 人发声），男高/男低各 2 人（需 ≥1 人发声），
 * 换气段故意安排了若干重叠，用于演示未达标标红与自动寻优。
 */
export function createSampleProject(): Project {
  const parts = [
    { id: uid(), name: '女高音', color: '#f472b6', minSingers: 2 },
    { id: uid(), name: '女低音', color: '#a78bfa', minSingers: 2 },
    { id: uid(), name: '男高音', color: '#60a5fa', minSingers: 1 },
    { id: uid(), name: '男低音', color: '#34d399', minSingers: 1 },
  ];
  const mk = (name: string, partIdx: number, breaths: [number, number][]) => ({
    id: uid(),
    name,
    partId: parts[partIdx].id,
    breaths: breaths.map(([start, end]) => ({ id: uid(), start, end })),
  });
  return {
    name: '示例 · 四部合唱《远方的风》',
    duration: 96,
    parts,
    singers: [
      mk('王芳', 0, [[18, 21], [44, 47], [70, 73]]),
      mk('李雪', 0, [[19, 22], [50, 53]]),
      mk('赵敏', 0, [[44, 46], [76, 79]]),
      mk('陈静', 1, [[30, 33], [60, 64]]),
      mk('刘洋', 1, [[31, 34]]),
      mk('孙丽', 1, [[60, 63]]),
      mk('周杰', 2, [[40, 43]]),
      mk('吴强', 2, [[41, 44]]),
      mk('郑伟', 3, [[10, 13]]),
      mk('冯磊', 3, [[55, 58]]),
    ],
  };
}
