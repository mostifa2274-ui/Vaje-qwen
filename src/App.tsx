import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { GhesseState } from './engine/types'
import { clearSessionDrafts, createProgressReplacementToken, loadPersistedState, loadState, mergeConcurrentState, PROGRESS_REPLACEMENT_KEY, replacePersistedState, requestDurableStorage, saveState, signalProgressReplacement, STORAGE_KEY } from './engine/store'
import { CHAPTERS, VOCAB } from './data/chapters'
import { canOpenChapter, canOpenExam, canPrepareChapter, canReadChapter, examDefinition } from './engine/gates'
import { hashFor, rawViewFromHash, resolveView, viewLabel, type AppView as View } from './engine/routes'
import MapScreen from './pages/MapScreen'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import GoalCelebration from './components/GoalCelebration'
import { dailyProgress, recordActivity } from './engine/activity'
import { warmEnglishVoices } from './engine/narration'
import { loadClipIndex } from './engine/audioClips'
import { deployedBuildDiffers, fetchReleaseMarker } from './engine/release'
import { introduceWordsOfCompletedChapters } from './engine/progress'
import { diagnosticFailed } from './engine/diagnosticDraft'
import { nextBestAction } from './engine/analytics'
import { warmupTarget } from './engine/routeWarmup'

const WordPrepScreen = lazy(() => import('./pages/WordPrepScreen'))
const DiagnosticScreen = lazy(() => import('./pages/DiagnosticScreen'))
const ReaderScreen = lazy(() => import('./pages/ReaderScreen'))
const ReviewScreen = lazy(() => import('./pages/ReviewScreen'))
const ExamScreen = lazy(() => import('./pages/ExamScreen'))
const BookTestScreen = lazy(() => import('./pages/BookTestScreen'))
const GlossaryScreen = lazy(() => import('./pages/GlossaryScreen'))
const FlashcardsScreen = lazy(() => import('./pages/FlashcardsScreen'))
const OfflineAudioScreen = lazy(() => import('./pages/OfflineAudioScreen'))
const SettingsScreen = lazy(() => import('./pages/SettingsScreen'))

function RouteLoading() {
  return (
    <div className="app-page" role="status" aria-live="polite">
      <div className="app-task-header px-4 py-4">
        <p className="font-extrabold">در حال آماده‌سازی…</p>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>این بخش فقط یک‌بار بارگذاری می‌شود.</p>
      </div>
    </div>
  )
}

const FIRST = CHAPTERS[0].id
const VALID_CHAPTER_IDS = CHAPTERS.map(ch => ch.id)
const VALID_WORD_IDS = VOCAB.map(word => word.id)

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
  const [progressRevision, setProgressRevision] = useState(0)
  const stateRef = useRef(state)
  const progressReplacementMarkerRef = useRef<string | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const routeFocusReadyRef = useRef(false)

  const update = useCallback((candidate: GhesseState) => {
    const base = state
    const time = Date.now()
    // Every answer this change records counts towards today's goal.
    const next = recordActivity(candidate, base, time)
    const remote = loadPersistedState(time, FIRST, VALID_CHAPTER_IDS, VALID_WORD_IDS)

    // A reset/import can land in storage before this tab's queued storage
    // event runs. Detect its lineage synchronously here so a stale task submit
    // is discarded and remounted instead of waiting for that later callback.
    if (
      remote?.progressReplacementToken
      && remote.progressReplacementToken !== base.progressReplacementToken
    ) {
      clearSessionDrafts()
      setProgressRevision(revision => revision + 1)
      stateRef.current = remote
      setState(remote)
      setView(current => resolveView(current, remote))
      setPersistOk(true)
      setSyncConflict(false)
      return
    }

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
    // edits. Carry a fresh lineage token inside the authoritative snapshot so
    // other tabs can recognize the replacement from the STORAGE_KEY event
    // even if the auxiliary marker write is rejected.
    const replacementToken = createProgressReplacementToken()
    const replacement = { ...next, progressReplacementToken: replacementToken }
    clearSessionDrafts()
    stateRef.current = replacement
    setState(replacement)
    setSyncConflict(false)
    const persisted = replacePersistedState(replacement)
    setPersistOk(persisted)
    if (persisted) {
      const markerToken = signalProgressReplacement(replacementToken)
      if (markerToken) progressReplacementMarkerRef.current = markerToken
    }
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
    if (!canPrepareChapter(state, chapterId) || canReadChapter(state, chapterId)) return
    navigate(diagnosticFailed(chapterId)
      ? { name: 'prep', chapterId }
      : { name: 'diagnostic', chapterId })
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
    document.title = `${viewLabel(view)} — واژه‌خوان`
  }, [view])
  useEffect(() => {
    // Warm the usual next screen after home is visible. Save-Data and in-task
    // routes stay ahead of this; it never changes a gate or a route decision.
    if (view.name !== 'map') return
    const connection = navigator as Navigator & { connection?: { saveData?: boolean } }
    if (connection.connection?.saveData) return
    let cancelled = false
    const warmNext = () => {
      if (cancelled) return
      const target = warmupTarget(nextBestAction(stateRef.current, Date.now()))
      if (target === 'review') void import('./pages/ReviewScreen')
      else if (target === 'book-test') void import('./pages/BookTestScreen')
      else if (target === 'exam') void import('./pages/ExamScreen')
      else if (target === 'read') void import('./pages/ReaderScreen')
      else if (target === 'prep') void import('./pages/WordPrepScreen')
    }
    const idle = window.requestIdleCallback?.(warmNext, { timeout: 2500 })
    if (idle === undefined) {
      const timer = window.setTimeout(warmNext, 1500)
      return () => {
        cancelled = true
        window.clearTimeout(timer)
      }
    }
    return () => {
      cancelled = true
      window.cancelIdleCallback(idle)
    }
  }, [view.name])
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
    const replacementMarkerToken = () => {
      try {
        return localStorage.getItem(PROGRESS_REPLACEMENT_KEY)
      } catch {
        return null
      }
    }
    progressReplacementMarkerRef.current = replacementMarkerToken()

    const applyPersistedState = (replacement: boolean, next = loadCourseState()) => {
      if (replacement) {
        // sessionStorage is tab-local, so the tab that performed a reset/import
        // cannot clear this tab's active draft. Invalidate it here and force the
        // route subtree to remount before any stale task can write into the
        // replacement progress snapshot.
        clearSessionDrafts()
        setProgressRevision(revision => revision + 1)
      }
      stateRef.current = next
      setState(next)
      setView(current => resolveView(current, next))
      setPersistOk(true)
      setSyncConflict(false)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== PROGRESS_REPLACEMENT_KEY) return

      // The authoritative snapshot carries its own replacement lineage. The
      // legacy marker remains a second signal for compatibility, but a failed
      // marker write can no longer make an explicit reset/import look ordinary.
      const markerToken = replacementMarkerToken()
      const next = loadCourseState()
      const stateTokenChanged = Boolean(
        next.progressReplacementToken
        && next.progressReplacementToken !== stateRef.current.progressReplacementToken
      )
      const markerChanged = Boolean(
        markerToken
        && markerToken !== progressReplacementMarkerRef.current
        && markerToken !== stateRef.current.progressReplacementToken
      )
      if (markerToken) progressReplacementMarkerRef.current = markerToken

      const replacement = stateTokenChanged || markerChanged
      if (event.key === PROGRESS_REPLACEMENT_KEY && !replacement) return
      applyPersistedState(replacement, next)
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
    case 'offline-audio':
      screen = <OfflineAudioScreen onBack={backToMap} />
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
          onOpenOfflineAudio={() => navigate({ name: 'offline-audio' })}
          onOpenSettings={() => navigate({ name: 'settings' })}
        />
      )
  }

  const updateAvailable = Boolean(deployedCommit && deployedCommit !== dismissedCommit)
  // A new build is important, but never interrupt a graded/reading task or
  // discard intentionally ephemeral active-use text. Surface the refresh only
  // on the calm home screen; the pending commit remains remembered meanwhile.
  const showUpdateBanner = updateAvailable && view.name === 'map'

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
      {showUpdateBanner && deployedCommit && (
        <div className="app-update-banner" role="status" aria-label="به‌روزرسانی برنامه">
          <div className="min-w-0 flex-1">
            <b>نسخهٔ فعال برنامه تغییر کرده است.</b>
            <span> برای هماهنگ‌شدن با نسخهٔ جدید، صفحه را تازه کن.</span>
          </div>
          <div className="app-update-actions">
            <button type="button" className="btn-quiet px-3 text-xs" aria-label="بعداً این نسخه را تازه کن" onClick={() => setDismissedCommit(deployedCommit)}>بعداً</button>
            <button type="button" className="btn-ink px-3 text-xs" aria-label="تازه‌سازی و بارگذاری نسخهٔ جدید" onClick={() => { void refreshToDeployedBuild() }}>تازه‌سازی</button>
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
        className={`app-main${(!persistOk || syncConflict) ? ' has-top-banner' : ''}${showUpdateBanner ? ' has-bottom-banner' : ''}`}
        tabIndex={-1}
        aria-label={viewLabel(view)}
      >
        <RouteErrorBoundary key={`${progressRevision}:${hashFor(view)}`} onHome={backToMap}>
          <Suspense fallback={<RouteLoading />}>
            {screen}
          </Suspense>
        </RouteErrorBoundary>
      </main>
    </>
  )
}