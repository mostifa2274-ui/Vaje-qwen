import { seededSample } from './review'

export interface PrepTestOrders {
  writtenOrder: string[]
  listeningOrder: string[]
}

function rotate<T>(items: readonly T[], shift: number): T[] {
  if (items.length === 0) return []
  const offset = ((shift % items.length) + items.length) % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

function positionalOverlap<T>(left: readonly T[], right: readonly T[]): number {
  const count = Math.min(left.length, right.length)
  let overlap = 0
  for (let index = 0; index < count; index++) {
    if (left[index] === right[index]) overlap++
  }
  return overlap
}

/**
 * Keep the seeded listening permutation intact up to a cyclic rotation, then
 * choose the rotation that feels least like an immediate replay of written:
 * - first item must differ whenever the chapter has >1 word
 * - positional overlap is minimized deterministically
 *
 * A cyclic rotation preserves the independently seeded order while avoiding
 * serial-position cues between the two 100% tests.
 */
export function separatePrepOrder<T>(reference: readonly T[], candidate: readonly T[]): T[] {
  if (candidate.length <= 1 || reference.length !== candidate.length) return [...candidate]

  let best: T[] | undefined
  let bestOverlap = Number.POSITIVE_INFINITY

  for (let shift = 0; shift < candidate.length; shift++) {
    const rotated = rotate(candidate, shift)
    if (rotated[0] === reference[0]) continue

    const overlap = positionalOverlap(reference, rotated)
    if (overlap < bestOverlap) {
      best = rotated
      bestOverlap = overlap
      if (overlap === 0) break
    }
  }

  return best ?? [...candidate]
}

export function buildPrepTestOrders(chapterId: string, wordIds: readonly string[]): PrepTestOrders {
  const ids = [...wordIds]
  const writtenOrder = seededSample(ids, ids.length, `${chapterId}:prep:written-order`)
  const listeningSeeded = seededSample(ids, ids.length, `${chapterId}:prep:listening-order`)
  const listeningOrder = separatePrepOrder(writtenOrder, listeningSeeded)

  return { writtenOrder, listeningOrder }
}
