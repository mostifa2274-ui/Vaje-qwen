import { describe, expect, it } from 'vitest'
import { bookExamId, FINAL_EXAM_ID, MIDPOINT_EXAM_ID } from './gates'
import { warmupTarget } from './routeWarmup'
import type { NextAction } from './analytics'

function action(next: NextAction) {
  return warmupTarget(next)
}

describe('route warmup target', () => {
  it('warms review for remediation and certification, not for rest or completion', () => {
    expect(action({ kind: 'review', title: '', detail: '' })).toBe('review')
    expect(action({ kind: 'certification', title: '', detail: '' })).toBe('review')
    expect(action({ kind: 'rest', title: '', detail: '' })).toBe('none')
    expect(action({ kind: 'complete', title: '', detail: '' })).toBe('none')
  })

  it('warms the screen the exam route actually mounts', () => {
    expect(action({ kind: 'exam', examId: bookExamId(1), title: '', detail: '' })).toBe('book-test')
    expect(action({ kind: 'exam', examId: MIDPOINT_EXAM_ID, title: '', detail: '' })).toBe('exam')
    expect(action({ kind: 'exam', examId: FINAL_EXAM_ID, title: '', detail: '' })).toBe('exam')
  })

  it('warms reading only after the chapter is prepared', () => {
    expect(action({ kind: 'chapter', chapterId: 'b1c1', prepared: false, title: '', detail: '' })).toBe('prep')
    expect(action({ kind: 'chapter', chapterId: 'b1c1', prepared: true, title: '', detail: '' })).toBe('read')
  })
})
