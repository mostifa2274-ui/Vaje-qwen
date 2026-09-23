import { describe, expect, it } from 'vitest'
import { PREP_PACE_INTERVAL, prepPaceMilestone } from './prepPacing'

describe('preparation pacing milestones', () => {
  it('uses quiet eight-word milestones', () => {
    expect(PREP_PACE_INTERVAL).toBe(8)
    expect(prepPaceMilestone(8, 27)).toBe(8)
    expect(prepPaceMilestone(16, 27)).toBe(16)
    expect(prepPaceMilestone(24, 27)).toBe(24)
  })

  it('does not interrupt the start, ordinary progress, or completed phase', () => {
    expect(prepPaceMilestone(0, 27)).toBeNull()
    expect(prepPaceMilestone(7, 27)).toBeNull()
    expect(prepPaceMilestone(9, 27)).toBeNull()
    expect(prepPaceMilestone(27, 27)).toBeNull()
  })

  it('does not create a pointless cue at the end of a short phase', () => {
    expect(prepPaceMilestone(8, 8)).toBeNull()
    expect(prepPaceMilestone(8, 15)).toBe(8)
  })
})
