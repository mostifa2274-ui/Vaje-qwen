import { describe, expect, it } from 'vitest'
import { faNum, percent } from './format'
import { emptyState } from './store'
import { nextBestAction } from './analytics'
import { examDefinition } from './gates'
import { CHAPTERS } from '../data/chapters'

describe('Persian number formatting', () => {
  it('renders every Western digit as a Persian digit', () => {
    expect(faNum(1234567890)).toBe('۱۲۳۴۵۶۷۸۹۰')
    expect(faNum('12 / 27')).toBe('۱۲ / ۲۷')
    expect(percent(0.856)).toBe('۸۶٪')
  })

  it('keeps learner-facing guidance free of Western digits', () => {
    const action = nextBestAction(emptyState(1, CHAPTERS[0].id), 1)
    expect(action.kind).toBe('chapter')
    expect(`${action.title} ${action.detail}`).not.toMatch(/[0-9]/)
    expect(examDefinition('book-3')?.titleFa).toBe('آزمون پایان کتاب ۳')
  })
})
