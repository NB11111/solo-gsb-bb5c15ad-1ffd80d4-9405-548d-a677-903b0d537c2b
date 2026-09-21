import { useEffect, useState } from 'react'

const KEY = 'breath-relay-project-v1'

/** 从 localStorage 读取工程 */
export function loadProject<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** 工程变更时自动保存到 localStorage */
export function usePersist<T>(value: T): void {
  const [first, setFirst] = useState(true)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(value))
    } catch {
      // 存储不可用时静默忽略
    }
    setFirst(false)
  }, [value, first])
}
