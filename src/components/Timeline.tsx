import type { Project, Selection } from '../types';
import { totalSeconds, type Segment, type UnderSegment } from '../lib/coverage';
import { placeNewInterval, snap } from '../lib/constraints';
import { fmtSec, fmtTick } from '../lib/format';
import BreathBlock from './BreathBlock';

export interface Ghost {
  singerId: string;
  start: number;
  end: number;
}

interface Props {
  project: Project;
  /** 各声部未达标时段（预览时基于预览工程计算） */
  coverage: Map<string, UnderSegment[]>;
  selection: Selection | null;
  ghost: Ghost | null;
  pxPerSec: number;
  onSelect: (sel: Selection | null) => void;
  onUpdateInterval: (singerId: string, intervalId: string, start: number, end: number) => void;
  onAddInterval: (singerId: string, seg: Segment) => void;
}

export default function Timeline(props: Props) {
  const { project, pxPerSec } = props;
  const width = project.duration * pxPerSec;
  const ticks: number[] = [];
  for (let t = 0; t <= project.duration; t++) ticks.push(t);
  const gridStyle = {
    width,
    backgroundImage: 'linear-gradient(to right, rgba(148,163,184,.10) 1px, transparent 1px)',
    backgroundSize: `${5 * pxPerSec}px 100%`,
  };

  return (
    <div className="timeline" onClick={() => props.onSelect(null)}>
      <div className="trow ruler-row">
        <div className="trow-label">时间轴（秒）</div>
        <div className="track ruler" style={{ width }}>
          {ticks.map((t) => (
            <div key={t} className={t % 5 === 0 ? 'tick major' : 'tick minor'} style={{ left: t * pxPerSec }}>
              {t % 5 === 0 && <span>{fmtTick(t)}</span>}
            </div>
          ))}
        </div>
      </div>

      {project.parts.map((part) => {
        const singers = project.singers.filter((s) => s.partId === part.id);
        const under = props.coverage.get(part.id) ?? [];
        const underSec = totalSeconds(under);
        return (
          <div className="part-block" key={part.id}>
            <div className="trow coverage-row">
              <div className="trow-label">
                <span className="dot" style={{ background: part.color }} />
                <span className="part-title">{part.name}</span>
                <span className="part-req">需≥{part.minSingers}人</span>
                <em className={underSec > 0 ? 'bad' : 'ok'}>
                  {underSec > 0 ? `未达标 ${underSec.toFixed(1)}s` : '达标'}
                </em>
              </div>
              <div className="track coverage-track" style={gridStyle}>
                {under.map((seg) => (
                  <div
                    key={`${seg.start}-${seg.end}`}
                    className="under-seg"
                    style={{ left: seg.start * pxPerSec, width: Math.max(2, (seg.end - seg.start) * pxPerSec) }}
                    title={`人数不足 ${fmtSec(seg.start)} – ${fmtSec(seg.end)}\n最少 ${seg.minSinging} 人发声（缺 ${seg.deficit} 人）`}
                  />
                ))}
              </div>
            </div>

            {singers.length === 0 && (
              <div className="trow empty-row">
                <div className="trow-label" />
                <div className="track empty-track" style={{ width }}>
                  该声部暂无歌手，请在左侧添加
                </div>
              </div>
            )}

            {singers.map((singer) => (
              <div className="trow singer-row" key={singer.id}>
                <div className="trow-label">{singer.name}</div>
                <div
                  className="track singer-track"
                  style={gridStyle}
                  onDoubleClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const t = snap((e.clientX - rect.left) / pxPerSec);
                    const seg = placeNewInterval(t, singer.breaths, project.duration);
                    if (seg) props.onAddInterval(singer.id, seg);
                  }}
                >
                  {singer.breaths.map((b) => (
                    <BreathBlock
                      key={b.id}
                      interval={b}
                      others={singer.breaths.filter((o) => o.id !== b.id)}
                      songDuration={project.duration}
                      pxPerSec={pxPerSec}
                      color={part.color}
                      selected={props.selection?.intervalId === b.id}
                      dimmed={props.ghost !== null && props.selection?.intervalId === b.id}
                      onSelect={() => props.onSelect({ singerId: singer.id, intervalId: b.id })}
                      onChange={(s, en) => props.onUpdateInterval(singer.id, b.id, s, en)}
                    />
                  ))}
                  {props.ghost && props.ghost.singerId === singer.id && (
                    <div
                      className="breath-ghost"
                      style={{
                        left: props.ghost.start * pxPerSec,
                        width: Math.max(4, (props.ghost.end - props.ghost.start) * pxPerSec),
                        borderColor: part.color,
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
