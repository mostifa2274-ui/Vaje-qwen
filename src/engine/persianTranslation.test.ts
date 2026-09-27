import { describe, expect, it } from 'vitest'
import { acceptedPersianAnswers, isPersianTranslationCorrect, normalizePersianAnswer } from './persianTranslation'

describe('Persian written-translation grading', () => {
  it('normalizes Arabic forms, diacritics, half-spaces and tatweel', () => {
    expect(normalizePersianAnswer('  كِتاب\u200cها  ')).toBe('کتاب ها')
    expect(normalizePersianAnswer('ـش')).toBe('ش')
  })

  it('accepts semicolon and slash alternatives without fuzzy matching', () => {
    expect(isPersianTranslationCorrect('جواب دادن', { fa: 'پاسخ؛ جواب دادن' })).toBe(true)
    expect(isPersianTranslationCorrect('ساعت رومیزی', { fa: 'ساعت دیواری/رومیزی' })).toBe(true)
    expect(isPersianTranslationCorrect('یک صدم یورو', { fa: 'سنت؛ یک صدم دلار/یورو' })).toBe(true)
    expect(isPersianTranslationCorrect('واحد وزن', { fa: 'پوند؛ واحد پول/وزن' })).toBe(true)
    expect(isPersianTranslationCorrect('میز', { fa: 'ساعت دیواری/رومیزی' })).toBe(false)
  })

  it('accepts the core meaning when a gloss contains an explanatory parenthetical', () => {
    expect(isPersianTranslationCorrect('شیر', { fa: 'شیر (حیوان)' })).toBe(true)
    expect(isPersianTranslationCorrect('ساعت', { fa: 'ساعت (مدت زمان)' })).toBe(true)
    expect(isPersianTranslationCorrect('به او', { fa: 'او را؛ به او (مذکر)' })).toBe(true)
    expect(isPersianTranslationCorrect('ش', { fa: 'مال او؛ ـش (مذکر)' })).toBe(true)
  })

  it('recognizes explicit Persian یا alternatives but keeps unrelated words invalid', () => {
    expect(isPersianTranslationCorrect('پدربزرگ', { fa: 'پدربزرگ یا مادربزرگ' })).toBe(true)
    expect(isPersianTranslationCorrect('مادربزرگ', { fa: 'پدربزرگ یا مادربزرگ' })).toBe(true)
    expect(isPersianTranslationCorrect('پدر', { fa: 'والد؛ پدر یا مادر' })).toBe(true)
    expect(isPersianTranslationCorrect('مادر', { fa: 'والد؛ پدر یا مادر' })).toBe(true)
    expect(isPersianTranslationCorrect('برادر', { fa: 'والد؛ پدر یا مادر' })).toBe(false)
  })

  it('accepts a half-space typed as a space or left out entirely', () => {
    expect(isPersianTranslationCorrect('لباسها', { fa: 'لباس‌ها' })).toBe(true)
    expect(isPersianTranslationCorrect('لباس ها', { fa: 'لباس‌ها' })).toBe(true)
    expect(isPersianTranslationCorrect('میتوانست', { fa: 'می‌توانست؛ می‌توانستم' })).toBe(true)
    expect(isPersianTranslationCorrect('خسته کننده', { fa: 'خسته‌کننده' })).toBe(true)
    // Only the spacing may differ: other letters still have to match.
    expect(isPersianTranslationCorrect('لباس', { fa: 'لباس‌ها' })).toBe(false)
    expect(isPersianTranslationCorrect('میتوان', { fa: 'می‌توانست؛ می‌توانستم' })).toBe(false)
  })

  it('folds Arabic-keyboard letter forms, digits and invisible marks', () => {
    expect(normalizePersianAnswer('خانۀ')).toBe('خانه')
    expect(normalizePersianAnswer('خانهٔ')).toBe('خانه')
    expect(normalizePersianAnswer('أب')).toBe('اب')
    expect(normalizePersianAnswer('۱۲ ٣')).toBe('12 3')
    expect(normalizePersianAnswer('‏کتاب‍')).toBe('کتاب')
    expect(isPersianTranslationCorrect('همۀ', { fa: 'هر؛ همهٔ' })).toBe(true)
  })

  it('retains the normalized full gloss as an accepted answer', () => {
    expect(acceptedPersianAnswers({ fa: 'او را؛ به او (مذکر)' })).toContain('او را به او مذکر')
  })
})
