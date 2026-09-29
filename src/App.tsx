import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { GhesseState } from './engine/types'
import { loadPersistedState, loadState, mergeConcurrentState, requestDurableStorage, saveState, STORAGE_KEY } from './engine/store'
import { CHAPTERS, CHAPTER_BY_ID, VOCAB } from './data/chapters'
import { canOpenChapter, canOpenExam, canOpenStory, canPrepareChapter, canReadChapter, examDefinition } from './engine/gates'
import MapScreen from './pages/MapScreen'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import GoalCelebration from './components/GoalCelebration'
import { dailyProgress, recordActivity } from './engine/activity'
import { warmEnglishVoices } from './engine/narration'
import { loadClipIndex } from './engine/audioClips'
import { deployedBuildDiffers, fetchReleaseMarker } from './engine/release'
import { introduceWordsOfCompletedChapters } from './engine/progress'

const WordPrepScreen = lazy(() => import('./pages/WordPrepScreen'))
const DiagnosticScreen = lazy(() => import('./pages/DiagnosticScreen'))
const ReaderScreen = lazy(() => import('./pages/ReaderScreen'))
const ReviewScreen = lazy(() => import('./pages/ReviewScreen'))
const ExamScreen = lazy(() => import('./pages/ExamScreen'))
const BookTestScreen = lazy(() => import('./pages/BookTestScreen'))
const GlossaryScreen = lazy(() => import('./pages/GlossaryScreen'))
const FlashcardsScreen = lazy(() => import('./pages/FlashcardsScreen'))
const SettingsScreen = lazy(() => import('./pages/SettingsScreen'))

type View =
  | { name: 'map' }
  | { name: 'prep'; chapterId: string }
  | { name: 'diagnostic'; chapterId: string }
  | { name: 'read'; chapterId: string }
  | { name: 'review' }
  | { name: 'exam'; examId: string }
  | { name: 'glossary' }
  | { name: 'flashcards' }
  | { name: 'settings' }

function RouteLoading() {
  return (
    <div className="page-in mx-auto max-w-3xl px-4 py-14 text-center" role="status" aria-live="polite">
      <p className="font-extrabold">در حال آماده‌سازی…</p>
      <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>این بخش فقط یک‌بار بارگذاری می‌شود.</p>
    </div>
  )
}

const FIRST = CHAPTERS[0].id
const VALID_CHAPTER_IDS = CHAPTERS.map(ch => ch.id)
const VALID_WORD_IDS = VOCAB.map(word => word.id)

function safeDecodeRouteSegment(value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

function rawViewFromHash(): View {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash === 'review') return { name: 'review' }
  if (hash === 'glossary') return { name: 'glossary' }
  if (hash === 'flashcards') return { name: 'flashcards' }
  if (hash === 'settings') return { name: 'settings' }
  if (hash.startsWith('prep/')) {
    const chapterId = safeDecodeRouteSegment(hash.slice(5))
    if (chapterId && CHAPTER_BY_ID.has(chapterId)) return { name: 'prep', chapterId }
  }
  if (hash.startsWith('diagnostic/')) {
    const chapterId = safeDecodeRouteSegment(hash.slice(11))
    if (chapterId && CHAPTER_BY_ID.has(chapterId)) return { name: 'diagnostic', chapterId }
  }
  if (hash.startsWith('read/')) {
    const chapterId = safeDecodeRouteSegment(hash.slice(5))
    if (chapterId && CHAPTER_BY_ID.has(chapterId)) return { name: 'read', chapterId }
  }
  if (hash.startsWith('exam/')) {
    const examId = safeDecodeRouteSegment(hash.slice(5))
    if (examId && examDefinition(examId)) return { name: 'exam', examId }
  }
  return { name: 'map' }
}

function resolveView(view: View, state: GhesseState): View {
  if (view.name === 'read') {
    if (!canOpenChapter(state, view.chapterId)) return { name: 'map' }
    if (!canOpenStory(state, view.chapterId)) return { name: 'prep', chapterId: view.chapterId }
  }
  if (view.name === 'prep') {
    if (!canOpenChapter(state, view.chapterId)) return { name: 'map' }
    // A prepared chapter goes straight to its story; explore mode may revisit its words.
    if (!state.exploreAll && canReadChapter(state, view.chapterId)) return { name: 'read', chapterId: view.chapterId }
  }
  if (view.name === 'diagnostic') {
    // Prove-known is only for the learner's actual next chapter, never an
    // Explore preview. A prepared direct URL resolves straight to reading.
    if (!canPrepareChapter(state, view.chapterId)) return { name: 'map' }
    if (canReadChapter(state, view.chapterId)) return { name: 'read', chapterId: view.chapterId }
  }
  if (view.name === 'exam' && !canOpenExam(state, view.examId)) return { name: 'map' }
  return view
}

function hashFor(view: View): string {
  if (view.name === 'prep') return `#/prep/${encodeURIComponent(view.chapterId)}`
  if (view.name === 'diagnostic') return `#/diagnostic/${encodeURIComponent(view.chapterId)}`
  if (view.name === 'read') return `#/read/${encodeURIComponent(view.chapterId)}`
  if (view.name === 'review') return '#/review'
  if (view.name === 'exam') return `#/exam/${encodeURIComponent(view.examId)}`
  if (view.name === 'glossary') return '#/glossary'
  if (view.name === 'flashcards') return '#/flashcards'
  if (view.name === 'settings') return '#/settings'
  return '#/map'
}

function viewLabel(view: View): string {
  if (view.name === 'prep') {
    const chapter = CHAPTER_BY_ID.get(view.chapterId)
    return chapter ? `آمادگی فصل: ${chapter.titleFa}` : 'آمادگی فصل'
  }
  if (view.name === 'diagnostic') {
    const chapter = CHAPTER_BY_ID.get(view.chapterId)
    return chapter ? `تعیین سطح فصل: ${chapter.titleFa}` : 'تعیین سطح فصل'
  }
  if (view.name === 'read') {
    const chapter = CHAPTER_BY_ID.get(view.chapterId)
    return chapter ? `خواندن داستان: ${chapter.titleFa}` : 'خواندن داستان'
  }
  if (view.name === 'review') return 'مرور هوشمند'
  if (view.name === 'exam') return examDefinition(view.examId)?.titleFa ?? 'آزمون'
  if (view.name === 'glossary') return 'واژه‌نامه'
  if (view.name === 'flashcards') return 'جعبهٔ لایتنر'
  if (view.name === 'settings') return 'تنظیمات'
  return 'مسیر یادگیری'
}

/**
 * The progress this tab starts from. Its first save writes back any repair or
 * migration at once, and reports whether the browser can keep progress.
 */
function startCourseState(): { state: GhesseState; persisted: boolean } {
  const state = loadCourseState()
  return { state, persisted: saveState(state) }
}

function loadCourseState(): GhesseState {
  const now = Date.now()
  return introduceWordsOfCompletedChapters(loadState(now, FIRST, VALID_CHAPTER_IDS, VALID_WORD_IDS), CHAPTERS, now)
}

export default function App() {
  const [startup] = useState(startCourseState)
  const [state, setState] = useState<GhesseState>(startup.state)
  const [view, setView] = useState<View>(() => resolveView(rawViewFromHash(), state))
  const [persistOk, setPersistOk] = useState(startup.persisted)
  const [syncConflict, setSyncConflict] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [celebration, setCelebration] = useState<{ streak: number; at: number } | null>(null)
  const [deployedCommit, setDeployedCommit] = useState<string | null>(null)
  const [dismissedCommit, setDismissedCommit] = useState<string | null>(null)
  const stateRef = useRef(state)
  const mainRef = useRef<HTMLElement>(null)
  const routeFocusReadyRef = useRef(false)

  const update = useCallback((candidate: GhesseState) => {
    const base = state
    const time = Date.now()
    // Every answer this change records counts towards today's goal.
    const next = recordActivity(candidate, base, time)
    const remote = loadPersistedState(time, FIRST, VALID_CHAPTER_IDS, VALID_WORD_IDS)
    const reconciled = remote ? mergeConcurrentState(base, next, remote) : next

    if (!reconciled && remote) {
      // A stale screen and another tab changed the same atomic learning record
      // differently. Never invent a merge that could overstate mastery.
      stateRef.current = remote
      setState(remote)
      setView(current => resolveView(current, remote))
      setPersistOk(saveState(remote))
      setSyncConflict(true)
      return
    }

    const resolved = reconciled ?? next
    stateRef.current = resolved
    setState(resolved)
    setSyncConflict(false)
    setPersistOk(saveState(resolved))
    // Only after the learner has done something worth keeping.
    requestDurableStorage()
    const after = dailyProgress(resolved, time)
    if (after.met && !dailyProgress(base, time).met) setCelebration({ streak: after.streak, at: time })
  }, [state])

  const closeCelebration = useCallback(() => setCelebration(null), [])

  const navigate = useCallback((next: View, replace = false) => {
    const currentDepth = typeof history.state?.ghesseDepth === 'number' ? history.state.ghesseDepth : 0
    const statePayload = { ghesse: true, ghesseDepth: replace ? currentDepth : currentDepth + 1 }
    if (replace) history.replaceState(statePayload, '', hashFor(next))
    else history.pushState(statePayload, '', hashFor(next))
    setView(next)
  }, [])

  const backToMap = useCallback(() => {
    const depth = typeof history.state?.ghesseDepth === 'number' ? history.state.ghesseDepth : 0
    if (depth > 0) history.go(-depth)
    else navigate({ name: 'map' }, true)
  }, [navigate])

  const replaceProgress = useCallback((next: GhesseState) => {
    // Reset/import are explicit replacement actions, not ordinary stale-screen
    // edits, so they intentionally replace the persisted snapshot exactly.
    stateRef.current = next
    setState(next)
    setSyncConflict(false)
    setPersistOk(saveState(next))
    navigate({ name: 'map' }, true)
  }, [navigate])

  const openChapter = useCallback((chapterId: string) => {
    if (!canOpenChapter(state, chapterId)) return
    // A chapter on the learner's path opens as usual; one reached only through
    // explore mode opens on its story, which links to its words.
    const onPath = canPrepareChapter(state, chapterId)
    navigate(!onPath || canReadChapter(state, chapterId) ? { name: 'read', chapterId } : { name: 'prep', chapterId })
  }, [navigate, state])

  const openPrep = useCallback((chapterId: string) => {
    if (canOpenChapter(state, chapterId)) navigate({ name: 'prep', chapterId })
  }, [navigate, state])

  const openDiagnostic = useCallback((chapterId: string) => {
    if (canPrepareChapter(state, chapterId) && !canReadChapter(state, chapterId)) {
      navigate({ name: 'diagnostic', chapterId })
    }
  }, [navigate, state])

  const openExam = useCallback((examId: string) => {
    if (canOpenExam(state, examId)) navigate({ name: 'exam', examId })
  }, [navigate, state])

  useEffect(() => {
    const initial = resolveView(rawViewFromHash(), state)
    if (initial.name === 'map') {
      history.replaceState({ ghesse: true, ghesseDepth: 0 }, '', hashFor(initial))
    } else {
      history.replaceState({ ghesse: true, ghesseDepth: 0 }, '', hashFor({ name: 'map' }))
      history.pushState({ ghesse: true, ghesseDepth: 1 }, '', hashFor(initial))
    }
    // The state initializer already resolved this initial route. Re-setting the
    // same logical view here creates a second object identity and can race with
    // the skip-link's first keyboard focus via the route-focus effect.
    const onPopState = () => {
      const resolved = resolveView(rawViewFromHash(), stateRef.current)
      if (hashFor(resolved) !== window.location.hash) history.replaceState(history.state, '', hashFor(resolved))
      setView(resolved)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // Initial history setup is intentionally one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    if (!routeFocusReadyRef.current) {
      routeFocusReadyRef.current = true
      return
    }
    const frame = window.requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [view])
  useEffect(() => {
    document.title = `${viewLabel(view)} — قصه`
  }, [view])
  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.setAttribute('lang', 'fa')
    warmEnglishVoices()

    const refreshClipIndex = () => { void loadClipIndex() }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshClipIndex()
    }

    refreshClipIndex()
    window.addEventListener('online', refreshClipIndex)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('online', refreshClipIndex)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const next = loadCourseState()
      stateRef.current = next
      setState(next)
      setView(current => resolveView(current, next))
      setPersistOk(true)
      setSyncConflict(false)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD) return
    const checkForDeployedUpdate = () => {
      void fetchReleaseMarker(import.meta.env.BASE_URL).then(marker => {
        setDeployedCommit(deployedBuildDiffers(marker) ? marker?.commit?.trim() || null : null)
      })
    }
    checkForDeployedUpdate()
    const timer = window.setInterval(checkForDeployedUpdate, 5 * 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkForDeployedUpdate()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  async function refreshToDeployedBuild() {
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      await registration?.update()
    } catch {
      // A page reload still uses network-first navigation even if SW update fails.
    }
    window.location.reload()
  }

  let screen: ReactNode
  switch (view.name) {
    case 'prep':
      screen = (
        <WordPrepScreen
          key={view.chapterId}
          chapterId={view.chapterId}
          state={state}
          onChange={update}
          onBack={backToMap}
          onReady={() => navigate({ name: 'read', chapterId: view.chapterId }, true)}
        />
      )
      break
    case 'diagnostic':
      screen = (
        <DiagnosticScreen
          key={view.chapterId}
          chapterId={view.chapterId}
          state={state}
          onChange={update}
          onBack={backToMap}
          onTeach={() => navigate({ name: 'prep', chapterId: view.chapterId }, true)}
          onReady={() => navigate({ name: 'read', chapterId: view.chapterId }, true)}
          now={now}
        />
      )
      break
    case 'read':
      screen = (
        <ReaderScreen
          key={view.chapterId}
          chapterId={view.chapterId}
          state={state}
          onChange={update}
          onBack={backToMap}
          onOpenChapter={openChapter}
          onOpenPrep={openPrep}
          onOpenExam={openExam}
        />
      )
      break
    case 'review':
      screen = <ReviewScreen state={state} now={now} onChange={update} onBack={backToMap} />
      break
    case 'exam': {
      const book = examDefinition(view.examId)?.book
      screen = book ? (
        <BookTestScreen
          key={view.examId}
          book={book}
          state={state}
          onChange={update}
          onBack={backToMap}
          onReview={() => navigate({ name: 'review' }, true)}
        />
      ) : (
        <ExamScreen
          key={view.examId}
          examId={view.examId}
          state={state}
          onChange={update}
          onBack={backToMap}
          onReview={() => navigate({ name: 'review' }, true)}
        />
      )
      break
    }
    case 'glossary':
      screen = <GlossaryScreen state={state} onChange={update} onBack={backToMap} />
      break
    case 'flashcards':
      screen = <FlashcardsScreen state={state} now={now} onChange={update} onBack={backToMap} />
      break
    case 'settings':
      screen = (
        <SettingsScreen
          state={state}
          onChange={update}
          onBack={backToMap}
          onReset={replaceProgress}
          onImport={replaceProgress}
          firstChapterId={FIRST}
          validChapterIds={VALID_CHAPTER_IDS}
          validWordIds={VALID_WORD_IDS}
        />
      )
      break
    default:
      screen = (
        <MapScreen
          state={state}
          now={now}
          onChange={update}
          onOpenChapter={openChapter}
          onOpenDiagnostic={openDiagnostic}
          onOpenExam={openExam}
          onOpenReview={() => navigate({ name: 'review' })}
          onOpenGlossary={() => navigate({ name: 'glossary' })}
          onOpenFlashcards={() => navigate({ name: 'flashcards' })}
          onOpenSettings={() => navigate({ name: 'settings' })}
        />
      )
  }

  const updateAvailable = Boolean(deployedCommit && deployedCommit !== dismissedCommit)

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={event => {
          event.preventDefault()
          mainRef.current?.focus({ preventScroll: true })
          mainRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
        }}
      >
        رفتن به محتوای اصلی
      </a>
      {!persistOk && (
        <div className="storage-warning" role="alert">
          ذخیره‌سازی مرورگر در دسترس نیست؛ پیشرفت این جلسه ممکن است پس از بستن صفحه از بین برود. از تنظیمات نسخهٔ پشتیبان بگیر.
        </div>
      )}
      {syncConflict && (
        <div className="storage-warning" role="alert">
          پیشرفت در برگهٔ دیگری هم‌زمان تغییر کرده بود. برای جلوگیری از بازنویسی، نسخهٔ ذخیره‌شده نگه داشته شد؛ دوباره تلاش کن.
        </div>
      )}
      {updateAvailable && deployedCommit && (
        <div className="app-update-banner" role="status">
          <div className="min-w-0 flex-1">
            <b>نسخهٔ فعال برنامه تغییر کرده است.</b>
            <span> برای هماهنگ‌شدن با نسخهٔ جدید، صفحه را تازه کن.</span>
          </div>
          <div className="app-update-actions">
            <button type="button" className="btn-quiet px-3 text-xs" onClick={() => setDismissedCommit(deployedCommit)}>بعداً</button>
            <button type="button" className="btn-ink px-3 text-xs" onClick={() => { void refreshToDeployedBuild() }}>تازه‌سازی</button>
          </div>
        </div>
      )}
      {/* Tests and story reading keep their focus; the note waits for the next calmer screen. */}
      {celebration && view.name !== 'exam' && view.name !== 'read' && (
        <GoalCelebration key={celebration.at} streak={celebration.streak} onClose={closeCelebration} />
      )}
      <main
        id="main-content"
        ref={mainRef}
        className="app-main"
        tabIndex={-1}
        aria-label={viewLabel(view)}
      >
        <RouteErrorBoundary key={hashFor(view)} onHome={backToMap}>
          <Suspense fallback={<RouteLoading />}>
            {screen}
          </Suspense>
        </RouteErrorBoundary>
      </main>
    </>
  )
}