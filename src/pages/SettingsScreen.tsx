import { useEffect, useRef, useState } from 'react'
import type { GhesseState } from '../engine/types'
import { clearSessionDrafts, importStateJson, MAX_IMPORT_BYTES, resetState, summarizeProgress, type ProgressSummary } from '../engine/store'
import { cancelEnglishSpeech, clampNarrationRate, englishNarrationVoices, speakEnglish, speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'
import { BackIcon, DownloadIcon, ShieldIcon, SpeakerIcon, TrashIcon, UploadIcon } from '../components/Icons'
import { BUILD_COMMIT } from '../engine/release'
import { faNum } from '../engine/format'

interface Props {
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onReset: (next: GhesseState) => void
  onImport: (next: GhesseState) => void
  firstChapterId: string
  validChapterIds: string[]
  validWordIds: string[]
}

// Recorded with the course clips (scripts/audio/extra-prompts.json).
const VOICE_SAMPLE = 'Nino is home. Mina is happy to see him again.'

function describeProgress(summary: ProgressSummary): string {
  return `${faNum(summary.completedChapters)} فصل تمام‌شده، ${faNum(summary.introducedWords)} واژهٔ آموخته و ${faNum(summary.passedExams)} آزمون قبول‌شده`
}

export default function SettingsScreen({ state, onChange, onBack, onReset, onImport, firstChapterId, validChapterIds, validWordIds }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [pendingImport, setPendingImport] = useState<GhesseState | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceMessage, setVoiceMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const synth = window.speechSynthesis
    const refresh = () => setVoices(englishNarrationVoices(synth.getVoices()))
    refresh()
    synth.addEventListener('voiceschanged', refresh)
    return () => {
      synth.removeEventListener('voiceschanged', refresh)
      cancelEnglishSpeech()
    }
  }, [])

  function previewNarrator(deviceVoice = false) {
    if (!state.soundOn) return
    setVoiceMessage('')
    const unavailable = (failure: SpeechFailure = 'unavailable') => setVoiceMessage(speechFailureNotice(failure, 'صدای انگلیسی روی این دستگاه در دسترس نیست. در تنظیمات مرورگر یا سیستم، English Text-to-Speech را فعال کن.'))
    const done = () => setVoiceMessage('نمونه با موفقیت پخش شد.')
    const started = deviceVoice
      ? speakEnglish(VOICE_SAMPLE, state.narratorVoiceURI, state.narratorRate, done, unavailable)
      : speakEnglishWithFallback(VOICE_SAMPLE, state.narratorVoiceURI, state.narratorRate, 's', done, unavailable)
    if (!started) unavailable()
  }

  function exportProgress() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ghesse-progress-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Revoking in the same task can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  async function importProgress(file: File) {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('فایل پیشرفت بیش از ۲ مگابایت است.')
      const text = await file.text()
      const imported = importStateJson(text, Date.now(), firstChapterId, validChapterIds, validWordIds)
      // Replacing progress cannot be undone from the UI, so it waits for an
      // explicit confirmation that shows what the file actually contains.
      setImportMessage('')
      setPendingImport(imported)
    } catch (error) {
      setPendingImport(null)
      setImportMessage(error instanceof Error ? error.message : 'بازیابی فایل ناموفق بود.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function confirmImport() {
    if (!pendingImport) return
    clearSessionDrafts()
    onImport(pendingImport)
  }

  return (
    <div className="page-in mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-5" style={{ background: 'var(--cream)' }}>
      <header className="flex items-center gap-3">
        <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="بازگشت به نقشه"><BackIcon className="h-5 w-5" /></button>
        <h1 className="text-2xl font-extrabold">تنظیمات</h1>
      </header>

      <div className="settings-list mt-5">
        <div className="settings-section settings-toggle-row flex items-center justify-between gap-4 p-4">
          <div>
            <div className="font-bold">صدا</div>
            <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>تلفظ، خواندن قصه و آزمون‌های شنیداری.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.soundOn}
            className={state.soundOn ? 'btn-ink px-4 py-2' : 'btn-paper px-4 py-2'}
            onClick={() => {
              if (state.soundOn) cancelEnglishSpeech()
              onChange({ ...state, soundOn: !state.soundOn })
            }}
          >
            {state.soundOn ? 'روشن' : 'خاموش'}
          </button>
        </div>

        <details className="settings-details settings-section">
          <summary>تنظیمات پیشرفتهٔ صدا</summary>
          <div className="settings-details-body">
            <p className="text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
              صدای ضبط‌شدهٔ دوره در اولویت است. این تنظیمات فقط صدای جایگزین دستگاه و سرعت پخش را کنترل می‌کنند.
            </p>
            <label className="mt-3 block text-xs font-bold" htmlFor="narrator-voice">صدای جایگزین دستگاه</label>
            <select
              id="narrator-voice"
              className="settings-select mt-1 w-full px-3 py-3 text-sm"
              dir="ltr"
              value={state.narratorVoiceURI}
              onChange={event => onChange({ ...state, narratorVoiceURI: event.target.value })}
            >
              <option value="">Automatic — best natural English voice</option>
              {state.narratorVoiceURI && !voices.some(voice => voice.voiceURI === state.narratorVoiceURI) && (
                <option value={state.narratorVoiceURI}>Previously selected — unavailable on this device</option>
              )}
              {voices.map(voice => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang}){voice.localService ? ' — offline' : ''}
                </option>
              ))}
            </select>
            {voices.length === 0 && (
              <p className="mt-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
                فهرست صداها بعد از آماده‌شدن موتور گفتار دستگاه نمایش داده می‌شود.
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="text-xs font-bold" htmlFor="narrator-rate">سرعت خواندن</label>
              <span className="font-en text-xs" dir="ltr">{state.narratorRate.toFixed(2)}×</span>
            </div>
            <input
              id="narrator-rate"
              className="mt-2 w-full"
              type="range"
              min="0.75"
              max="1.1"
              step="0.01"
              value={state.narratorRate}
              aria-valuetext={`${state.narratorRate.toFixed(2)} برابر سرعت عادی`}
              onChange={event => onChange({ ...state, narratorRate: clampNarrationRate(Number(event.target.value)) })}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn-paper w-full py-2.5" disabled={!state.soundOn} onClick={() => previewNarrator()}>
                <span className="inline-flex items-center justify-center gap-2"><SpeakerIcon className="h-5 w-5" />شنیدن نمونه</span>
              </button>
              <button type="button" className="btn-paper w-full py-2.5" disabled={!state.soundOn} onClick={() => previewNarrator(true)}>
                <span className="inline-flex items-center justify-center gap-2"><SpeakerIcon className="h-5 w-5" />صدای دستگاه</span>
              </button>
            </div>
            {voiceMessage && <p className="mt-2 text-xs leading-6" role="status">{voiceMessage}</p>}
          </div>
        </details>


        <div className="settings-section p-4 sm:p-5">
          <div className="font-bold">هدف مرور روزانه</div>
          <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
            تعداد واژه‌های هر جلسهٔ مرور هوشمند. پاسخ اشتباه تا بازیابی درست دوباره برمی‌گردد.
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="هدف مرور روزانه">
            {[10, 15, 20, 25].map(goal => (
              <button
                key={goal}
                type="button"
                aria-pressed={state.dailyReviewGoal === goal}
                className={state.dailyReviewGoal === goal ? 'btn-ink py-2.5' : 'btn-paper py-2.5'}
                onClick={() => onChange({ ...state, dailyReviewGoal: goal })}
              >
                {faNum(goal)}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section settings-toggle-row flex items-center justify-between gap-4 p-4">
          <div>
            <div className="font-bold">ترجمه‌ی فارسی همیشه باز</div>
            <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>در حالت خاموش، دکمهٔ FA ترجمهٔ هر جمله را باز می‌کند.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.showFaDefault}
            className={state.showFaDefault ? 'btn-ink px-4 py-2' : 'btn-paper px-4 py-2'}
            onClick={() => onChange({ ...state, showFaDefault: !state.showFaDefault })}
          >
            {state.showFaDefault ? 'روشن' : 'خاموش'}
          </button>
        </div>

        <div className="settings-section settings-toggle-row flex items-center justify-between gap-4 p-4">
          <div>
            <div id="explore-mode-title" className="font-bold">حالت کاوش: باز کردن همهٔ فصل‌ها</div>
            <div className="text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
              همهٔ محتوا برای پیش‌نمایش باز می‌شود؛ بخش‌های نرسیده در پیشرفت ثبت نمی‌شوند.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.exploreAll}
            aria-labelledby="explore-mode-title"
            className={state.exploreAll ? 'btn-ink px-4 py-2' : 'btn-paper px-4 py-2'}
            onClick={() => onChange({ ...state, exploreAll: !state.exploreAll })}
          >
            {state.exploreAll ? 'روشن' : 'خاموش'}
          </button>
        </div>

        <div className="settings-section p-4 sm:p-5">
          <div className="font-bold">پشتیبان پیشرفت</div>
          <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            پیشرفتت را در یک فایل نگه دار یا از فایل قبلی بازیابی کن.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn-paper py-2.5" onClick={exportProgress}><span className="inline-flex items-center justify-center gap-2"><DownloadIcon className="h-5 w-5" />دریافت پشتیبان</span></button>
            <button type="button" className="btn-paper py-2.5" onClick={() => fileRef.current?.click()}><span className="inline-flex items-center justify-center gap-2"><UploadIcon className="h-5 w-5" />بازیابی پشتیبان</span></button>
          </div>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            aria-label="فایل پشتیبان پیشرفت"
            tabIndex={-1}
            onChange={event => {
              const file = event.target.files?.[0]
              if (file) void importProgress(file)
            }}
          />
          {pendingImport && (
            <div className="paper-note mt-3" role="group" aria-labelledby="import-confirm-title">
              <div id="import-confirm-title" className="font-bold">جایگزینی پیشرفت؟</div>
              <p className="mt-1 text-sm leading-7">
                این فایل شامل {describeProgress(summarizeProgress(pendingImport))} است و جای پیشرفت فعلی ({describeProgress(summarizeProgress(state))}) را می‌گیرد.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn-paper flex-1 py-2.5" onClick={() => setPendingImport(null)}>انصراف</button>
                <button type="button" className="btn-crimson flex-1 py-2.5" onClick={confirmImport}>جایگزین کن</button>
              </div>
            </div>
          )}
          {importMessage && <p className="mt-2 text-xs" role="status">{importMessage}</p>}
        </div>

        <details className="settings-details settings-section">
          <summary><span className="settings-section-title"><ShieldIcon className="h-5 w-5" aria-hidden="true" /><span>حریم خصوصی</span></span></summary>
          <div className="settings-details-body">
            <p className="text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
              پیشرفت و تنظیمات در همین مرورگر می‌مانند. صداهای دوره از همین سایت بارگیری می‌شوند؛ فقط در صورت نبودن فایل ضبط‌شده، موتور گفتار دستگاه استفاده می‌شود.
            </p>
          </div>
        </details>

        <div className="settings-section settings-danger p-4 sm:p-5">
          <div className="settings-section-title" style={{ color: 'var(--crimson-deep)' }}><TrashIcon className="h-5 w-5" aria-hidden="true" /><span>شروع دوباره</span></div>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>همه‌ی پیشرفت پاک می‌شود و قصه از فصل اول آغاز می‌شود.</p>
          {!confirming ? (
            <button type="button" className="btn-paper mt-3 w-full py-2.5" onClick={() => setConfirming(true)}>پاک کردن پیشرفت</button>
          ) : (
            <div className="mt-3 flex gap-2" role="group" aria-label="تأیید پاک کردن پیشرفت">
              <button type="button" className="btn-paper flex-1 py-2.5" onClick={() => setConfirming(false)}>نه، منصرف شدم</button>
              <button type="button" className="btn-crimson flex-1 py-2.5" onClick={() => onReset(resetState(firstChapterId))}>بله، پاک کن</button>
            </div>
          )}
        </div>

        <div className="pt-4 text-center text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
          قصه ۵٫۰ · ۸۹۹ واژه · ۴۰ فصل
          <span className="mx-2" aria-hidden="true">·</span>
          <span dir="ltr" className="font-en">build {BUILD_COMMIT === 'local' ? 'local' : BUILD_COMMIT.slice(0, 7)}</span>
        </div>
      </div>
    </div>
  )
}
