import { useMemo, useState } from 'react'
import type { Candidate, Project, Selection } from '../types'
import { buildMoveDiff, enumerateCandidates, totalDeficientSeconds } from '../lib/logic'

interface InspectorProps {
  project: Project
  selection: Selection | null
  onUpdateBreath: (
    partId: string,
    singerId: string,
    breathId: string,
    start: number,
    end: number,
  ) => void
  onDeleteBreath: (partId: string, singerId: string, breathId: string) => void
  onSelect: (sel: Selection | null) => void
}

const DEFAULT_RANGE = 5

export default function Inspector(props: InspectorProps) {
  const { project, selection } = props
  const [range, setRange] = useState(DEFAULT_RANGE)
  const [picked, setPicked] = useState<Candidate | null>(null)

  const found = useMemo(() => {
    if (!selection) return null
    return enumerateCandidates(
      project,
      selection.partId,
      selection.singerId,
      selection.breathId,
      range,
    )
  }, [project, selection, range])

  // 选中段或候选列表变化后，优先保留用户点选的候选；否则取排序最优
  const effectivePicked = useMemo<Candidate | null>(() => {
    if (!found) return null
    if (picked) {
      const match = found.candidates.find((c) => c.start === picked.start)
      if (match) return match
    }
    return found.candidates[0] ?? null
  }, [found, picked])

  const diff = useMemo(() => {
    if (!selection || !found || !effectivePicked) return null
    return buildMoveDiff(
      project,
      selection.partId,
      selection.singerId,
      selection.breathId,
      effectivePicked,
    )
  }, [project, selection, found, effectivePicked])

  if (!selection || !found) {
    return (
      <aside className="inspector">
        <h2>换气段检查器</h2>
        <div className="card">
          <p className="empty-hint">
            点击时间轴上的彩色换气段即可选中。
            <br />
            选中后可以：
          </p>
          <ul className="empty-hint" style={{ margin: 0, paddingLeft: 18 }}>
            <li>精确编辑起止秒数</li>
            <li>在 ±N 秒内穷举最优位置</li>
            <li>预览修复前后的覆盖差异</li>
          </ul>
        </div>
        <div className="card">
          <h3>操作说明</h3>
          <p className="muted">
            · 拖动色块中部：移动换气段（自动避开本人其他区间）
            <br />· 拖动色块左右边缘：调整时长
            <br />· 双击歌手行空白处：新建 2 秒换气段
            <br />· 所有区间均为半开区间 [start, end)，整数秒
            <br />· 修改自动保存到浏览器本地
          </p>
        </div>
      </aside>
    )
  }

  const { part, singer, breath, candidates } = found
  const shown = candidates.slice(0, 10)
  const beforeTotal = totalDeficientSeconds(project)
  const changed =
    effectivePicked &&
    (effectivePicked.start !== breath.start ||
      effectivePicked.end !== breath.end)

  const setBound = (which: 'start' | 'end', raw: number) => {
    let s = breath.start
    let e = breath.end
    const v = Math.max(0, Math.min(project.duration, Math.round(raw)))
    if (which === 'start') s = Math.min(v, e - 1)
    else e = Math.max(v, s + 1)
    props.onUpdateBreath(part.id, singer.id, breath.id, s, e)
  }

  return (
    <aside className="inspector" key={selection.breathId}>
      <h2>
        换气段检查器
        <span style={{ color: part.color, marginLeft: 8 }}>●</span>
      </h2>

      <div className="card">
        <h3>
          {part.name} · {singer.name}
        </h3>
        <div className="row">
          <label>起点 s</label>
          <input
            type="number"
            min={0}
            max={breath.end - 1}
            value={breath.start}
            onChange={(e) => setBound('start', Number(e.target.value))}
          />
          <label>止点 e</label>
          <input
            type="number"
            min={breath.start + 1}
            max={project.duration}
            value={breath.end}
            onChange={(e) => setBound('end', Number(e.target.value))}
          />
        </div>
        <div className="muted">
          半开区间 [{breath.start}, {breath.end})，时长 {breath.end - breath.start}{' '}
          秒
        </div>
        <div className="row">
          <span className="grow" />
          <button
            className="danger"
            onClick={() => {
              props.onDeleteBreath(part.id, singer.id, breath.id)
              props.onSelect(null)
            }}
          >
            删除该段
          </button>
        </div>
      </div>

      <div className="card">
        <h3>穷举最优位置（保持时长，不与本人其他区间重叠）</h3>
        <div className="row">
          <label>搜索范围 ±</label>
          <input
            type="number"
            min={0}
            max={project.duration}
            value={range}
            onChange={(e) => setRange(Math.max(0, Number(e.target.value) || 0))}
          />
          <label>秒</label>
        </div>
        <div className="muted">
          共 {candidates.length} 个可行位置；按 ① 全曲未达标总秒数 ②
          位移量 ③ 更早时刻 排序。
        </div>
        {candidates.length === 0 ? (
          <div className="muted">该范围内没有可行位置。</div>
        ) : (
          <table className="candidate-table">
            <thead>
              <tr>
                <th>区间</th>
                <th>未达标(s)</th>
                <th>位移(s)</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c, i) => (
                <tr
                  key={c.start}
                  className={
                    c.isCurrent
                      ? 'current'
                      : effectivePicked?.start === c.start
                        ? 'best'
                        : ''
                  }
                  onClick={() => setPicked(c)}
                  style={{ cursor: 'pointer' }}
                  title="点击预览该位置"
                >
                  <td>
                    [{c.start}, {c.end}){c.isCurrent ? ' 当前' : i === 0 ? ' ★最优' : ''}
                  </td>
                  <td>{c.deficientSeconds}</td>
                  <td>{c.displacement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {diff && effectivePicked && (
        <div className="card">
          <h3>修复前后对比预览</h3>
          <div className="diff-total">
            全曲未达标：
            <span className={beforeTotal === 0 ? 'after-good' : 'after-bad'}>
              {diff.beforeTotal}s
            </span>
            <span className="arrow">→</span>
            <span
              className={diff.afterTotal === 0 ? 'after-good' : 'after-bad'}
            >
              {diff.afterTotal}s
            </span>
            <span className="muted">
              （{diff.afterTotal <= diff.beforeTotal ? '减少' : '增加'}{' '}
              {Math.abs(diff.afterTotal - diff.beforeTotal)}s）
            </span>
          </div>
          {diff.parts.map((pd) => (
            <div key={pd.partId}>
              <div className="part-diff-line">
                <span className="name" style={{ color: pd.color }}>
                  {pd.partName}
                </span>
                <span className="nums">
                  {pd.beforeSeconds}s → {pd.afterSeconds}s
                </span>
              </div>
              <div className="part-diff-line">
                <span className="name muted">前</span>
                <div className="mini-track">
                  {pd.before.map((s, i) => (
                    <span
                      key={i}
                      className="mini-band before"
                      style={{
                        left: `${(s.start / project.duration) * 100}%`,
                        width: `${((s.end - s.start) / project.duration) * 100}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="part-diff-line">
                <span className="name muted">后</span>
                <div className="mini-track">
                  {pd.after.map((s, i) => (
                    <span
                      key={i}
                      className="mini-band after"
                      style={{
                        left: `${(s.start / project.duration) * 100}%`,
                        width: `${((s.end - s.start) / project.duration) * 100}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div className="row">
            <span className="grow" />
            <button
              className="primary"
              disabled={!changed}
              onClick={() =>
                props.onUpdateBreath(
                  part.id,
                  singer.id,
                  breath.id,
                  effectivePicked.start,
                  effectivePicked.end,
                )
              }
            >
              应用移动
            </button>
          </div>
          {!changed && <div className="muted">当前位置已在最优解上。</div>}
        </div>
      )}
    </aside>
  )
}
