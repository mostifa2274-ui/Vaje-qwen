import type { GhesseState, SkillDimension } from '../engine/types'
import { BOOKS, CHAPTERS, chaptersOfBook } from '../data/chapters'
import { chapterMastery } from '../engine/mastery'
import { learningHealth, bookHealth, certificationStatus, nextBestAction } from '../engine/analytics'
import { BadgeCheckIcon, BookOpenTextIcon, CheckIcon, LockIcon, PlayIcon, RefreshCcwIcon, SettingsIcon } from '../components/Icons'
import {
  MIDPOINT_EXAM_ID,
  FINAL_EXAM_ID,
  bookCompleted,
  bookExamId,
  canPrepareChapter,
  canTakeExam,
  canTakeStoryTest,
  chapterPrepared,
  examPassed,
  examRemediationPending,
  storyTestPassed,
  storyTestRequired,
} from '../engine/gates'
import { STORY_TEST_PASS_RATE, previousQuestionCount, storyTestId, storyTestTitle, STORY_TEST_CURRENT_COUNT } from '../engine/storyTest'
import { faNum, percent } from '../engine/format'

interface Props {
  state: GhesseState
  now: number
  onOpenChapter: (id: string) => void
  onOpenExam: (id: string) => void
  onOpenStoryTest: (book: number) => void
  onOpenReview: () => void
  onOpenGlossary: () => void
  onOpenSettings: () => void
}

const SKILL_LABELS: Record<SkillDimension, string> = {
  meaning: 'معنی',
  context: 'بافت',
  production: 'تولید',
  form: 'املاء',
}

function ExamGate({
  id,
  title,
  state,
  onOpen,
  special = false,
}: {
  id: string
  title: string
  state: GhesseState
  onOpen: (id: string) => void
  special?: boolean
}) {
  const passed = examPassed(state, id)
  const available = canTakeExam(state, id)
  const progress = state.exams[id]
  const remediation = examRemediationPending(state, id)
  return (
    <div className={`exam-gate ${special ? 'special' : ''} ${passed ? 'passed' : ''}`}>
      <div className="exam-gate-icon" aria-hidden="true">
        {passed ? <CheckIcon className="h-5 w-5" /> : available ? <PlayIcon className="h-5 w-5" /> : <LockIcon className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-extrabold">{title}</div>
        <div className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
          {remediation
            ? `${passed ? 'حد نصاب پاس شده، اما ' : ''}${faNum(progress?.missedWordIds.length ?? 0)} واژهٔ از‌دست‌رفته باید در مرور هوشمند مستقل بازیابی شود.`
            : passed
              ? `قبول و جبران کامل${progress?.bestScore ? ` · بهترین امتیاز ${percent(progress.bestScore)}` : ''}`
              : available ? 'این آزمون دروازهٔ ادامهٔ مسیر است.' : 'پس از کامل‌شدن پیش‌نیازها باز می‌شود.'}
        </div>
      </div>
      <button type="button" className={passed && !remediation ? 'btn-paper px-3 py-2 text-sm' : 'btn-crimson px-3 py-2 text-sm'} disabled={!available} onClick={() => onOpen(id)}>
        {remediation ? 'اول جبران' : passed ? 'بازآزمایی' : 'شروع'}
      </button>
    </div>
  )
}

function StoryTestGate({ book, state, onOpen }: { book: number; state: GhesseState; onOpen: (book: number) => void }) {
  const passed = storyTestPassed(state, book)
  const available = canTakeStoryTest(state, book)
  const required = storyTestRequired(state, book)
  const progress = state.storyTests[storyTestId(book)]
  const questionCount = STORY_TEST_CURRENT_COUNT + previousQuestionCount(book)
  const scope = book === 1
    ? 'قصهٔ کتاب ۱'
    : book === 2
      ? 'قصهٔ این کتاب و مرور کتاب ۱'
      : `قصهٔ این کتاب و مرور کتاب‌های ۱ ${book === 3 ? 'و' : 'تا'} ${faNum(book - 1)}`
  return (
    <div className={`exam-gate story-gate ${passed ? 'passed' : ''}`}>
      <div className="exam-gate-icon" aria-hidden="true">
        {passed ? <CheckIcon className="h-5 w-5" /> : <BookOpenTextIcon className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-extrabold">{storyTestTitle(book)}</div>
        <div className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
          {passed
            ? `قبول${progress?.bestScore ? ` · بهترین امتیاز ${percent(progress.bestScore)}` : ''}`
            : `${faNum(questionCount)} سؤال از ${scope}؛ حد قبولی ${percent(STORY_TEST_PASS_RATE)}${required ? '' : ' · اختیاری'}.`}
        </div>
      </div>
      <button type="button" className={passed || !required ? 'btn-paper px-3 py-2 text-sm' : 'btn-crimson px-3 py-2 text-sm'} disabled={!available} onClick={() => onOpen(book)}>
        {passed ? 'بازآزمایی' : 'شروع'}
      </button>
    </div>
  )
}

export default function MapScreen({ state, now, onOpenChapter, onOpenExam, onOpenStoryTest, onOpenReview, onOpenGlossary, onOpenSettings }: Props) {
  const doneCount = CHAPTERS.filter(c => state.chapters[c.id]?.completed).length
  const health = learningHealth(state, now)
  const action = nextBestAction(state, now)
  const certification = certificationStatus(state, now)

  function runNextAction() {
    if (action.kind === 'review' || action.kind === 'certification') return onOpenReview()
    if (action.kind === 'exam') return onOpenExam(action.examId)
    if (action.kind === 'storyTest') return onOpenStoryTest(action.book)
    if (action.kind === 'chapter') return onOpenChapter(action.chapterId)
  }

  const actionLabel = action.kind === 'review'
    ? 'شروع مرور'
    : action.kind === 'exam' || action.kind === 'storyTest'
      ? 'شروع آزمون'
      : action.kind === 'chapter'
        ? action.prepared ? 'ورود به قصه' : 'آموزش واژه‌ها'
        : action.kind === 'certification'
          ? 'ادامهٔ تثبیت'
          : 'مسیر کامل شده'

  return (
    <div className="page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">قصه</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>۸۹۹ واژه؛ از اولین برخورد تا تسلط پایدار</p>
        </div>
        <div className="home-toolbar">
          <button className="btn-paper home-toolbar-button px-3 text-sm" onClick={onOpenGlossary} aria-label="واژه‌نامه">
            <BookOpenTextIcon className="h-5 w-5" />
            <span>واژه‌نامه</span>
          </button>
          <button className="btn-paper home-toolbar-icon" onClick={onOpenSettings} aria-label="تنظیمات">
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <section className="next-action-card mt-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold">قدم بعدی: {action.title}</h2>
          <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>{action.detail}</p>
        </div>
        {action.kind !== 'complete' && <button type="button" className="btn-crimson shrink-0 px-4 py-3" onClick={runNextAction}>{actionLabel}</button>}
        {action.kind === 'complete' && <BadgeCheckIcon className="h-8 w-8 shrink-0" aria-label="مسیر کامل شده" />}
      </section>

      <section className="journey-overview mt-4">
        <div className="journey-overview-head">
          <div>
            <h2 className="text-xl font-extrabold">مسیر یادگیری</h2>
            <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
              از آموزش و بازیابی فعال تا مرور فاصله‌دار و تسلط پایدار
            </p>
          </div>
          <div className="journey-chapter-count">
            <b>{faNum(doneCount)}</b>
            <span>از ۴۰ فصل</span>
          </div>
        </div>

        <div className="journey-metrics mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="metric-card"><b>{faNum(health.dueNow)}</b><span>سررسید مرور</span></div>
          <div className="metric-card"><b>{faNum(health.trouble)}</b><span>نیازمند تمرین</span></div>
          <div className="metric-card"><b>{faNum(health.mastered)}</b><span>مسلط</span></div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>پوشش قوی یا مسلط</span><span>{percent(health.durableCoverage)}</span>
          </div>
          <div className="mastery-progress mt-2"><span style={{ width: `${health.durableCoverage * 100}%` }} /></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
            <span>یادآوری نوشتاری: {percent(health.productiveCoverage)}</span>
            <span>تسلط پایدار: {percent(health.masteredCoverage)}</span>
          </div>
        </div>

        <div className="journey-skills mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
            <span>مهارت‌های واژگان دیده‌شده</span>
            <span>{percent(health.fullSkillCoverage)} پوشش چهارمهارتی</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(SKILL_LABELS) as SkillDimension[]).map(dimension => (
              <div key={dimension} className="skill-result">
                <div className="flex items-center justify-between gap-2 text-xs"><span>{SKILL_LABELS[dimension]}</span><b>{percent(health.skillAccuracy[dimension])}</b></div>
                <div className="skill-bar mt-1.5"><span style={{ width: `${health.skillAccuracy[dimension] * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <button type="button" className={`review-hero mt-4 w-full ${health.dueNow ? 'due' : ''}`} onClick={onOpenReview}>
        <span className="review-hero-icon" aria-hidden="true"><RefreshCcwIcon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1 text-right">
          <div className="font-extrabold">مرور هوشمند</div>
          <div className="mt-1 text-xs leading-6">
            {health.dueNow
              ? `${faNum(health.dueNow)} واژه اکنون سررسید دارد${health.overdueLong ? ` · ${faNum(health.overdueLong)} مورد بیش از ۳ روز عقب است` : ''}`
              : health.trouble ? `${faNum(health.trouble)} واژهٔ سخت برای تمرین هدفمند` : 'تمرین تقویتی بر اساس ضعیف‌ترین واژه‌ها'}
          </div>
        </div>
        <span className="review-badge">{health.dueNow ? faNum(health.dueNow) : health.trouble ? faNum(health.trouble) : 'تمرین'}</span>
      </button>

      <div className="paper-note mt-4">
        هر فصل: <b>آموزش ← ترجمهٔ نوشتاری ۱۰۰٪ ← شنیداری ۱۰۰٪ ← قصه.</b> قصه فقط بعد از پاس کامل هر دو آزمون باز می‌شود؛ تسلط پایدار بعداً با مرور فاصله‌دار ساخته می‌شود.
      </div>

      <div className="mt-6 space-y-6">
        {BOOKS.map(meta => {
          const chapters = chaptersOfBook(meta.book)
          const bookAvailable = chapters.some(ch => canPrepareChapter(state, ch.id) || state.chapters[ch.id]?.completed)
          const done = bookCompleted(state, meta.book)
          const mastery = chapters.reduce((sum, ch) => sum + chapterMastery(ch, state), 0) / chapters.length
          const bHealth = bookHealth(state, meta.book, now)
          const bookExam = bookExamId(meta.book)

          return (
            <div key={meta.book}>
              <section className={`book-section p-4 sm:p-5 ${!bookAvailable ? 'is-locked' : ''}`} style={{ background: meta.tint }}>
                <img src={meta.cover} alt="" className="book-banner" loading="lazy" width="800" height="300" />
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-extrabold">کتاب {faNum(meta.book)}: {meta.titleFa}</h2>
                    <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{meta.taglineFa}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="mastery-chip">{faNum(bHealth.words)} واژه</span>
                      {bHealth.due > 0 && <span className="mastery-chip">{faNum(bHealth.due)} سررسید</span>}
                      {bHealth.trouble > 0 && <span className="mastery-chip">{faNum(bHealth.trouble)} سخت</span>}
                    </div>
                  </div>
                  {examPassed(state, bookExam) && <span className="book-status-icon" title="آزمون کتاب پاس شده" aria-label="آزمون کتاب پاس شده"><BadgeCheckIcon className="h-6 w-6" /></span>}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2" dir="rtl">
                  {chapters.map((ch, i) => {
                    const prog = state.chapters[ch.id]
                    const isDone = prog?.completed === true
                    const prepared = chapterPrepared(state, ch.id)
                    const accessible = canPrepareChapter(state, ch.id)
                    const nodeState = isDone ? 'is-done' : prepared && accessible ? 'is-ready' : accessible ? 'is-current' : 'is-locked'
                    const status = isDone ? 'تمام شده' : prepared && accessible ? 'آمادهٔ خواندن' : accessible ? 'آموزش + آزمون واژه‌ها' : 'قفل'

                    return (
                      <div key={ch.id} className="flex items-center gap-2">
                        <button
                          className={`node-circle h-11 w-11 text-sm ${nodeState}`}
                          disabled={!accessible}
                          onClick={() => onOpenChapter(ch.id)}
                          title={`${ch.titleFa} — ${status}`}
                          aria-label={`فصل ${faNum(ch.n)}: ${ch.titleFa} — ${status}`}
                          aria-current={nodeState === 'is-current' ? 'step' : undefined}
                        >
                          {isDone
                            ? <CheckIcon className="h-5 w-5" />
                            : prepared && accessible
                              ? <PlayIcon className="h-5 w-5" />
                              : accessible
                                ? faNum(ch.n)
                                : <LockIcon className="h-4 w-4" />}
                        </button>
                        {i < chapters.length - 1 && <span className="chapter-connector" />}
                      </div>
                    )
                  })}
                </div>

                {bookAvailable && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      <span>توان واژگانی این کتاب</span>
                      <span>{percent(bHealth.durableCoverage)} قوی/مسلط · {percent(mastery)} امتیاز وزنی</span>
                    </div>
                    <div className="mastery-progress mt-1.5"><span style={{ width: `${bHealth.durableCoverage * 100}%`, background: 'var(--gold)' }} /></div>
                  </div>
                )}

                {done && (
                  <div className="mt-4 space-y-2">
                    <StoryTestGate book={meta.book} state={state} onOpen={onOpenStoryTest} />
                    <ExamGate id={bookExam} title={`آزمون واژه‌های کتاب ${faNum(meta.book)}`} state={state} onOpen={onOpenExam} />
                  </div>
                )}
              </section>

              {meta.book === 4 && <div className="mt-4"><ExamGate id={MIDPOINT_EXAM_ID} title="آزمون ویژهٔ کتاب‌های ۱ تا ۴" state={state} onOpen={onOpenExam} special /></div>}
              {meta.book === 8 && <div className="mt-4"><ExamGate id={FINAL_EXAM_ID} title="آزمون نهایی ۸۹۹ واژه" state={state} onOpen={onOpenExam} special /></div>}
            </div>
          )
        })}
      </div>

      {(certification.finalExamPassed || doneCount === CHAPTERS.length) && (
        <section className={`certification-card mt-6 ${certification.ready ? 'ready' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold">گواهی تسلط واقعی</h2>
              <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
                {certification.ready ? 'معیارهای تسلط پایدار کامل است' : 'آزمون پایان راه، پایان یادگیری نیست'}
              </p>
            </div>
            <BadgeCheckIcon className={`h-7 w-7 shrink-0 ${certification.ready ? '' : 'opacity-45'}`} aria-hidden="true" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="metric-card"><b>{percent(certification.masteredCoverage)}</b><span>مسلط</span></div>
            <div className="metric-card"><b>{percent(certification.durableCoverage)}</b><span>قوی + مسلط</span></div>
            <div className="metric-card"><b>{percent(certification.productiveCoverage)}</b><span>تولید فعال</span></div>
            <div className="metric-card"><b>{percent(certification.fullSkillCoverage)}</b><span>چهارمهارتی</span></div>
          </div>
          {!certification.ready && certification.missing.length > 0 && (
            <div className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
              قدم بعدی برای گواهی: <b>{certification.missing[0]}</b>.
            </div>
          )}
        </section>
      )}

      <div className="mt-8 text-center text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
        «مسلط» فقط با بازیابی موفق در چند روز، پاسخ نوشتاری و فاصلهٔ زمانی واقعی به دست می‌آید؛ قبولی در یک آزمون به‌تنهایی کافی نیست.
      </div>
    </div>
  )
}