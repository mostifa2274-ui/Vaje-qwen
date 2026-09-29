// Recovery from a screen that fails to load or render.

const RELOAD_KEY = 'ghesse:route-reload-at'
/** One automatic reload per this window; a second failure waits for the learner. */
export const AUTO_RELOAD_WINDOW_MS = 60_000

/**
 * A lazily loaded screen whose script could not be fetched: the device is
 * offline, or a deploy replaced the file the open page still points to.
 * Messages differ by browser (Chromium, Firefox, Safari) and bundler.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS|Loading chunk \S+ failed|module script failed/i.test(message)
}

/**
 * Whether to reload the page once to pick up the current build. It is skipped
 * offline (a reload would not help) and after a recent automatic reload, so a
 * persistent failure can never loop.
 */
export function shouldAutoReload(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined, online: boolean, now: number): boolean {
  if (!online || !storage) return false
  try {
    const last = Number(storage.getItem(RELOAD_KEY))
    if (Number.isFinite(last) && last > 0 && now - last < AUTO_RELOAD_WINDOW_MS) return false
    storage.setItem(RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}
