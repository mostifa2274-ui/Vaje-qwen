export type DiagnosticPhase = 'productive' | 'listening'

export interface DiagnosticDraft {
  version: 1
  chapterId: string
  phase: DiagnosticPhase
  productivePassed: string[]
  listeningPassed: string[]
  updatedAt: number
}

const PREFIX = 'ghesse:diagnostic:v1:'

function key(chapterId: string): string {
  return `${PREFIX}${chapterId}`
}

function validIds(value: unknown, allowed: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const id of value) {
    if (typeof id !== 'string' || !allowed.has(id) || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

export function sanitizeDiagnosticDraft(raw: unknown, chapterId: string, wordIds: readonly string[]): DiagnosticDraft | undefined {
  if (!raw || typeof raw !== 'object' || wordIds.length === 0) return undefined
  const value = raw as Partial<DiagnosticDraft>
  if (value.version !== 1 || value.chapterId !== chapterId) return undefined
  if (value.phase !== 'productive' && value.phase !== 'listening') return undefined

  const allowed = new Set(wordIds)
  const productivePassed = validIds(value.productivePassed, allowed)
  const listeningPassed = validIds(value.listeningPassed, allowed)
  const phase: DiagnosticPhase =
    productivePassed.length === wordIds.length
      ? 'listening'
      : 'productive'

  return {
    version: 1,
    chapterId,
    phase,
    productivePassed,
    listeningPassed: phase === 'listening' ? listeningPassed : [],
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
  }
}

export function loadDiagnosticDraft(chapterId: string, wordIds: readonly string[]): DiagnosticDraft | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(key(chapterId))
    if (!raw) return undefined
    const draft = sanitizeDiagnosticDraft(JSON.parse(raw), chapterId, wordIds)
    if (!draft) sessionStorage.removeItem(key(chapterId))
    return draft
  } catch {
    return undefined
  }
}

export function saveDiagnosticDraft(draft: DiagnosticDraft, wordIds: readonly string[]): void {
  if (typeof sessionStorage === 'undefined') return
  const safe = sanitizeDiagnosticDraft(draft, draft.chapterId, wordIds)
  if (!safe) return
  try {
    sessionStorage.setItem(key(draft.chapterId), JSON.stringify(safe))
  } catch {
    // Session recovery is optional. The diagnostic remains usable in memory.
  }
}

export function clearDiagnosticDraft(chapterId: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(key(chapterId))
  } catch {
    // Nothing else depends on this draft.
  }
}
