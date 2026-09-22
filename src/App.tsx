import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { GhesseState } from './engine/types'
import { loadState, saveState, STORAGE_KEY } from './engine/store'
import { CHAPTERS, CHAPTER_BY_ID, VOCAB } from './data/chapters'
import { canPrepareChapter, canReadChapter, canTakeExam, examDefinition } from './engine/gates'
import MapScreen from './pages/MapScreen'
import WordPrepScreen from './pages/WordPrepScreen'
import ReaderScreen from './pages/ReaderScreen'
import ReviewScreen from './pages/ReviewScreen'
import ExamScreen from './pages/ExamScreen'
import GlossaryScreen from './pages/GlossaryScreen'
import SettingsScreen from './pages/SettingsScreen'
import { warmEnglishVoices } from './engine/narration'
import { deployedBuildDiffers, fetchReleaseMarker } from './engine/release'

type View =
  | { name: 'map' }
  | { name: 'prep'; chapterId: string }
  | { name: 'read'; chapterId: string }
  | { name: 'review' }
  | { name: 'exam'; examId: string }
  | { name: 'glossary' }
  | { name: 'settings' }

const FIRST = CHAPTERS[0].id
const VALID_CHAPTER_IDS = CHAPTERS.map(ch => ch.id)
const VALID_WORD_IDS = VOCAB.map(word => word.id)

function rawViewFromHash(): View {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash === 'review') return { name: 'review' }
  if (hash === 'glossary') return { name: 'glossary' }
  if (hash === 'settings') return { name: 'settings' }
  if (hash.startsWith('prep/')) {
    const chapterId = decodeURIComponent(hash.slice(5))
    if (CHAPTER_BY_ID.has(chapterId)) return { name: 'prep', chapterId }
  }
  if (hash.startsWith('read/')) {
    const chapterId = decodeURIComponent(hash.slice(5))
    if (CHAPTER_BY_ID.has(chapterId)) return { name: 'read', chapterId }
  }
  if (hash.startsWith('exam/')) {
    const examId = decodeURIComponent(hash.slice(5))
    if (examDefinition(examId)) return { name: 'exam', examId }
  }
  return { name: 'map' }
}

function resolveView(view: View, state: GhesseState): View {
  if (view.name === 'read') {
    if (!canPrepareChapter(state, view.chapterId)) return { name: 'map' }
    if (!canReadChapter(state, view.chapterId)) return { name: 'prep', chapterId: view.chapterId }
  }
  if (view.name === 'prep') {
    if (!canPrepareChapter(state, view.chapterId)) return { name: 'map' }
    if (canReadChapter(state, view.chapterId)) return { name: 'read', chapterId: view.chapterId }
  }
  if (view.name === 'exam' && !canTakeExam(state, view.examId)) return { name: 'map' }
  return view
}

function hashFor(view: View): string {
  if (view.name === 'prep') return `#/prep/${encodeURIComponent(view.chapterId)}`
  if (view.name === 'read') return `#/read/${encodeURIComponent(view.chapterId)}`
  if (view.name === 'review') return '#/review'
  if (view.name === 'exam') return `#/exam/${encodeURIComponent(view.examId)}`
  if (view.name === 'glossary') return '#/glossary'
  if (view.name === 'settings') return '#/settings'
  return '#/map'
}

function viewLabel(view: View): string {
  if (view.name === 'prep') {
    const chapter = CHAPTER_BY_ID.get(view.chapterId)
    return chapter ? `آمادگی فصل: ${chapter.titleFa}` : 'آمادگی فصل'
  }
  if (view.name === 'read') {
    const chapter = CHAPTER_BY_ID.get(view.chapterId)
    return chapter ? `خواندن داستان: ${chapter.titleFa}` : 'خواندن داستان'
  }
  if (view.name === 'review') return 'مرور هوشمند'
  if (view.name === 'exam') return examDefinition(view.examId)?.titleFa ?? 'آزمون'
  if (view.name === 'glossary') return 'واژه‌نامه'
  if (view.name === 'settings') return 'تنظیمات'
  return 'مسیر یادگیری'
}

export default function App() {
  const [state, setState] = useState<GhesseState>(() => loadState(Date.now(), FIRST, VALID_CHAPTER_IDS, VALID_WORD_IDS))
  const [view, setView] = useState<View>(() => resolveView(rawViewFromHash(), loadState(Date.now(), FIRST, VALID_CHAPTER_IDS, VALID_WORD_IDS)))
  const [persistOk, setPersistOk] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [deployedCommit, setDeployedCommit] = useState<string | null>(null)
  const [dismissedCommit, setDismissedCommit] = useState<string | null>(null)
  const stateRef = useRef(state)
  const mainRef = useRef<HTMLElement>(null)
  const routeFocusReadyRef = useRef(false)

  const update = useCallback((next: GhesseState) => {
    setState(next)
    setPersistOk(saveState(next))
  }, [])

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

  const reset = useCallback((next: GhesseState) => {
    update(next)
    navigate({ name: 'map' }, true)
  }, [navigate, update])

  const openChapter = useCallback((chapterId: string) => {
    if (!canPrepareChapter(state, chapterId)) return
    navigate(canReadChapter(state, chapterId) ? { name: 'read', chapterId } : { name: 'prep', chapterId })
  }, [navigate, state])

  const openExam = useCallback((examId: string) => {
    if (canTakeExam(state, examId)) navigate({ name: 'exam', examId })
  }, [navigate, state])

  useEffect(() => {
    const initial = resolveView(rawViewFromHash(), state)
    if (initial.name === 'map') {
      history.replaceState({ ghesse: true, ghesseDepth: 0 }, '', hashFor(initial))
    } else {
      history.replaceState({ ghesse: true, ghesseDepth: 0 }, '', hashFor({ name: 'map' }))
      history.pushState({ ghesse: true, ghesseDepth: 1 }, '', hashFor(initial))
    }
    setView(initial)

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
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.setAttribute('lang', 'fa')
    warmEnglishVoices()
  }, [])
  useEffect(() => {
    setPersistOk(saveState(state))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const next = loadState(Date.now(), FIRST, VALID_CHAPTER_IDS, VALID_WORD_IDS)
      setState(next)
      setView(current => resolveView(current, next))
      setPersistOk(true)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const checkForDeployedUpdate = useCallback(async () => {
    if (!import.meta.env.PROD) return
    const marker = await fetchReleaseMarker(import.meta.env.BASE_URL)
    if (deployedBuildDiffers(marker)) setDeployedCommit(marker?.commit?.trim() || null)
    else setDeployedCommit(null)
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD) return
    void checkForDeployedUpdate()
    const timer = window.setInterval(() => { void checkForDeployedUpdate() }, 5 * 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkForDeployedUpdate()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [checkForDeployedUpdate])

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
    case 'read':
      screen = (
        <ReaderScreen
          key={view.chapterId}
          chapterId={view.chapterId}
          state={state}
          onChange={update}
          onBack={backToMap}
          onOpenChapter={openChapter}
          onOpenExam={openExam}
        />
      )
      break
    case 'review':
      screen = <ReviewScreen state={state} now={now} onChange={update} onBack={backToMap} />
      break
    case 'exam':
      screen = (
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
    case 'glossary':
      screen = <GlossaryScreen state={state} onChange={update} onBack={backToMap} />
      break
    case 'settings':
      screen = (
        <SettingsScreen
          state={state}
          onChange={update}
          onBack={backToMap}
          onReset={reset}
          onImport={reset}
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
          onOpenChapter={openChapter}
          onOpenExam={openExam}
          onOpenReview={() => navigate({ name: 'review' })}
          onOpenGlossary={() => navigate({ name: 'glossary' })}
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
      <main
        id="main-content"
        ref={mainRef}
        className="app-main"
        tabIndex={-1}
        aria-label={viewLabel(view)}
      >
        {screen}
      </main>
    </>
  )
}