import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../data/chapters'
import { buildPrepTestOrders, separatePrepOrder } from './prepOrder'

describe('chapter preparation test ordering', () => {
  it('is deterministic and preserves every assigned word exactly once', () => {
    for (const chapter of CHAPTERS) {
      const first = buildPrepTestOrders(chapter.id, chapter.new)
      const second = buildPrepTestOrders(chapter.id, chapter.new)

      expect(second).toEqual(first)
      expect(first.writtenOrder).toHaveLength(chapter.new.length)
      expect(first.listeningOrder).toHaveLength(chapter.new.length)
      expect(new Set(first.writtenOrder)).toEqual(new Set(chapter.new))
      expect(new Set(first.listeningOrder)).toEqual(new Set(chapter.new))
    }
  })

  it('keeps written and listening perceptually distinct across all 40 chapters', () => {
    for (const chapter of CHAPTERS) {
      const { writtenOrder, listeningOrder } = buildPrepTestOrders(chapter.id, chapter.new)

      if (chapter.new.length > 1) {
        expect(listeningOrder[0], chapter.id).not.toBe(writtenOrder[0])
        expect(listeningOrder, chapter.id).not.toEqual(writtenOrder)

        const overlap = writtenOrder.filter((id, index) => id === listeningOrder[index]).length
        expect(overlap, `${chapter.id} positional overlap`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('uses only a cyclic rotation of the independently seeded candidate', () => {
    const candidate = ['a', 'b', 'c', 'd']
    const result = separatePrepOrder(['a', 'c', 'b', 'd'], candidate)
    const doubled = [...candidate, ...candidate].join('|')

    expect(doubled).toContain(result.join('|'))
    expect(result[0]).not.toBe('a')
  })
})
