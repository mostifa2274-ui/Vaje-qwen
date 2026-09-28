import type { GhesseState } from '../engine/types'
import { BOOKS, CHAPTERS, chaptersOfBook } from '../data/chapters'
import { learningHealth, bookHealth, certificationStatus, nextBestAction } from '../engine/analytics'
import { BadgeCheckIcon, BookOpenTextIcon, CheckIcon, FlashcardsIcon, LockIcon, PlayIcon, RefreshCcwIcon, SettingsIcon } from '../components/Icons'
import {
  MIDPOINT_EXAM_ID,
  FINAL_EXAM_ID,
  bookExamId,
  canOpenChapter,
  canOpenExam,
  canPrepareChapter,
  canTakeExam,
  chapterPrepared,
  examDefinition,
  examCleared,
  examPassed,
  examRemediationPending,
} from '../engine/gates'
import { faNum, percent } from '../engine/format'
import { leitnerSummary } from '../engine/leitner'

interface Props {
  state: GhesseState
  now: number
  onChange: (next: GhesseState) => void
  onOpenChapter: (id: string) => void
  onOpenExam: (id: string) => void
  onOpenReview: () => void
  onOpenGlossary: () => void
  onOpenFlashcards: () => void
  onOpenSettings: () => void
}

function ExamGate({
  id,
  title,
  state,
  onOpen,
  special = false,
  lockedHint,
}: {
  id: string
  title: string
  state: GhesseState
  onOpen: (id: string) => void
  special?: boolean
  /** Shown while the gate is locked, instead of the generic prerequisite line. */
  lockedHint?: string
}) {
  const passed = examPassed(state, id)
  const onPath = canTakeExam(state, id)
  const available = canOpenExam(state, id)
  const preview = available && !onPath
  const progress = state.exams[id]
  const remediation = examRemediationPending(state, id)
  return (
    <div className={`exam-gate ${special ? 'special' : ''} ${passed ? 'passed' : ''}`}>
      <div className="exam-gate-icon" aria-hidden="true">
        {remediation ? <RefreshCcwIcon className="h-5 w-5" /> : passed ? <CheckIcon className="h-5 w-5" /> : available ? <PlayIcon className="h-5 w-5" /> : <LockIcon className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-extrabold">{title}</div>
        <div className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
          {remediation
            ? `${passed ? 'حد نصاب پاس شده، اما ' : ''}${faNum(progress?.missedWordIds.length ?? 0)} واژهٔ از‌دست‌رفته باید در مرور هوشمند مستقل بازیابی شود.`
            : passed
              ? `قبول و جبران کامل${progress?.bestScore ? ` · بهترین امتیاز ${percent(progress.bestScore)}` : ''}`
              : preview ? 'پیش‌نمایش در حالت کاوش؛ نتیجه ثبت نمی‌شود.' : available ? 'این آزمون دروازهٔ ادامهٔ مسیر است.' : lockedHint ?? 'پس از کامل‌شدن پیش‌نیازها باز می‌شود.'}
        </div>
      </div>
      <button type="button" className={!available || (passed && !remediation) ? 'btn-paper px-3 py-2 text-sm' : 'btn-crimson px-3 py-2 text-sm'} disabled={!available} onClick={() => onOpen(id)}>
        {remediation && !preview ? 'اول جبران' : preview ? 'پیش‌نمایش' : passed ? 'بازآزمایی' : 'شروع'}
      </button>
    </div>
  )
}

export default function MapScreen({ state, now, onChange, onOpenChapter, onOpenExam, onOpenReview, onOpenGlossary, onOpenFlashcards, onOpenSettings }: Props) {
  const doneCount = CHAPTERS.filter(c => state.chapters[c.id]?.completed).length
  const health = learningHealth(state, now)
  const action = nextBestAction(state, now)
  const actionTitle = action.kind === 'chapter'
    ? CHAPTERS.find(chapter => chapter.id === action.chapterId)?.titleFa ?? action.title
    : action.title
  const certification = certificationStatus(state, now)
  const flashcardsDue = leitnerSummary(state, now).due

  function runNextAction() {
    if (action.kind === 'review' || action.kind === 'certification') return onOpenReview()
    if (action.kind === 'exam') return onOpenExam(action.examId)
    if (action.kind === 'chapter') return onOpenChapter(action.chapterId)
  }

  const actionLabel = action.kind === 'review'
    ? 'شروع مرور'
    : action.kind === 'exam'
      ? 'شروع آزمون'
      : action.kind === 'chapter'
        ? action.prepared ? 'ورود به قصه' : 'آموزش واژه‌ها'
        : action.kind === 'certification'
          ? 'ادامهٔ تثبیت'
          : 'مسیر کامل شده'

  return (
    <div className="app-page page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">قصه</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>۸۹۹ واژه؛ از اولین برخورد تا تسلط پایدار</p>
        </div>
        <div className="home-toolbar">
          <button type="button" className="btn-paper home-toolbar-button px-3 text-sm" onClick={onOpenGlossary} aria-label="واژه‌نامه">
            <BookOpenTextIcon className="h-5 w-5" />
            <span>واژه‌نامه</span>
          </button>
          <button
            type="button"
            className="btn-paper home-toolbar-button px-3 text-sm"
            onClick={onOpenFlashcards}
            aria-label={flashcardsDue ? `جعبهٔ لایتنر، ${faNum(flashcardsDue)} کارت برای مرور` : 'جعبهٔ لایتنر'}
            data-testid="open-flashcards"
          >
            <FlashcardsIcon className="h-5 w-5" />
            <span>لایتنر</span>
            {flashcardsDue > 0 && <span className="home-toolbar-badge" aria-hidden="true">{flashcardsDue > 99 ? '۹۹+' : faNum(flashcardsDue)}</span>}
          </button>
          <button type="button" className="btn-paper home-toolbar-icon" onClick={onOpenSettings} aria-label="تنظیمات">
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {state.exploreAll && (
        <div className="explore-note mt-4" role="status">
          <span><b>حالت کاوش روشن است.</b> همهٔ فصل‌ها و آزمون‌ها باز هستند؛ بخش‌هایی که هنوز به آن‌ها نرسیده‌ای فقط پیش‌نمایش‌اند و ثبت نمی‌شوند.</span>
          <button type="button" className="btn-quiet shrink-0 px-3 text-xs" onClick={() => onChange({ ...state, exploreAll: false })}>خاموش کردن</button>
        </div>
      )}

      <section className="next-action-card mt-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold">قدم بعدی: {actionTitle}</h2>
          <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>{action.detail}</p>
        </div>
        {action.kind !== 'complete' && <button type="button" className="btn-crimson shrink-0 px-4 py-3" onClick={runNextAction}>{actionLabel}</button>}
        {action.kind === 'complete' && <BadgeCheckIcon className="h-8 w-8 shrink-0" role="img" aria-hidden={false} aria-label="مسیر کامل شده" />}
      </section>

      <section className="home-summary mt-4" aria-label="خلاصهٔ پیشرفت">
        <div><b>{faNum(doneCount)}</b><span>فصل تمام‌شده</span></div>
        <div><b>{faNum(health.mastered)}</b><span>واژهٔ مسلط</span></div>
        <div><b>{percent(health.durableCoverage)}</b><span>قوی یا مسلط</span></div>
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

      <details className="method-details mt-4">
        <summary>روش یادگیری و معیارهای عبور</summary>
        <p>
          هر فصل: <b>آموزش ← ترجمهٔ نوشتاری ۱۰۰٪ ← شنیداری ۱۰۰٪ ← قصه و درک مطلب ← درک مطلب شنیداری.</b> قصه فقط بعد از پاس کامل هر دو آزمون واژه باز می‌شود و فصل وقتی تمام می‌شود که همهٔ پاسخ‌های درک مطلب خواندنی و شنیداری درست باشند. آزمون پایان کتاب در هر بخش حداقل {percent(examDefinition(bookExamId(1))!.passRate)} می‌خواهد؛ آزمون نیمهٔ مسیر {percent(examDefinition(MIDPOINT_EXAM_ID)!.passRate)} کل و {percent(examDefinition(MIDPOINT_EXAM_ID)!.productivePassRate)} یادآوری نوشتاری، و آزمون نهایی {percent(examDefinition(FINAL_EXAM_ID)!.passRate)} کل و {percent(examDefinition(FINAL_EXAM_ID)!.productivePassRate)} یادآوری نوشتاری می‌خواهد. واژه‌های از‌دست‌رفته همیشه پیش از ادامه جبران می‌شوند.
        </p>
      </details>

      <div className="mt-6 space-y-4">
        {BOOKS.map(meta => {
          const chapters = chaptersOfBook(meta.book)
          const bookAvailable = chapters.some(ch => canOpenChapter(state, ch.id) || state.chapters[ch.id]?.completed)
          const bookExam = bookExamId(meta.book)

          if (!bookAvailable) {
            return (
              <section key={meta.book} className="future-book-row" aria-label={`کتاب ${faNum(meta.book)}: ${meta.titleFa} — قفل`}>
                <span className="future-book-lock" aria-hidden="true"><LockIcon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-extrabold">کتاب {faNum(meta.book)}: {meta.titleFa}</h2>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--ink-soft)' }}>{meta.taglineFa}</p>
                </div>
                <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>بعداً</span>
              </section>
            )
          }

          const bHealth = bookHealth(state, meta.book, now)

          return (
            <div key={meta.book}>
              <section className="book-section p-4 sm:p-5">
                <div className="book-overview">
                  <div className="book-banner">
                    <img
                      src={meta.cover}
                      alt=""
                      width={640}
                      height={336}
                      decoding="async"
                      loading={meta.book === 1 ? 'eager' : 'lazy'}
                      fetchPriority={meta.book === 1 ? 'high' : 'auto'}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-extrabold">کتاب {faNum(meta.book)}: {meta.titleFa}</h2>
                      <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
                        {meta.taglineFa} · {faNum(bHealth.words)} واژه
                      </p>
                    </div>
                    {examCleared(state, bookExam) && <span className="book-status-icon" role="img" title="آزمون پایان کتاب پاس و جبران کامل شده" aria-label="آزمون پایان کتاب پاس و جبران کامل شده"><BadgeCheckIcon className="h-6 w-6" /></span>}
                  </div>
                </div>

                <ol className="chapter-list mt-4" aria-label={`فصل‌های کتاب ${faNum(meta.book)}`}>
                  {chapters.map(ch => {
                    const prog = state.chapters[ch.id]
                    const isDone = prog?.completed === true
                    const prepared = chapterPrepared(state, ch.id)
                    const onPath = canPrepareChapter(state, ch.id)
                    const accessible = canOpenChapter(state, ch.id)
                    const nodeState = isDone ? 'is-done' : prepared && onPath ? 'is-ready' : onPath ? 'is-current' : accessible ? 'is-preview' : 'is-locked'
                    const status = isDone ? 'تمام شده' : prepared && onPath ? 'آمادهٔ خواندن' : onPath ? 'آموزش + آزمون واژه‌ها' : accessible ? 'پیش‌نمایش در حالت کاوش' : 'قفل'

                    return (
                      <li key={ch.id}>
                        <button
                          type="button"
                          className={`chapter-row ${nodeState}`}
                          disabled={!accessible}
                          onClick={() => onOpenChapter(ch.id)}
                          aria-label={`فصل ${faNum(ch.n)}: ${ch.titleFa} — ${status}`}
                          aria-current={nodeState === 'is-current' ? 'step' : undefined}
                        >
                          <span className="chapter-number" aria-hidden="true">{faNum(ch.n)}</span>
                          <span className="chapter-label">
                            <span className="font-bold">{ch.titleFa}</span>
                            <span className="chapter-status">{status}</span>
                          </span>
                          <span className="chapter-state-icon" aria-hidden="true">
                            {isDone ? <CheckIcon className="h-5 w-5" /> : accessible ? <PlayIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>

                {bookAvailable && (
                  <div className="book-progress mt-3">
                    <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      <span>پیشرفت واژگان</span>
                      <span>{percent(bHealth.durableCoverage)}</span>
                    </div>
                    <div className="mastery-progress mt-1.5"><span style={{ width: `${bHealth.durableCoverage * 100}%`, background: 'var(--gold)' }} /></div>
                  </div>
                )}

                <div className="mt-4">
                  <ExamGate
                    id={bookExam}
                    title={examDefinition(bookExam)!.titleFa}
                    state={state}
                    onOpen={onOpenExam}
                    lockedHint={`پس از تمام‌شدن ${faNum(chapters.length)} فصل این کتاب باز می‌شود.`}
                  />
                </div>
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

    </div>
  )
}
