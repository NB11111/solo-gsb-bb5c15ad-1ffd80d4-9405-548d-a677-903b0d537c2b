import { useEffect, useState, type ReactElement } from 'react'
import type { Breath, Project, Selection } from '../types'
import { deficientSegments, nearestFreeStart } from '../lib/logic'

interface TimelineProps {
  project: Project
  selection: Selection | null
  pxPerSec: number
  onSelect: (sel: Selection | null) => void
  onUpdateBreath: (
    partId: string,
    singerId: string,
    breathId: string,
    start: number,
    end: number,
  ) => void
  onAddBreath: (partId: string, singerId: string, second: number) => void
  onRenameSinger: (partId: string, singerId: string, name: string) => void
  onRemoveSinger: (partId: string, singerId: string) => void
  onAddSinger: (partId: string) => void
  onRenamePart: (partId: string, name: string) => void
  onChangeMinSounding: (partId: string, min: number) => void
  onRemovePart: (partId: string) => void
}

type DragMode = 'move' | 'left' | 'right'

interface DragState {
  partId: string
  singerId: string
  breathId: string
  mode: DragMode
  startX: number
  origStart: number
  origEnd: number
  ghostStart: number
  ghostEnd: number
}

const LABEL_W = 150

export default function Timeline(props: TimelineProps) {
  const { project, selection, pxPerSec } = props
  const [drag, setDrag] = useState<DragState | null>(null)
  const width = project.duration * pxPerSec

  // 全曲未达标时段：任一声部不足即标红（并集）
  const globalBad: { start: number; end: number }[] = (() => {
    const hit = new Array<boolean>(project.duration).fill(false)
    for (const part of project.parts) {
      for (const seg of deficientSegments(part, project.duration)) {
        for (let t = seg.start; t < seg.end; t++) hit[t] = true
      }
    }
    const out: { start: number; end: number }[] = []
    let t = 0
    while (t < project.duration) {
      if (!hit[t]) {
        t++
        continue
      }
      let end = t + 1
      while (end < project.duration && hit[end]) end++
      out.push({ start: t, end })
      t = end
    }
    return out
  })()

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const delta = Math.round((e.clientX - drag.startX) / pxPerSec)
      const part = project.parts.find((p) => p.id === drag.partId)
      const singer = part?.singers.find((s) => s.id === drag.singerId)
      if (!part || !singer) return
      const others = singer.breaths
        .filter((b) => b.id !== drag.breathId)
        .map((b) => ({ start: b.start, end: b.end }))
      const length = drag.origEnd - drag.origStart

      if (drag.mode === 'move') {
        const wanted = Math.max(
          0,
          Math.min(drag.origStart + delta, project.duration - length),
        )
        const free = nearestFreeStart(wanted, length, project.duration, others)
        if (free !== null)
          setDrag({ ...drag, ghostStart: free, ghostEnd: free + length })
      } else if (drag.mode === 'left') {
        // 左边界右移不能越过右边界-1；左移不能撞上左侧换气段
        const leftBlock = others
          .filter((o) => o.end <= drag.origEnd)
          .reduce((m, o) => Math.max(m, o.end), 0)
        const ns = Math.max(
          leftBlock,
          Math.min(drag.origStart + delta, drag.origEnd - 1),
        )
        setDrag({ ...drag, ghostStart: ns, ghostEnd: drag.origEnd })
      } else {
        // 右边界左移不能越过左边界+1；右移不能撞上右侧换气段
        const rightBlock = others
          .filter((o) => o.start >= drag.origStart)
          .reduce((m, o) => Math.min(m, o.start), project.duration)
        const ne = Math.min(
          rightBlock,
          Math.max(drag.origEnd + delta, drag.origStart + 1),
        )
        setDrag({ ...drag, ghostStart: drag.origStart, ghostEnd: ne })
      }
    }
    const onUp = () => {
      if (
        drag &&
        (drag.ghostStart !== drag.origStart || drag.ghostEnd !== drag.origEnd)
      ) {
        props.onUpdateBreath(
          drag.partId,
          drag.singerId,
          drag.breathId,
          drag.ghostStart,
          drag.ghostEnd,
        )
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, pxPerSec, project.parts, props])

  const startDrag = (
    e: React.PointerEvent,
    partId: string,
    singerId: string,
    b: Breath,
    mode: DragMode,
  ) => {
    e.stopPropagation()
    props.onSelect({ partId, singerId, breathId: b.id })
    setDrag({
      partId,
      singerId,
      breathId: b.id,
      mode,
      startX: e.clientX,
      origStart: b.start,
      origEnd: b.end,
      ghostStart: b.start,
      ghostEnd: b.end,
    })
  }

  const secondFromEvent = (e: React.MouseEvent<HTMLDivElement>) =>
    Math.floor(
      (e.clientX - e.currentTarget.getBoundingClientRect().left) / pxPerSec,
    )

  const ticks: ReactElement[] = []
  for (let t = 0; t <= project.duration; t++) {
    if (t % 1 === 0) {
      const major = t % 5 === 0
      ticks.push(
        <div
          key={t}
          className={`tl-tick${major ? ' major' : ''}`}
          style={{ left: t * pxPerSec }}
        >
          {major ? t : ''}
        </div>,
      )
    }
  }

  const gridLines: ReactElement[] = []
  for (let t = 0; t <= project.duration; t++) {
    gridLines.push(
      <div
        key={t}
        className={`grid-line${t % 5 === 0 ? ' major' : ''}`}
        style={{ left: t * pxPerSec }}
      />,
    )
  }

  return (
    <div className="timeline-scroll" onPointerDown={() => props.onSelect(null)}>
      <div className="timeline" style={{ width: LABEL_W + width }}>
        <div className="tl-header">
          <div className="tl-ruler" style={{ width }}>
            {ticks}
          </div>
          <div className="tl-global" style={{ width }}>
            <div className="tl-global-label">全曲未达标（任一声部）</div>
            {globalBad.map((s, i) => (
              <div
                key={i}
                className="bad-band"
                style={{
                  left: s.start * pxPerSec,
                  width: (s.end - s.start) * pxPerSec,
                }}
                title={`${s.start}–${s.end}s 有声部人数不足`}
              />
            ))}
          </div>
        </div>

        {project.parts.map((part) => {
          const badSegs = deficientSegments(part, project.duration)
          return (
            <div className="part-block" key={part.id}>
              <div className="part-head">
                <span className="part-dot" style={{ background: part.color }} />
                <input
                  value={part.name}
                  onChange={(e) => props.onRenamePart(part.id, e.target.value)}
                  style={{ width: 120 }}
                />
                <span className="dim">
                  {part.singers.length} 人 · 换气段{' '}
                  {part.singers.reduce((a, s) => a + s.breaths.length, 0)} 处
                </span>
                <span className="min-sound">
                  最低发声
                  <input
                    type="number"
                    min={0}
                    max={part.singers.length}
                    value={part.minSounding}
                    onChange={(e) =>
                      props.onChangeMinSounding(
                        part.id,
                        Math.max(
                          0,
                          Math.min(
                            part.singers.length,
                            Number(e.target.value) || 0,
                          ),
                        ),
                      )
                    }
                  />
                  人
                </span>
                <span className="spacer" />
                <button onClick={() => props.onAddSinger(part.id)}>
                  ＋ 添加歌手
                </button>
                <button
                  className="danger"
                  onClick={() => props.onRemovePart(part.id)}
                >
                  删除声部
                </button>
              </div>

              <div className="tl-row coverage">
                <div className="tl-label">覆盖（红=不足）</div>
                <div className="tl-track" style={{ width }}>
                  {gridLines}
                  {badSegs.map((s, i) => (
                    <div
                      key={i}
                      className="cover-bad"
                      style={{
                        left: s.start * pxPerSec,
                        width: (s.end - s.start) * pxPerSec,
                      }}
                      title={`${s.start}–${s.end}s：换气 ${s.value} 人，发声 ${
                        part.singers.length - s.value
                      } 人 < 最低 ${part.minSounding} 人`}
                    />
                  ))}
                </div>
              </div>

              {part.singers.map((singer) => (
                <div className="tl-row" key={singer.id}>
                  <div className="tl-label">
                    <input
                      className="singer-name"
                      value={singer.name}
                      onChange={(e) =>
                        props.onRenameSinger(part.id, singer.id, e.target.value)
                      }
                    />
                    <button
                      className="icon danger"
                      title="删除歌手"
                      onClick={() => props.onRemoveSinger(part.id, singer.id)}
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    className="tl-track"
                    style={{ width }}
                                    onDoubleClick={(e) =>
                                      props.onAddBreath(
                                        part.id,
                                        singer.id,
                                        secondFromEvent(e),
                                      )
                                    }
                                  >
                                    {gridLines}
                                    {badSegs.map((s, i) => (
                                      <div
                                        key={i}
                                        className="bad-overlay"
                                        style={{
                                          left: s.start * pxPerSec,
                                          width: (s.end - s.start) * pxPerSec,
                                        }}
                                      />
                                    ))}
                                    {singer.breaths.length === 0 && (
                                      <span className="breath-hint">
                                        双击空白处添加换气段
                                      </span>
                                    )}
                                    {singer.breaths.map((b) => {
                                      const isDragged =
                                        drag?.breathId === b.id &&
                                        drag.singerId === singer.id
                                      const bs = isDragged ? drag.ghostStart : b.start
                                      const be = isDragged ? drag.ghostEnd : b.end
                                      const selected =
                                        selection?.breathId === b.id &&
                                        selection.singerId === singer.id
                                      return (
                                        <div
                                          key={b.id}
                                          className={
                                            'breath-block' +
                                            (selected ? ' selected' : '') +
                                            (isDragged ? ' dragging' : '')
                                          }
                                          style={
                                            {
                                              left: bs * pxPerSec,
                                              width: (be - bs) * pxPerSec,
                                              ['--bc' as string]: part.color,
                                            } as React.CSSProperties
                                          }
                                          title={`${bs}–${be}s（半开区间，时长 ${
                                            be - bs
                                          } 秒）· 拖动移动，拖拽边缘改时长`}
                                          onPointerDown={(e) =>
                                            startDrag(e, part.id, singer.id, b, 'move')
                                          }
                                        >
                                          <span
                                            className="resize-handle left"
                                            onPointerDown={(e) =>
                                              startDrag(
                                                e,
                                                part.id,
                                                singer.id,
                                                b,
                                                'left',
                                              )
                                            }
                                          />
                                          {(be - bs) * pxPerSec >= 34
                                            ? `${bs}–${be}s`
                                            : ''}
                                          <span
                                            className="resize-handle right"
                                            onPointerDown={(e) =>
                                              startDrag(
                                                e,
                                                part.id,
                                                singer.id,
                                                b,
                                                'right',
                                              )
                                            }
                                          />
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
  )
}
