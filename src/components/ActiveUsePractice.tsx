import { useEffect, useRef, useState } from 'react'
import type { WordEntry } from '../engine/types'

interface Props {
  word: WordEntry
  onPlayWord: () => void
  onPlayExample: () => void
}

/**
 * Optional active-use practice. Audio is recorded only into an in-memory Blob
 * URL in this tab: it is never uploaded, saved to progress, scored or used as
 * mastery evidence. The learner compares their own production with the model.
 */
export default function ActiveUsePractice({ word, onPlayWord, onPlayExample }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [recordingError, setRecordingError] = useState('')
  const [sentence, setSentence] = useState('')
  const [showModel, setShowModel] = useState(false)

  function releaseStream() {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }

  function replaceAudioUrl(next: string) {
    setAudioUrl(previous => {
      if (previous) URL.revokeObjectURL(previous)
      return next
    })
  }

  async function startRecording() {
    setRecordingError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('ضبط صدا در این مرورگر در دسترس نیست؛ می‌توانی همچنان با صدای مدل تمرین کنی.')
      return
    }
    try {
      releaseStream()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []
        if (blob.size > 0) replaceAudioUrl(URL.createObjectURL(blob))
        releaseStream()
      }
      recorder.onerror = () => {
        setRecording(false)
        setRecordingError('ضبط صدا کامل نشد. دوباره امتحان کن یا فقط با صدای مدل تمرین کن.')
        releaseStream()
      }
      recorder.start()
      setRecording(true)
    } catch {
      releaseStream()
      setRecordingError('اجازهٔ میکروفون داده نشد. ضبط کاملاً اختیاری است و بدون آن هم می‌توانی ادامه بدهی.')
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
    setRecording(false)
  }

  useEffect(() => () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    releaseStream()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  return (
    <details className="method-details mt-5" data-testid="active-use-practice">
      <summary>تمرین اختیاری تلفظ و کاربرد فعال</summary>
      <div className="pt-3 text-sm leading-7">
        <p style={{ color: 'var(--ink-soft)' }}>
          این تمرین امتیاز یا تسلط را تغییر نمی‌دهد. صدایت فقط در همین صفحه نگه داشته می‌شود و جایی فرستاده یا ذخیره نمی‌شود.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-paper py-3" onClick={onPlayWord}>۱. شنیدن واژه</button>
          <button type="button" className="btn-paper py-3" onClick={onPlayExample}>۲. شنیدن جمله</button>
        </div>
        <p className="mt-3">واژه و سپس جملهٔ نمونه را با صدای خودت بگو؛ بعد صدایت را با مدل مقایسه کن.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {!recording ? (
            <button type="button" className="btn-ink py-3" onClick={startRecording}>ضبط صدای من</button>
          ) : (
            <button type="button" className="btn-crimson py-3" onClick={stopRecording}>توقف ضبط</button>
          )}
          <button
            type="button"
            className="btn-quiet py-3"
            disabled={!audioUrl || recording}
            onClick={() => replaceAudioUrl('')}
          >
            حذف ضبط
          </button>
        </div>
        {recording && <div className="mt-2" role="status">در حال ضبط…</div>}
        {recordingError && <div className="paper-note mt-3" role="status">{recordingError}</div>}
        {audioUrl && !recording && (
          <div className="mt-3">
            <div className="mb-2 font-bold">صدای تو</div>
            <audio className="w-full" controls src={audioUrl} aria-label={`صدای ضبط‌شده برای ${word.word}`} />
          </div>
        )}

        <div className="learning-example mt-5 pt-4">
          <label htmlFor={`active-sentence-${word.id}`} className="font-bold">یک جملهٔ تازه با <span className="font-en" dir="ltr">{word.word}</span> بساز</label>
          <textarea
            id={`active-sentence-${word.id}`}
            className="answer-input mt-2 min-h-24 w-full"
            dir="ltr"
            value={sentence}
            onChange={event => { setSentence(event.target.value); setShowModel(false) }}
            placeholder="Write your own English sentence…"
          />
          <button type="button" className="btn-paper mt-2 w-full py-3" disabled={!sentence.trim()} onClick={() => setShowModel(true)}>
            مقایسه با جملهٔ نمونه
          </button>
          {showModel && (
            <div className="paper-note mt-3">
              <div className="font-en" dir="ltr">{word.ex}</div>
              <div className="mt-1" dir="rtl">{word.tr}</div>
              <p className="mt-2 text-xs" style={{ color: 'var(--ink-soft)' }}>جملهٔ تو لازم نیست مثل نمونه باشد؛ بررسی کن معنی روشن باشد و واژه را در جای طبیعی به کار برده باشی.</p>
            </div>
          )}
        </div>
      </div>
    </details>
  )
}
