export interface ReleaseMarker {
  release: string
  app: string
  worker: string
  vocabulary: number
  chapters: number
  stateSchema: number
  learningFlow: string
  commit?: string
  branch?: string
}

export const BUILD_COMMIT = typeof __GHESSE_BUILD_COMMIT__ === 'string'
  ? __GHESSE_BUILD_COMMIT__
  : 'local'

export function parseReleaseMarker(value: unknown): ReleaseMarker | undefined {
  if (!value || typeof value !== 'object') return undefined
  const marker = value as Partial<ReleaseMarker>
  if (
    marker.release !== 'ghesse-5.0.0'
    || marker.app !== 'Ghesse'
    || marker.worker !== 'vaje-qwen1'
    || marker.vocabulary !== 899
    || marker.chapters !== 40
    || typeof marker.stateSchema !== 'number'
    || marker.learningFlow !== 'teach-write-listen-100'
  ) return undefined

  if (marker.commit !== undefined && typeof marker.commit !== 'string') return undefined
  if (marker.branch !== undefined && typeof marker.branch !== 'string') return undefined
  return marker as ReleaseMarker
}

export function deployedBuildDiffers(marker: ReleaseMarker | undefined, loadedCommit = BUILD_COMMIT): boolean {
  const deployedCommit = marker?.commit?.trim()
  const current = loadedCommit.trim()
  if (!deployedCommit || deployedCommit === 'local' || !current || current === 'local') return false
  return deployedCommit !== current
}

export function releaseMarkerUrl(baseUrl: string, now = Date.now()): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}release.json?fresh=${now}`
}

export async function fetchReleaseMarker(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<ReleaseMarker | undefined> {
  try {
    const response = await fetcher(releaseMarkerUrl(baseUrl, now), { cache: 'no-store' })
    if (!response.ok) return undefined
    return parseReleaseMarker(await response.json())
  } catch {
    return undefined
  }
}
