import { describe, expect, it } from 'vitest'
import { sanitizePrepDraft } from './prepDraft'

const ids = ['w1', 'w2', 'w3']

function base() {
  return {
    version: 1 as const,
    chapterId: 'b1c1',
    phase: 'written' as const,
    teachIndex: 0,
    writtenQueue: [...ids],
    writtenPassed: [],
    writtenMissed: [],
    listeningQueue: [],
    listeningPassed: [],
    listeningMissed: [],
    feedback: null,
    selected: '',
    typed: '',
    updatedAt: 1,
  }
}

describe('prove-known draft safety', () => {
  it('still fails closed to teaching when testing was reached without teaching or explicit diagnostic', () => {
    expect(sanitizePrepDraft(base(), 'b1c1', ids)?.phase).toBe('teach')
  })

  it('allows the explicit prove-known diagnostic to start written testing before teaching', () => {
    const draft = sanitizePrepDraft({ ...base(), proveKnown: true }, 'b1c1', ids)
    expect(draft?.phase).toBe('written')
    expect(draft?.proveKnown).toBe(true)
  })

  it('never allows diagnostic listening before every written item passed', () => {
    const draft = sanitizePrepDraft({ ...base(), proveKnown: true, phase: 'listening', writtenPassed: ['w1'] }, 'b1c1', ids)
    expect(draft?.phase).toBe('written')
  })

  it('allows diagnostic listening only after complete written coverage', () => {
    const draft = sanitizePrepDraft({ ...base(), proveKnown: true, phase: 'listening', writtenQueue: [], writtenPassed: ids, listeningQueue: ids }, 'b1c1', ids)
    expect(draft?.phase).toBe('listening')
    expect(draft?.proveKnown).toBe(true)
  })
})
