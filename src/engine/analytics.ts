import { CHAPTERS, VOCAB, chaptersOfBook } from '../data/chapters'
import type { GhesseState, SkillDimension } from './types'
import { durableCoverage, masteredCoverage, masteryCounts, skillCoverage } from './mastery'
import { dueWordIds, retentionEstimate, troubleWordIds } from './review'
import { FINAL_EXAM_ID, MIDPOINT_EXAM_ID, bookExamId, canPrepareChapter, canReadChapter, canTakeExam, examPassed, examRemediationWordIds } from './gates'

const DAY = 86_400_000

export interface LearningHealth {
  introduced: number
  dueNow: number
  dueNext24h: number
  overdueLong: number
  trouble: number
  strong: number
  mastered: number
  durableCoverage: number
  masteredCoverage: number
  productiveCoverage: number
  fullSkillCoverage: number
  skillAccuracy: Record<SkillDimension, number>
  averageRetention: number
}

export function learningHealth(state: GhesseState, now = Date.now()): LearningHealth {
  const ids = VOCAB.map(w => w.id)
  const introduced = ids.filter(id => state.words[id]?.introduced)
  const dueNowIds = dueWordIds(state.words, now)
  const dueNext24h = introduced.filter(id => {
    const due = state.words[id]?.dueAt
    return due !== undefined && due > now && due <= now + DAY
  }).length
  const overdueLong = dueNowIds.filter(id => {
    const due = state.words[id]?.dueAt ?? now
    return now - due >= 3 * DAY
  }).length
  const trouble = troubleWordIds(state.words).length
  const counts = masteryCounts(state, CHAPTERS, ids)
  const productive = introduced.filter(id => (state.words[id]?.skillStats?.production?.correct ?? 0) > 0).length
  const fullSkill = introduced.filter(id => state.words[id] && skillCoverage(state.words[id]) === 1).length
  const dimensions: SkillDimension[] = ['meaning', 'context', 'production', 'form']
  const skillAccuracy = Object.fromEntries(dimensions.map(dimension => {
    let correct = 0
    let wrong = 0
    for (const id of introduced) {
      const stat = state.words[id]?.skillStats?.[dimension]
      correct += stat?.correct ?? 0
      wrong += stat?.wrong ?? 0
    }
    const total = correct + wrong
    return [dimension, total ? correct / total : 0]
  })) as Record<SkillDimension, number>
  const retentionValues = introduced
    .filter(id => (state.words[id]?.reviewCorrect ?? 0) + (state.words[id]?.reviewWrong ?? 0) > 0)
    .map(id => retentionEstimate(state.words[id], now))
  const averageRetention = retentionValues.length ? retentionValues.reduce((a, b) => a + b, 0) / retentionValues.length : 0
  return {
    introduced: introduced.length,
    dueNow: dueNowIds.length,
    dueNext24h,
    overdueLong,
    trouble,
    strong: counts.strong,
    mastered: counts.mastered,
    durableCoverage: durableCoverage(state, CHAPTERS, ids),
    masteredCoverage: masteredCoverage(state, CHAPTERS, ids),
    productiveCoverage: introduced.length ? productive / introduced.length : 0,
    fullSkillCoverage: introduced.length ? fullSkill / introduced.length : 0,
    skillAccuracy,
    averageRetention,
  }
}

export interface BookHealth {
  book: number
  words: number
  mastered: number
  strong: number
  learning: number
  due: number
  trouble: number
  durableCoverage: number
}

export function bookHealth(state: GhesseState, book: number, now = Date.now()): BookHealth {
  const ids = [...new Set(chaptersOfBook(book).flatMap(ch => ch.new))]
  const counts = masteryCounts(state, CHAPTERS, ids)
  const due = ids.filter(id => {
    const at = state.words[id]?.dueAt
    return at !== undefined && at <= now
  }).length
  const troubleSet = new Set(troubleWordIds(state.words))
  return {
    book,
    words: ids.length,
    mastered: counts.mastered,
    strong: counts.strong,
    learning: counts.learning + counts.seen,
    due,
    trouble: ids.filter(id => troubleSet.has(id)).length,
    durableCoverage: ids.length ? (counts.mastered + counts.strong) / ids.length : 0,
  }
}

export interface CertificationStatus {
  finalExamPassed: boolean
  masteredCoverage: number
  durableCoverage: number
  productiveCoverage: number
  fullSkillCoverage: number
  troubleWords: number
  overdueLong: number
  ready: boolean
  missing: string[]
}

export function certificationStatus(state: GhesseState, now = Date.now()): CertificationStatus {
  const health = learningHealth(state, now)
  const finalExamPassed = examPassed(state, FINAL_EXAM_ID)
  const missing: string[] = []
  if (!finalExamPassed) missing.push('قبولی در آزمون نهایی')
  if (health.introduced < VOCAB.length) missing.push('تکمیل همهٔ ۸۹۹ واژه')
  if (health.masteredCoverage < 0.95) missing.push('تسلط پایدار روی دست‌کم ۹۵٪ واژه‌ها')
  if (health.durableCoverage < 1) missing.push('قوی یا مسلط بودن همهٔ ۸۹۹ واژه')
  if (health.productiveCoverage < 0.98) missing.push('تولید فعال دست‌کم ۹۸٪ واژه‌ها')
  if (health.fullSkillCoverage < 0.95) missing.push('شواهد معنی، بافت، تولید و املاء برای دست‌کم ۹۵٪ واژه‌ها')
  if (health.trouble > 0) missing.push('رفع واژه‌های سختِ باقی‌مانده')
  if (health.overdueLong > 0) missing.push('تکمیل مرورهای بیش از ۳ روز عقب‌افتاده')
  return {
    finalExamPassed,
    masteredCoverage: health.masteredCoverage,
    durableCoverage: health.durableCoverage,
    productiveCoverage: health.productiveCoverage,
    fullSkillCoverage: health.fullSkillCoverage,
    troubleWords: health.trouble,
    overdueLong: health.overdueLong,
    ready: missing.length === 0,
    missing,
  }
}

export type NextAction =
  | { kind: 'review'; title: string; detail: string }
  | { kind: 'exam'; examId: string; title: string; detail: string }
  | { kind: 'chapter'; chapterId: string; prepared: boolean; title: string; detail: string }
  | { kind: 'certification'; title: string; detail: string }
  | { kind: 'complete'; title: string; detail: string }

export function nextBestAction(state: GhesseState, now = Date.now()): NextAction {
  const health = learningHealth(state, now)
  const remediation = examRemediationWordIds(state)
  if (remediation.length > 0) {
    return { kind: 'review', title: 'ترمیم قبل از آزمون', detail: `${remediation.length} واژه از آزمون قبلی هنوز باید بدون کمک بازیابی شود؛ پس از آن آزمون دوباره باز می‌شود.` }
  }
  if (health.dueNow >= Math.max(8, Math.ceil(state.dailyReviewGoal * 0.6)) || health.overdueLong > 0) {
    return { kind: 'review', title: 'اول مرورهای امروز', detail: `${health.dueNow} واژه سررسید دارد؛ تثبیت حافظه قبل از واژه‌های تازه مهم‌تر است.` }
  }

  for (let book = 1; book <= 8; book++) {
    const bookId = bookExamId(book)
    if (canTakeExam(state, bookId) && !examPassed(state, bookId)) {
      return { kind: 'exam', examId: bookId, title: `آزمون کتاب ${book}`, detail: 'این آزمون دروازهٔ ورود به کتاب بعدی است و یادآوری نوشتاری هم دارد.' }
    }
    if (book === 4 && canTakeExam(state, MIDPOINT_EXAM_ID) && !examPassed(state, MIDPOINT_EXAM_ID)) {
      return { kind: 'exam', examId: MIDPOINT_EXAM_ID, title: 'آزمون ویژهٔ نیمهٔ مسیر', detail: 'مرور تجمعی کتاب‌های ۱ تا ۴ پیش از شروع کتاب ۵.' }
    }
  }

  for (const chapter of CHAPTERS) {
    if (state.chapters[chapter.id]?.completed) continue
    if (!canPrepareChapter(state, chapter.id)) continue
    const prepared = canReadChapter(state, chapter.id)
    return {
      kind: 'chapter',
      chapterId: chapter.id,
      prepared,
      title: prepared ? `ادامه: ${chapter.titleFa}` : `آمادگی: ${chapter.titleFa}`,
      detail: prepared ? 'واژه‌های این فصل آماده‌اند؛ حالا آن‌ها را در قصه ببین.' : `${chapter.new.length} واژهٔ تازه را قبل از قصه مرور و بازیابی کن.`,
    }
  }

  if (canTakeExam(state, FINAL_EXAM_ID) && !examPassed(state, FINAL_EXAM_ID)) {
    return { kind: 'exam', examId: FINAL_EXAM_ID, title: 'آزمون نهایی ۸۹۹ واژه', detail: 'سنجش تجمعی با سهم بالای یادآوری نوشتاری.' }
  }

  const certification = certificationStatus(state, now)
  if (!certification.ready) {
    return { kind: 'certification', title: 'مرحلهٔ تثبیت نهایی', detail: certification.missing[0] ?? 'مرورهای فاصله‌دار را ادامه بده.' }
  }
  return { kind: 'complete', title: 'تسلط پایدار تأیید شد', detail: 'هم آزمون نهایی و هم معیارهای ماندگاری واژگان کامل شده‌اند.' }
}
