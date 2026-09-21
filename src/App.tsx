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
  if (view.name === 'prep' && !canPrepareChapter(state, view.chapterId)) return { name: 'map' }
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

export default function App() {
  const [state, setState] = useState<GhesseState>(() => loadState(Date.now(), FIRST, VALID_CHAPTER_IDS, VALID_WORD_IDS))
  const [view, setView] = useState<View>(() => resolveView(rawViewFromHash(), loadState(Date.now(), FIRST, VALID_CHAPTER_IDS, VALID_WORD_IDS)))
  const [persistOk, setPersistOk] = useState(true)
  const stateRef = useRef(state)

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
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [view])
  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.setAttribute('lang', 'fa')
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
      screen = <ReviewScreen state={state} onChange={update} onBack={backToMap} />
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
          onOpenChapter={openChapter}
          onOpenExam={openExam}
          onOpenReview={() => navigate({ name: 'review' })}
          onOpenGlossary={() => navigate({ name: 'glossary' })}
          onOpenSettings={() => navigate({ name: 'settings' })}
        />
      )
  }

  return (
    <>
      {!persistOk && (
        <div className="storage-warning" role="alert">
          ذخیره‌سازی مرورگر در دسترس نیست؛ پیشرفت این جلسه ممکن است پس از بستن صفحه از بین برود. از تنظیمات نسخهٔ پشتیبان بگیر.
        </div>
      )}
      {screen}
    </>
  )
}
