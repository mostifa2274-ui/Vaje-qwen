import type { CSSProperties } from 'react'
import type { GhesseState, SkillDimension } from '../engine/types'
import { BOOKS, CHAPTERS, chaptersOfBook } from '../data/chapters'
import { chapterMastery } from '../engine/mastery'
import { learningHealth, bookHealth, certificationStatus, nextBestAction } from '../engine/analytics'
import {
  MIDPOINT_EXAM_ID,
  FINAL_EXAM_ID,
  bookCompleted,
  bookExamId,
  canPrepareChapter,
  canTakeExam,
  examPassed,
  examRemediationPending,
} from '../engine/gates'

interface Props {
  state: GhesseState
  onOpenChapter: (id: string) => void
  onOpenExam: (id: string) => void
  onOpenReview: () => void
  onOpenGlossary: () => void
  onOpenSettings: () => void
}

function faNum(n: number): string {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
}

function percent(value: number): string {
  return `${faNum(Math.round(value * 100))}٪`
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
      <div className="min-w-0 flex-1">
        <div className="font-extrabold">{passed ? '✓ ' : available ? '● ' : '🔒 '}{title}</div>
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

export default function MapScreen({ state, onOpenChapter, onOpenExam, onOpenReview, onOpenGlossary, onOpenSettings }: Props) {
  const now = Date.now()
  const doneCount = CHAPTERS.filter(c => state.chapters[c.id]?.completed).length
  const health = learningHealth(state, now)
  const action = nextBestAction(state, now)
  const certification = certificationStatus(state, now)

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
        ? action.prepared ? 'ورود به قصه' : 'مرور واژه‌های فصل'
        : action.kind === 'certification'
          ? 'ادامهٔ تثبیت'
          : 'مسیر کامل شده'

  return (
    <div className="page-in mx-auto max-w-lg px-4 pb-28 pt-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">قصه</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>۸۹۹ واژه؛ از اولین برخورد تا تسلط پایدار</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-paper px-3 py-2 text-sm" onClick={onOpenGlossary}>واژه‌نامه</button>
          <button className="btn-paper px-3 py-2 text-sm" onClick={onOpenSettings} aria-label="تنظیمات">⚙</button>
        </div>
      </header>

      <section className="next-action-card mt-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold" style={{ color: 'var(--crimson-deep)' }}>بهترین قدم بعدی</div>
          <h2 className="mt-1 text-xl font-extrabold">{action.title}</h2>
          <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>{action.detail}</p>
        </div>
        {action.kind !== 'complete' && <button type="button" className="btn-crimson shrink-0 px-4 py-3" onClick={runNextAction}>{actionLabel}</button>}
        {action.kind === 'complete' && <span className="text-3xl">🏆</span>}
      </section>

      <div className="paper-card-flat mt-4 overflow-hidden">
        <div className="story-hero" role="img" aria-label="مینا و نینو — مسیر قصه">
          <div className="story-hero-sun" />
          <div className="story-hero-copy">
            <span className="story-hero-kicker">MINA &amp; NINO</span>
            <strong>قصه‌ای برای تسلط واقعی بر واژه‌ها</strong>
            <span>از حدس و قصه تا یادآوری پایدار</span>
          </div>
          <div className="story-hero-cat" aria-hidden="true">⌁</div>
        </div>
        <div className="grid grid-cols-4 gap-2 p-3 text-center">
          <div className="metric-card"><b>{faNum(doneCount)}</b><span>۴۰ فصل</span></div>
          <div className="metric-card"><b>{faNum(health.dueNow)}</b><span>سررسید</span></div>
          <div className="metric-card"><b>{faNum(health.trouble)}</b><span>سخت</span></div>
          <div className="metric-card"><b>{faNum(health.mastered)}</b><span>مسلط</span></div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>پوشش قوی یا مسلط</span><span>{percent(health.durableCoverage)}</span>
          </div>
          <div className="mastery-progress mt-2"><span style={{ width: `${health.durableCoverage * 100}%` }} /></div>
          <div className="mt-3 flex items-center justify-between text-xs" style={{ color: 'var(--ink-soft)' }}>
            <span>یادآوری نوشتاری: {percent(health.productiveCoverage)}</span>
            <span>تسلط پایدار: {percent(health.masteredCoverage)}</span>
          </div>
          <div className="mt-4 border-t-2 border-dashed border-[var(--ink)] pt-3">
            <div className="flex items-center justify-between text-xs font-bold"><span>نقشهٔ مهارت کل واژگان دیده‌شده</span><span>{percent(health.fullSkillCoverage)} پوشش چهارمهارتی</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(Object.keys(SKILL_LABELS) as SkillDimension[]).map(dimension => (
                <div key={dimension} className="skill-result">
                  <div className="flex items-center justify-between text-xs"><span>{SKILL_LABELS[dimension]}</span><b>{percent(health.skillAccuracy[dimension])}</b></div>
                  <div className="skill-bar mt-1"><span style={{ width: `${health.skillAccuracy[dimension] * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button type="button" className={`review-hero mt-4 w-full ${health.dueNow ? 'due' : ''}`} onClick={onOpenReview}>
        <div className="text-right">
          <div className="font-extrabold">مرور هوشمند</div>
          <div className="mt-1 text-xs">
            {health.dueNow
              ? `${faNum(health.dueNow)} واژه اکنون سررسید دارد${health.overdueLong ? ` · ${faNum(health.overdueLong)} مورد بیش از ۳ روز عقب است` : ''}`
              : health.trouble ? `${faNum(health.trouble)} واژهٔ سخت برای تمرین هدفمند` : 'تمرین تقویتی بر اساس ضعیف‌ترین واژه‌ها'}
          </div>
        </div>
        <span className="review-badge">{health.dueNow ? faNum(health.dueNow) : health.trouble ? faNum(health.trouble) : 'تمرین'}</span>
      </button>

      <div className="paper-note mt-4">
        هر فصل: <b>حدس کم‌فشار + بازخورد آموزشی ← شناخت همهٔ واژه‌ها ← یادآوری نوشتاریِ خطاها و نمونهٔ هدفمند ← قصه ← مرور فاصله‌دار و چندمهارتی.</b> پایان هر کتاب آزمون دارد؛ کتاب ۴ و پایان مسیر آزمون تجمعی ویژه دارند.
      </div>

      <div className="mt-6 space-y-6">
        {BOOKS.map(meta => {
          const chapters = chaptersOfBook(meta.book)
          const bookAvailable = chapters.some(ch => canPrepareChapter(state, ch.id) || state.chapters[ch.id]?.completed)
          const done = bookCompleted(state, meta.book)
          const mastery = chapters.reduce((sum, ch) => sum + chapterMastery(ch, state, CHAPTERS), 0) / chapters.length
          const bHealth = bookHealth(state, meta.book, now)
          const bookExam = bookExamId(meta.book)

          return (
            <div key={meta.book}>
              <section className={`paper-card relative p-4 ${!bookAvailable ? 'opacity-70' : ''}`} style={{ background: meta.tint }}>
                <div className="absolute -top-2 right-6 flex gap-3">
                  {[0, 1, 2].map(i => <span key={i} className="block h-4 w-4 rounded-full" style={{ background: 'var(--paper)', border: '2px solid var(--ink)' }} />)}
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div className="book-cover-mark" aria-hidden="true" style={{ background: meta.tint }}>
                    <span>{faNum(meta.book)}</span>
                    <small>{meta.titleEn}</small>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-extrabold">کتاب {faNum(meta.book)}: {meta.titleFa}</h2>
                    <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{meta.taglineFa}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="mastery-chip">{faNum(bHealth.words)} واژه</span>
                      {bHealth.due > 0 && <span className="mastery-chip">{faNum(bHealth.due)} سررسید</span>}
                      {bHealth.trouble > 0 && <span className="mastery-chip">{faNum(bHealth.trouble)} سخت</span>}
                    </div>
                  </div>
                  {examPassed(state, bookExam) && <span className="pop text-2xl" title="آزمون کتاب پاس شده">🏅</span>}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2" dir="rtl">
                  {chapters.map((ch, i) => {
                    const prog = state.chapters[ch.id]
                    const isDone = prog?.completed === true
                    const prepared = Boolean(prog?.preparedAt)
                    const accessible = canPrepareChapter(state, ch.id)
                    let bg = 'var(--cream-soft)'
                    let fg = 'var(--ink-soft)'
                    let label = accessible ? faNum(ch.n) : '🔒'
                    let outline: CSSProperties = {}
                    if (isDone) { bg = 'var(--ink)'; fg = 'var(--cream)'; label = '✓' }
                    else if (prepared && accessible) { bg = 'var(--gold)'; fg = 'var(--ink)'; label = '▶' }
                    else if (accessible) { bg = 'var(--crimson)'; fg = '#fff'; outline = { outline: '3px dashed var(--ink)', outlineOffset: 3 } }

                    return (
                      <div key={ch.id} className="flex items-center gap-2">
                        <button
                          className="node-circle h-11 w-11 text-sm"
                          style={{ background: bg, color: fg, ...outline }}
                          disabled={!accessible}
                          onClick={() => onOpenChapter(ch.id)}
                          title={isDone ? `${ch.titleFa} — تمام شده` : prepared ? `${ch.titleFa} — آمادهٔ خواندن` : `${ch.titleFa} — مرور واژه‌ها`}
                          aria-label={`فصل ${faNum(ch.n)}: ${ch.titleFa}`}
                        >{label}</button>
                        {i < chapters.length - 1 && <span className="inline-block h-0 w-4" style={{ borderTop: '3px dashed rgba(43,42,38,0.55)' }} />}
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

                {done && <div className="mt-4"><ExamGate id={bookExam} title={`آزمون کتاب ${faNum(meta.book)}`} state={state} onOpen={onOpenExam} /></div>}
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
              <div className="text-xs font-extrabold" style={{ color: 'var(--crimson-deep)' }}>گواهی تسلط واقعی</div>
              <h2 className="mt-1 text-xl font-extrabold">{certification.ready ? 'معیارهای تسلط پایدار کامل است' : 'آزمون پایان راه، پایان یادگیری نیست'}</h2>
            </div>
            <span className="text-3xl">{certification.ready ? '🏆' : '◔'}</span>
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
