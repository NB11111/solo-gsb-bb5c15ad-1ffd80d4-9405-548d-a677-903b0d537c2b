let counter = 0

/** 生成简单唯一 ID */
export function uid(prefix = 'id'): string {
  counter += 1
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}_${Date.now().toString(36)}_${counter}`
}
