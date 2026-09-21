import { useEffect, useMemo, useRef, useState } from 'react'
import Timeline from './components/Timeline'
import Inspector from './components/Inspector'
import type { Breath, Project, Selection } from './types'
import {
  deficientSeconds,
  deficientSegments,
  nearestFreeStart,
  totalDeficientSeconds,
} from './lib/logic'
import { sampleProject } from './lib/sample'
import { loadProject } from './lib/storage'
import { uid } from './lib/id'

const PART_COLORS = ['#e85d75', '#f0a04b', '#3a86ff', '#34d399', '#a78bfa', '#f472b6']

function emptyProject(): Project {
  return {
    title: '我的合唱排练',
    duration: 30,
    parts: [],
  }
}

export default function App() {
  const [project, setProject] = useState<Project>(
    () => loadProject<Project>() ?? sampleProject(),
  )
  const [selection, setSelection] = useState<Selection | null>(null)
  const [pxPerSec, setPxPerSec] = useState(22)
  const [savedFlash, setSavedFlash] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 本地保存（写入由 storage 中的 useEffect 承担，这里只做“已保存”提示）
  const first = useRef(true)
  useEffect(() => {
    try {
      localStorage.setItem('breath-relay-project-v1', JSON.stringify(project))
      if (!first.current) {
        setSavedFlash(true)
        const t = setTimeout(() => setSavedFlash(false), 1200)
        return () => clearTimeout(t)
      }
    } catch {
      // 存储不可用时静默忽略
    } finally {
      first.current = false
    }
  }, [project])

  // 选中目标若已不存在则清空
  useEffect(() => {
    if (!selection) return
    const exists = project.parts.some(
      (p) =>
        p.id === selection.partId &&
        p.singers.some(
          (s) =>
            s.id === selection.singerId &&
            s.breaths.some((b) => b.id === selection.breathId),
        ),
    )
    if (!exists) setSelection(null)
  }, [project, selection])

  const updatePart = (partId: string, fn: (p: Project['parts'][number]) => Project['parts'][number]) =>
    setProject((proj) => ({
      ...proj,
      parts: proj.parts.map((p) => (p.id === partId ? fn(p) : p)),
    }))

  const updateSinger = (partId: string, singerId: string, fn: (s: Project['parts'][number]['singers'][number]) => Project['parts'][number]['singers'][number]) =>
    updatePart(partId, (p) => ({
      ...p,
      singers: p.singers.map((s) => (s.id === singerId ? fn(s) : s)),
    }))

  const setBreath = (
    partId: string,
    singerId: string,
    breathId: string,
    start: number,
    end: number,
  ) => {
    updateSinger(partId, singerId, (s) => ({
      ...s,
      breaths: s.breaths
        .map((b) => (b.id === breathId ? { ...b, start, end } : b))
        .sort((a, b) => a.start - b.start),
    }))
  }

  const addBreath = (partId: string, singerId: string, second: number) => {
    updateSinger(partId, singerId, (s) => {
      const LENGTH = 2
      const others = s.breaths.map((b) => ({ start: b.start, end: b.end }))
      const start = nearestFreeStart(
        Math.max(0, Math.min(second, project.duration - LENGTH)),
        LENGTH,
        project.duration,
        others,
      )
      if (start === null) return s
      const nb: Breath = { id: uid('b'), start, end: start + LENGTH }
      return { ...s, breaths: [...s.breaths, nb].sort((a, b) => a.start - b.start) }
    })
  }

  const deleteBreath = (partId: string, singerId: string, breathId: string) =>
    updateSinger(partId, singerId, (s) => ({
      ...s,
      breaths: s.breaths.filter((b) => b.id !== breathId),
    }))

  const renameSinger = (partId: string, singerId: string, name: string) =>
    updateSinger(partId, singerId, (s) => ({ ...s, name }))

  const removeSinger = (partId: string, singerId: string) =>
    updatePart(partId, (p) => ({ ...p, singers: p.singers.filter((s) => s.id !== singerId) }))

  const addSinger = (partId: string) =>
    updatePart(partId, (p) => ({
      ...p,
      singers: [
        ...p.singers,
        { id: uid('sg'), name: `歌手 ${p.singers.length + 1}`, breaths: [] },
      ],
    }))

  const renamePart = (partId: string, name: string) =>
    updatePart(partId, (p) => ({ ...p, name }))

  const changeMinSounding = (partId: string, min: number) =>
    updatePart(partId, (p) => ({ ...p, minSounding: Math.max(0, min) }))

  const addPart = () =>
    setProject((proj) => ({
      ...proj,
      parts: [
        ...proj.parts,
        {
          id: uid('p'),
          name: `声部 ${proj.parts.length + 1}`,
          color: PART_COLORS[proj.parts.length % PART_COLORS.length],
          minSounding: 1,
          singers: [
            { id: uid('sg'), name: '歌手 1', breaths: [] },
          ],
        },
      ],
    }))

  const removePart = (partId: string) =>
    setProject((proj) => ({ ...proj, parts: proj.parts.filter((p) => p.id !== partId) }))

  const changeDuration = (d: number) =>
    setProject((proj) => {
      const duration = Math.max(1, Math.round(d))
      // 缩短总时长时裁掉超出范围的换气段
      return {
        ...proj,
        duration,
        parts: proj.parts.map((p) => ({
          ...p,
          singers: p.singers.map((s) => ({
            ...s,
            breaths: s.breaths
              .map((b) => ({
                ...b,
                start: Math.min(b.start, duration),
                end: Math.min(b.end, duration),
              }))
              .filter((b) => b.end > b.start),
          })),
        })),
      }
    })

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.title || 'breath-relay'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Project
        if (
          typeof data.duration === 'number' &&
          Array.isArray(data.parts)
        ) {
          setProject(data)
          setSelection(null)
        } else {
          alert('文件格式不正确')
        }
      } catch {
        alert('JSON 解析失败')
      }
    }
    reader.readAsText(file)
  }

  const loadSample = () => {
    if (confirm('载入示例数据将覆盖当前工程，确定继续？')) {
      setProject(sampleProject())
      setSelection(null)
    }
  }

  const clearAll = () => {
    if (confirm('确定清空全部数据，开始一个空工程？')) {
      setProject(emptyProject())
      setSelection(null)
    }
  }

  const totalBad = useMemo(() => totalDeficientSeconds(project), [project])

  return (
    <div className="app">
      <div className="toolbar">
        <h1>🎵 换气接力</h1>
        <input
          value={project.title}
          onChange={(e) => setProject({ ...project, title: e.target.value })}
          style={{ width: 200 }}
        />
        <label>
          总时长
          <input
            type="number"
            min={1}
            max={600}
            value={project.duration}
            onChange={(e) => changeDuration(Number(e.target.value) || 1)}
            style={{ width: 70 }}
          />
          秒
        </label>
        <label>
          缩放
          <input
            type="range"
            min={10}
            max={60}
            value={pxPerSec}
            onChange={(e) => setPxPerSec(Number(e.target.value))}
            style={{ width: 110 }}
          />
        </label>
        <span className="spacer" />
        <button onClick={addPart}>＋ 添加声部</button>
        <button onClick={loadSample}>载入示例</button>
        <button onClick={() => fileRef.current?.click()}>导入 JSON</button>
        <button onClick={exportJson}>导出 JSON</button>
        <button className="danger" onClick={clearAll}>
          清空
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importJson(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className="statbar">
        {totalBad === 0 ? (
          <span className="total-ok">✓ 全曲覆盖达标，无人数不足时段</span>
        ) : (
          <span className="total-bad">
            ⚠ 全曲未达标总秒数：{totalBad} 秒（各声部不足秒数之和）
          </span>
        )}
        {project.parts.map((p) => {
          const bad = deficientSeconds(p, project.duration)
          const segs = deficientSegments(p, project.duration)
          return (
            <span
              key={p.id}
              title={
                segs.length
                  ? `不足时段：${segs.map((s) => `[${s.start},${s.end})`).join(' ')}`
                  : '全部达标'
              }
              style={{ color: bad ? 'var(--text)' : 'var(--text-faint)' }}
            >
              <span style={{ color: p.color }}>●</span> {p.name}：
              {bad ? <b style={{ color: 'var(--bad)' }}>{bad}s</b> : '0s'}
            </span>
          )
        })}
        <span className="spacer" />
        {savedFlash && <span className="saved-flash">✓ 已保存到本地</span>}
        <span style={{ color: 'var(--text-faint)' }}>修改自动保存</span>
      </div>

      <Timeline
        project={project}
        selection={selection}
        pxPerSec={pxPerSec}
        onSelect={setSelection}
        onUpdateBreath={setBreath}
        onAddBreath={addBreath}
        onRenameSinger={renameSinger}
        onRemoveSinger={removeSinger}
        onAddSinger={addSinger}
        onRenamePart={renamePart}
        onChangeMinSounding={changeMinSounding}
        onRemovePart={removePart}
      />

      <Inspector
        project={project}
        selection={selection}
        onUpdateBreath={setBreath}
        onDeleteBreath={deleteBreath}
        onSelect={setSelection}
      />
    </div>
  )
}
