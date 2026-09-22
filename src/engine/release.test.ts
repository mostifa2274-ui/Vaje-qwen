import { describe, expect, it, vi } from 'vitest'
import {
  deployedBuildDiffers,
  fetchReleaseMarker,
  parseReleaseMarker,
  releaseMarkerUrl,
} from './release'

const VALID = {
  release: 'ghesse-5.0.0',
  app: 'Ghesse',
  worker: 'vaje-qwen1',
  vocabulary: 899,
  chapters: 40,
  stateSchema: 6,
  learningFlow: 'teach-write-listen-100',
  commit: 'abc123',
  branch: 'main',
}

describe('release freshness', () => {
  it('accepts only the expected Ghesse production marker shape', () => {
    expect(parseReleaseMarker(VALID)?.commit).toBe('abc123')
    expect(parseReleaseMarker({ ...VALID, worker: 'other-worker' })).toBeUndefined()
    expect(parseReleaseMarker({ ...VALID, vocabulary: 900 })).toBeUndefined()
    expect(parseReleaseMarker({ ...VALID, learningFlow: 'other' })).toBeUndefined()
  })

  it('flags a deployed commit mismatch only for concrete build ids', () => {
    const marker = parseReleaseMarker(VALID)
    expect(deployedBuildDiffers(marker, 'abc123')).toBe(false)
    expect(deployedBuildDiffers(marker, 'def456')).toBe(true)
    expect(deployedBuildDiffers(marker, 'local')).toBe(false)
    expect(deployedBuildDiffers(parseReleaseMarker({ ...VALID, commit: 'local' }), 'abc123')).toBe(false)
    expect(deployedBuildDiffers(undefined, 'abc123')).toBe(false)
  })

  it('creates a cache-busting release marker URL', () => {
    expect(releaseMarkerUrl('./', 123)).toBe('./release.json?fresh=123')
    expect(releaseMarkerUrl('/app', 456)).toBe('/app/release.json?fresh=456')
  })

  it('fetches the marker with no-store semantics', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(VALID), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch

    const marker = await fetchReleaseMarker('./', fetcher, 789)
    expect(marker?.commit).toBe('abc123')
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith('./release.json?fresh=789', { cache: 'no-store' })
  })

  it('fails quietly when the marker is unavailable or invalid', async () => {
    const offline = vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch
    expect(await fetchReleaseMarker('./', offline, 1)).toBeUndefined()

    const invalid = vi.fn(async () => new Response(JSON.stringify({ ...VALID, release: 'wrong' }), { status: 200 })) as unknown as typeof fetch
    expect(await fetchReleaseMarker('./', invalid, 2)).toBeUndefined()
  })
})
