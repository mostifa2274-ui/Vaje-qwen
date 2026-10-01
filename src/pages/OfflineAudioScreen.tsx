import { useCallback, useEffect, useRef, useState } from 'react'
import { BOOKS } from '../data/chapters'
import { DownloadIcon, TrashIcon } from '../components/Icons'
import { LuxuryPageHeader } from '../components/LuxuryUI'
import { faNum } from '../engine/format'
import { LuxuryPanel, LuxuryProgress, LuxurySectionHeading } from '../components/LuxuryUI'
import {
  cacheBookAudio,
  clearOfflineAudio,
  offlineAudioStorageEstimate,
  offlineAudioSupported,
  offlineBookStatus,
  type OfflineAudioProgress,
  type OfflineBookStatus,
} from '../engine/offlineAudio'

interface Props {
  onBack: () => void
}

function formatStorage(bytes: number | undefined): string | undefined {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return undefined
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0) + ' MB'
}

export default function OfflineAudioScreen({ onBack }: Props) {
  const [statuses, setStatuses] = useState<Record<number, OfflineBookStatus>>({})
  const [activeBook, setActiveBook] = useState<number | null>(null)
  const [activeProgress, setActiveProgress] = useState<OfflineAudioProgress | null>(null)
  const [message, setMessage] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [storage, setStorage] = useState<{ usage?: number; quota?: number }>({})
  const abortRef = useRef<AbortController | null>(null)
  const supported = offlineAudioSupported()

  const refresh = useCallback(async () => {
    if (!supported) return
    try {
      const next = await Promise.all(BOOKS.map(meta => offlineBookStatus(meta.book)))
      setStatuses(Object.fromEntries(next.map(status => [status.book, status])))
      setStorage(await offlineAudioStorageEstimate())
    } catch {
      setMessage('مرورگر اجازهٔ دسترسی به فضای آفلاین را نداد. صدای آنلاین و صدای جایگزین دستگاه همچنان کار می‌کنند.')
    }
  }, [supported])

  useEffect(() => {
    void refresh()
    return () => abortRef.current?.abort()
  }, [refresh])

  async function downloadBook(book: number) {
    if (activeBook !== null) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setMessage('برای ذخیرهٔ صداها یک‌بار به اینترنت وصل شو؛ صداهای ذخیره‌شده بعداً آفلاین پخش می‌شوند.')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setActiveBook(book)
    setActiveProgress(null)
    setMessage('')
    try {
      const result = await cacheBookAudio(
        book,
        progress => setActiveProgress(progress),
        controller.signal,
      )
      setMessage(result.ready
        ? 'صدای ضبط‌شدهٔ کتاب ' + faNum(book) + ' برای استفادهٔ آفلاین آماده است.'
        : result.failed
          ? faNum(result.failed) + ' فایل بارگیری نشد؛ دوباره «تکمیل دانلود» را بزن.'
          : 'دانلود متوقف شد.')
      await refresh()
    } catch {
      if (!controller.signal.aborted) {
        setMessage('ذخیرهٔ صدا کامل نشد. فضای خالی دستگاه و اتصال اینترنت را بررسی کن و دوباره تلاش کن.')
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setActiveBook(null)
      setActiveProgress(null)
    }
  }

  function cancelDownload() {
    const controller = abortRef.current
    if (!controller) return
    controller.abort()
    setMessage('دانلود متوقف شد؛ فایل‌هایی که کامل ذخیره شده‌اند باقی می‌مانند و بعداً می‌توانی ادامه بدهی.')
  }

  async function clearAll() {
    if (activeBook !== null) {
      setMessage('برای پاک‌کردن صداها ابتدا دانلود فعال را متوقف کن.')
      return
    }
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    abortRef.current?.abort()
    try {
      await clearOfflineAudio()
      setConfirmClear(false)
      setMessage('صداهای آفلاین پاک شدند؛ صدای آنلاین و صدای جایگزین دستگاه همچنان در دسترس‌اند.')
      await refresh()
    } catch {
      setMessage('پاک‌کردن صداهای آفلاین ممکن نشد؛ مرورگر اجازهٔ دسترسی به فضای ذخیره‌سازی را نداد.')
    }
  }

  const usage = formatStorage(storage.usage)
  const quota = formatStorage(storage.quota)

  return (
    <div className="app-page luxury-settings page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
      <LuxuryPageHeader
        title="صدای آفلاین"
        subtitle="صدای طبیعی ضبط‌شده را برای هر کتاب روی همین دستگاه نگه دار."
        onBack={onBack}
        backLabel="بازگشت به نقشه"
      />

      {!supported ? (
        <div className="paper-note mt-5" role="alert">
          این مرورگر ذخیرهٔ آفلاین صدا را پشتیبانی نمی‌کند. برنامه هنگام نبود شبکه از صدای انگلیسی دستگاه استفاده می‌کند.
        </div>
      ) : (
        <>
          <LuxuryPanel className="mt-5 p-4 sm:p-5">
            <LuxurySectionHeading
              title="چطور کار می‌کند؟"
              subtitle="فایل‌های صوتی طبیعی هر کتاب را برای استفادهٔ بدون اینترنت روی همین دستگاه نگه دار."
            />
            <p className="mt-3 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
              پوسته، متن و تصویرهای دوره از قبل برای آفلاین آماده‌اند. این دانلود اختیاری فقط فایل‌های صدای ضبط‌شدهٔ واژه‌ها، مثال‌ها، قصه، شنیداری فصل و آزمون‌های شنیداری همان کتاب را نگه می‌دارد. هیچ پیشرفت یا نمره‌ای تغییر نمی‌کند.
            </p>
            {usage && (
              <p className="mt-2 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
                فضای فعلی این سایت در مرورگر: <b dir="ltr">{usage}</b>{quota ? <> از حدود <b dir="ltr">{quota}</b></> : null}
              </p>
            )}
          </LuxuryPanel>

          <div className="mt-4 space-y-3" aria-live="polite">
            {BOOKS.map(meta => {
              const status = statuses[meta.book]
              const progress = activeBook === meta.book ? activeProgress : null
              const done = progress?.done ?? status?.done ?? 0
              const total = progress?.total ?? status?.total ?? 0
              const ready = status?.ready === true && activeBook !== meta.book
              const partial = done > 0 && !ready

              return (
                <section key={meta.book} className="settings-section p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-extrabold">کتاب {faNum(meta.book)}: {meta.titleFa}</h2>
                      <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
                        {!status
                          ? 'در حال بررسی…'
                          : ready
                            ? faNum(total) + ' فایل · آمادهٔ آفلاین'
                            : partial
                              ? faNum(done) + ' از ' + faNum(total) + ' فایل ذخیره شده'
                              : faNum(total) + ' فایل صوتی'}
                      </p>
                    </div>
                    {activeBook === meta.book ? (
                      <button
                        type="button"
                        className="btn-paper shrink-0 px-3 py-2 text-sm"
                        onClick={cancelDownload}
                      >
                        توقف دانلود
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={ready ? 'btn-paper shrink-0 px-3 py-2 text-sm' : 'btn-ink shrink-0 px-3 py-2 text-sm'}
                        disabled={ready || activeBook !== null || !status}
                        onClick={() => void downloadBook(meta.book)}
                      >
                        <span className="inline-flex items-center gap-2">
                          <DownloadIcon className="h-4 w-4" />
                          {partial ? 'تکمیل دانلود' : ready ? 'ذخیره شده' : 'ذخیره'}
                        </span>
                      </button>
                    )}
                  </div>
                  {(activeBook === meta.book || partial || ready) && total > 0 && (
                    <LuxuryProgress
                      className="mt-3"
                      value={done}
                      max={total}
                      label={'دانلود صدای کتاب ' + faNum(meta.book)}
                    />
                  )}
                  {activeBook === meta.book && progress?.failed ? (
                    <p className="mt-2 text-xs" style={{ color: 'var(--crimson-deep)' }}>{faNum(progress.failed)} فایل تا اینجا ناموفق بوده است.</p>
                  ) : null}
                </section>
              )
            })}
          </div>

          {message && <div className="paper-note mt-4" role="status">{message}</div>}

          <section className="settings-section settings-danger mt-4 p-4 sm:p-5">
            <div className="font-bold" style={{ color: 'var(--crimson-deep)' }}>پاک‌کردن صدای آفلاین</div>
            <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
              فقط فایل‌های صوتی دانلودشده پاک می‌شوند؛ پیشرفت، متن، تصویر و تنظیمات دست‌نخورده می‌مانند.
            </p>
            <button
              type="button"
              className={confirmClear ? 'btn-crimson mt-3 w-full py-2.5' : 'btn-paper mt-3 w-full py-2.5'}
              disabled={activeBook !== null}
              onClick={() => void clearAll()}
            >
              <span className="inline-flex items-center justify-center gap-2"><TrashIcon className="h-4 w-4" />{confirmClear ? 'بله، صداهای آفلاین پاک شوند' : 'پاک‌کردن همهٔ صداهای آفلاین'}</span>
            </button>
            {confirmClear && <button type="button" className="btn-quiet mt-2 w-full py-2 text-xs" onClick={() => setConfirmClear(false)}>انصراف</button>}
          </section>
        </>
      )}
    </div>
  )
}
