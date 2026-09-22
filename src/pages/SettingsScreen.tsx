import { useEffect, useRef, useState } from 'react'
import type { GhesseState } from '../engine/types'
import { importStateJson, MAX_IMPORT_BYTES, resetState } from '../engine/store'
import { cancelEnglishSpeech, clampNarrationRate, englishNarrationVoices, speakEnglish } from '../engine/narration'
import { BackIcon, DownloadIcon, ShieldIcon, SpeakerIcon, TrashIcon, UploadIcon } from '../components/Icons'
import { BUILD_COMMIT } from '../engine/release'

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

export default function SettingsScreen({ state, onChange, onBack, onReset, onImport, firstChapterId, validChapterIds, validWordIds }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [importMessage, setImportMessage] = useState('')
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

  function previewNarrator() {
    if (!state.soundOn) return
    setVoiceMessage('')
    const unavailable = () => setVoiceMessage('صدای انگلیسی روی این دستگاه در دسترس نیست. در تنظیمات مرورگر یا سیستم، English Text-to-Speech را فعال کن.')
    const started = speakEnglish(
      'Nino is home. Mina is happy to see him again.',
      state.narratorVoiceURI,
      state.narratorRate,
      () => setVoiceMessage('نمونه با موفقیت پخش شد.'),
      unavailable,
    )
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
    URL.revokeObjectURL(url)
  }

  async function importProgress(file: File) {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('فایل پیشرفت بیش از ۲ مگابایت است.')
      const text = await file.text()
      const imported = importStateJson(text, Date.now(), firstChapterId, validChapterIds, validWordIds)
      setImportMessage('نسخهٔ پشتیبان با موفقیت بازیابی شد.')
      onImport(imported)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'بازیابی فایل ناموفق بود.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="page-in mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-5" style={{ background: 'var(--cream)' }}>
      <header className="flex items-center gap-3">
        <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="بازگشت به نقشه"><BackIcon className="h-5 w-5" /></button>
        <h1 className="text-2xl font-extrabold">تنظیمات</h1>
      </header>

      <div className="mt-6 space-y-4">
        <div className="settings-section settings-toggle-row flex items-center justify-between gap-4 p-4">
          <div>
            <div className="font-bold">صدا</div>
            <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>تلفظ واژه‌ها و خواندن جمله‌ها</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.soundOn}
            className={state.soundOn ? 'btn-ink px-4 py-2' : 'btn-paper px-4 py-2'}
            onClick={() => {
              if (state.soundOn && typeof window !== 'undefined') window.speechSynthesis?.cancel()
              onChange({ ...state, soundOn: !state.soundOn })
            }}
          >
            {state.soundOn ? 'روشن' : 'خاموش'}
          </button>
        </div>

        <div className="settings-section p-4 sm:p-5">
          <div className="font-bold">صدای راوی انگلیسی</div>
          <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
            قصه، واژه‌ها و مثال‌ها همگی از یک موتور گفتار استفاده می‌کنند. حالت خودکار بهترین صدای طبیعی/Neural انگلیسی موجود در Chrome یا سیستم‌عامل را انتخاب می‌کند و برای آماده‌شدن فهرست صداهای باکیفیت کمی صبر می‌کند.
          </p>
          <label className="mt-3 block text-xs font-bold" htmlFor="narrator-voice">انتخاب صدا</label>
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
              فهرست صداها پس از آماده‌شدن موتور گفتار دستگاه نمایش داده می‌شود؛ حالت خودکار همچنان کار می‌کند.
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
          <button type="button" className="btn-paper mt-3 w-full py-2.5" disabled={!state.soundOn} onClick={previewNarrator}>
            <span className="inline-flex items-center justify-center gap-2"><SpeakerIcon className="h-5 w-5" />شنیدن نمونه</span>
          </button>
          {voiceMessage && <p className="mt-2 text-xs leading-6" role="status">{voiceMessage}</p>}
        </div>


        <div className="settings-section p-4 sm:p-5">
          <div className="font-bold">هدف مرور روزانه</div>
          <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
            وقتی کارت‌های سررسید زیاد باشند، مرور هوشمند این تعداد واژه را در هر جلسه انتخاب می‌کند. پاسخ‌های اشتباه تا بازیابی درست در همان جلسه برمی‌گردند.
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
                {String(goal).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])}
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

        <div className="settings-section p-4 sm:p-5">
          <div className="font-bold">پشتیبان پیشرفت</div>
          <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            برای جلوگیری از از دست رفتن پیشرفت در صورت پاک‌شدن داده‌های مرورگر، یک فایل JSON بگیر و هر زمان لازم شد آن را برگردان.
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
          {importMessage && <p className="mt-2 text-xs" role="status">{importMessage}</p>}
        </div>

        <div className="settings-section p-4 sm:p-5">
          <div className="settings-section-title"><ShieldIcon className="h-5 w-5" aria-hidden="true" /><span>حریم خصوصی</span></div>
          <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            قصه حساب کاربری یا سرور پیشرفت ندارد و دادهٔ یادگیری و تنظیمات در همین مرورگر می‌ماند. خواندن جمله‌های انگلیسی را موتور گفتار مرورگر/سیستم‌عامل انجام می‌دهد؛ بسته به صدایی که روی دستگاه انتخاب شده، خودِ سرویس گفتار ممکن است آنلاین یا آفلاین باشد.
          </p>
        </div>

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
          قصه ۵٫۰ — ۸۹۹ واژه‌ی A1 در ۴۰ فصل
          <br />
          تسلط از بازیابی فاصله‌دار، پاسخ نوشتاری، سختی واژه و شواهد چندروزه محاسبه می‌شود.
          <br />
          <span dir="ltr" className="font-en">build {BUILD_COMMIT === 'local' ? 'local' : BUILD_COMMIT.slice(0, 7)}</span>
        </div>
      </div>
    </div>
  )
}
