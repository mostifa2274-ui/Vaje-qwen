// Pre-recorded narration. Every English prompt in the course (each word, its
// example and every story and test sentence) is recorded once with a natural
// neural voice by scripts/audio/generate_audio.py. A clip is named by a hash
// of exactly what it says, so an edited sentence simply has no clip until the
// script runs again, and the app then falls back to the device's voice.

export type ClipKind = 'w' | 's'

const OFFSET = 0x811c9dc5
const PRIME = 0x01000193
const SECOND_SEED = (PRIME ^ 0x9e3779b9) >>> 0

function fnv1a(bytes: Uint8Array, seed: number): number {
  let hash = seed >>> 0
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, PRIME) >>> 0
  }
  return hash
}

function hex(value: number): string {
  return value.toString(16).padStart(8, '0')
}

export function normalizeClipText(text: string): string {
  return text.replace(/’/g, "'").split(/\s+/).filter(Boolean).join(' ')
}

/** Must match clip_id() in scripts/audio/generate_audio.py. */
export function clipId(kind: ClipKind, text: string): string {
  const bytes = new TextEncoder().encode(`${kind}|${normalizeClipText(text)}`)
  return `${hex(fnv1a(bytes, OFFSET))}${hex(fnv1a(bytes, SECOND_SEED))}`
}

let available: ReadonlySet<string> | null = null
let loading: Promise<void> | null = null

function base(): string {
  return import.meta.env.BASE_URL ?? '/'
}

/**
 * Fetches the recorded-clip catalogue. A successful load is cached for the app
 * lifetime; a transient network/HTTP failure is not, so a later online or
 * visibility retry can restore the high-quality course recordings.
 */
export function loadClipIndex(fetcher: typeof fetch = fetch): Promise<void> {
  if (loading) return loading

  const attempt: Promise<void> = fetcher(`${base()}audio/index.json`)
    .then(response => {
      if (!response.ok) throw new Error(`Audio index HTTP ${response.status}`)
      return response.json()
    })
    .then((index: { clips?: unknown }) => {
      const clips = Array.isArray(index?.clips) ? index.clips.filter((clip): clip is string => typeof clip === 'string') : []
      available = new Set(clips)
    })
    .catch(() => {
      available = new Set()
      if (loading === attempt) loading = null
    })

  loading = attempt
  return attempt
}

/** For tests: replace the loaded index. */
export function setClipIndex(clips: Iterable<string> | null): void {
  available = clips ? new Set(clips) : null
  loading = clips ? Promise.resolve() : null
}

/** Stable content-addressed URL, whether or not the current index has loaded. */
export function clipUrl(kind: ClipKind, text: string): string {
  return `${base()}audio/${clipId(kind, text)}.mp3`
}

/** URL of the recorded clip for this prompt, if one exists. */
export function recordedClip(kind: ClipKind, text: string): string | undefined {
  if (!available || available.size === 0) return undefined
  const id = clipId(kind, text)
  return available.has(id) ? clipUrl(kind, text) : undefined
}
