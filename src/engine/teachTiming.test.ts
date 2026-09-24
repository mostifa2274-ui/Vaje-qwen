import { describe, expect, it } from 'vitest'
import { autoTeachReflectionPauseMs } from './teachTiming'

describe('auto-teach reflection timing', () => {
  it('keeps very short translations from advancing too quickly', () => {
    expect(autoTeachReflectionPauseMs('گربه')).toBe(2200)
  })

  it('gives longer Persian translations more reading time', () => {
    expect(autoTeachReflectionPauseMs('او هر روز با دوستش به مدرسه می‌رود')).toBeGreaterThan(3000)
  })

  it('caps long translations so hands-free teaching does not stall', () => {
    expect(autoTeachReflectionPauseMs('این یک ترجمه بسیار طولانی است که فقط برای آزمایش سقف زمان خواندن خودکار نوشته شده است و چندین واژه دارد')).toBe(5200)
  })
})
