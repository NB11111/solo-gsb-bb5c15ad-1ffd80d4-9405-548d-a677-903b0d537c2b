import type { Project } from '../types';
import { totalSeconds, type UnderSegment } from '../lib/coverage';
import { MIN_DURATION, clamp } from '../lib/constraints';
import { uid } from '../lib/storage';

interface Props {
  project: Project;
  coverage: Map<string, UnderSegment[]>;
  /** 以不可变方式修改工程（会自动使寻优结果失效） */
  mutate: (fn: (p: Project) => Project) => void;
}

const PALETTE = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#c084fc'];

export default function Sidebar({ project, coverage, mutate }: Props) {
  const setDuration = (raw: string) => {
    const d = Math.round(Number(raw));
    if (!Number.isFinite(d) || d < 10 || d > 3600) return;
    mutate((p) => ({
      ...p,
      duration: d,
      singers: p.singers.map((s) => ({
        ...s,
        breaths: s.breaths
          .map((b) => ({ ...b, start: clamp(b.start, 0, d), end: clamp(b.end, 0, d) }))
          .filter((b) => b.end - b.start >= MIN_DURATION),
      })),
    }));
  };

  const addPart = () =>
    mutate((p) => ({
      ...p,
      parts: [
        ...p.parts,
        {
          id: uid(),
          name: `声部${p.parts.length + 1}`,
          color: PALETTE[p.parts.length % PALETTE.length],
          minSingers: 1,
        },
      ],
    }));

  const removePart = (partId: string) =>
    mutate((p) => ({
      ...p,
      parts: p.parts.filter((x) => x.id !== partId),
      singers: p.singers.filter((s) => s.partId !== partId),
    }));

  const renamePart = (partId: string, name: string) =>
    mutate((p) => ({ ...p, parts: p.parts.map((x) => (x.id === partId ? { ...x, name } : x)) }));

  const setMinSingers = (partId: string, raw: string) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 0 || n > 99) return;
    mutate((p) => ({ ...p, parts: p.parts.map((x) => (x.id === partId ? { ...x, minSingers: n } : x)) }));
  };

  const addSinger = (partId: string) =>
    mutate((p) => {
      const count = p.singers.filter((s) => s.partId === partId).length;
      return {
        ...p,
        singers: [...p.singers, { id: uid(), name: `歌手${count + 1}`, partId, breaths: [] }],
      };
    });

  const removeSinger = (singerId: string) =>
    mutate((p) => ({ ...p, singers: p.singers.filter((s) => s.id !== singerId) }));

  const renameSinger = (singerId: string, name: string) =>
    mutate((p) => ({ ...p, singers: p.singers.map((s) => (s.id === singerId ? { ...s, name } : s)) }));

  return (
    <aside className="sidebar">
      <section className="side-section">
        <h3>🎼 歌曲</h3>
        <label className="field">
          <span>曲名</span>
          <input value={project.name} onChange={(e) => mutate((p) => ({ ...p, name: e.target.value }))} />
        </label>
        <label className="field">
          <span>时长（秒）</span>
          <input
            type="number"
            min={10}
            max={3600}
            value={project.duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </label>
      </section>

      <section className="side-section">
        <h3>🎤 声部与歌手</h3>
        {project.parts.map((part) => {
          const singers = project.singers.filter((s) => s.partId === part.id);
          const underSec = totalSeconds(coverage.get(part.id) ?? []);
          return (
            <div className="part-card" key={part.id}>
              <div className="part-head">
                <span className="dot" style={{ background: part.color }} />
                <input className="part-name" value={part.name} onChange={(e) => renamePart(part.id, e.target.value)} />
                <button className="icon-btn" title="删除该声部及其歌手" onClick={() => removePart(part.id)}>
                  ✕
                </button>
              </div>
              <div className="part-meta">
                <label>
                  最低发声
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={part.minSingers}
                    onChange={(e) => setMinSingers(part.id, e.target.value)}
                  />
                  人
                </label>
                <span className={underSec > 0 ? 'bad' : 'ok'}>
                  {underSec > 0 ? `未达标 ${underSec.toFixed(1)}s` : '全曲达标'}
                </span>
              </div>
              <ul className="singer-list">
                {singers.map((s) => (
                  <li key={s.id}>
                    <input value={s.name} onChange={(e) => renameSinger(s.id, e.target.value)} />
                    <span className="breath-count">{s.breaths.length} 段</span>
                    <button className="icon-btn" title="删除歌手" onClick={() => removeSinger(s.id)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <button className="ghost-btn" onClick={() => addSinger(part.id)}>
                ＋ 添加歌手
              </button>
            </div>
          );
        })}
        <button className="ghost-btn wide" onClick={addPart}>
          ＋ 添加声部
        </button>
      </section>

      <section className="side-section tips">
        <h3>💡 操作提示</h3>
        <ul>
          <li>双击歌手轨道空白处：新增换气段</li>
          <li>拖动换气段：整体移动；拖动两端：调整时长</li>
          <li>点击换气段选中后，可在右下方面板一键寻优</li>
          <li>Delete / Backspace：删除选中的换气段</li>
        </ul>
      </section>
    </aside>
  );
}
