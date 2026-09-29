import { useCallback, useEffect, useRef, useState } from 'react'
import { stopAudio } from '../engine/audio'
import { cancelEnglishSpeech, speakEnglishWithFallback } from '../engine/narration'
import { MicrophoneIcon, SpeakerIcon } from './Icons'

interface Props {
  word: string
  soundOn: boolean
  narratorVoiceURI: string
  narratorRate: number
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'recorded' | 'error'

const MAX_RECORDING_MS = 4_000

function microphoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'اجازهٔ میکروفن داده نشد. اگر خواستی تمرین کنی، دسترسی میکروفن این سایت را در مرورگر فعال کن.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'میکروفنی روی این دستگاه پیدا نشد.'
  }
  return 'ضبط صدا روی این دستگاه شروع نشد. می‌توانی بدون این تمرین ادامه بدهی.'
}

/**
 * Optional pronunciation rehearsal.
 *
 * Recordings never leave the browser, are never persisted, never become
 * mastery evidence, and receive no automatic accent score. The learner hears
 * the course model and their own short recording side by side.
 */
export default function PronunciationPractice({ word, soundOn, narratorVoiceURI, narratorRate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<RecordingState>('idle')
  const [message, setMessage] = useState('')
  const [recordingUrl, setRecordingUrl] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopTimerRef = useRef<number | null>(null)
  const recordingUrlRef = useRef('')
  const playbackRef = useRef<HTMLAudioElement | null>(null)

  const stopPlayback = useCallback(() => {
    if (!playbackRef.current) return
    playbackRef.current.pause()
    playbackRef.current.src = ''
    playbackRef.current = null
  }, [])

  const stopStream = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
  }, [])

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
  }, [])

  const clearRecording = useCallback(() => {
    stopPlayback()
    const previous = recordingUrlRef.current
    recordingUrlRef.current = ''
    setRecordingUrl('')
    if (previous) URL.revokeObjectURL(previous)
  }, [stopPlayback])

  const stopRecording = useCallback(() => {
    clearStopTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [clearStopTimer])

  useEffect(() => () => {
    clearStopTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    stopStream()
    stopPlayback()
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current)
    cancelEnglishSpeech()
    stopAudio()
  }, [clearStopTimer, stopPlayback, stopStream])

  async function startRecording() {
    setMessage('')
    clearRecording()
    cancelEnglishSpeech()
    stopAudio()
    stopPlayback()

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('error')
      setMessage('این مرورگر ضبط کوتاه صدا را پشتیبانی نمی‌کند. می‌توانی فقط نمونه را گوش کنی و با صدای بلند تکرار کنی.')
      return
    }

    try {
      setStatus('requesting')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        clearStopTimer()
        stopStream()
        setStatus('error')
        setMessage('ضبط صدا کامل نشد. دوباره امتحان کن یا این تمرین را رد کن.')
      }
      recorder.onstop = () => {
        clearStopTimer()
        stopStream()
        recorderRef.current = null
        const chunks = chunksRef.current
        chunksRef.current = []
        if (chunks.length === 0) {
          setStatus('error')
          setMessage('صدایی ضبط نشد. دوباره امتحان کن یا این تمرین را رد کن.')
          return
        }
        const type = recorder.mimeType || chunks[0]?.type || 'audio/webm'
        const url = URL.createObjectURL(new Blob(chunks, { type }))
        recordingUrlRef.current = url
        setRecordingUrl(url)
        setStatus('recorded')
        setMessage('حالا صدای خودت را با نمونه مقایسه کن؛ دنبال واضح‌بودن و ریتم طبیعی باش، نه یک امتیاز مصنوعی.')
      }

      recorder.start()
      setStatus('recording')
      stopTimerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS)
    } catch (error) {
      clearStopTimer()
      stopStream()
      recorderRef.current = null
      setStatus('error')
      setMessage(microphoneErrorMessage(error))
    }
  }

  function playRecording() {
    if (!recordingUrl) return
    cancelEnglishSpeech()
    stopAudio()
    stopPlayback()
    const audio = new Audio(recordingUrl)
    playbackRef.current = audio
    audio.onended = () => { if (playbackRef.current === audio) playbackRef.current = null }
    audio.onerror = () => {
      if (playbackRef.current === audio) playbackRef.current = null
      setMessage('صدای ضبط‌شده پخش نشد؛ می‌توانی دوباره ضبط کنی.')
    }
    void audio.play().catch(() => setMessage('مرورگر پخش صدای ضبط‌شده را متوقف کرد. دوباره دکمهٔ «صدای من» را بزن.'))
  }

  function playModel() {
    if (!soundOn) return
    stopPlayback()
    cancelEnglishSpeech()
    stopAudio()
    const started = speakEnglishWithFallback(word, narratorVoiceURI, narratorRate, 'w', () => {}, () => {
      setMessage('نمونهٔ تلفظ پخش نشد. صدای انگلیسی دستگاه یا اتصال را بررسی کن.')
    })
    if (!started) setMessage('نمونهٔ تلفظ پخش نشد. صدای انگلیسی دستگاه یا اتصال را بررسی کن.')
  }

  return (
    <div className="pronunciation-practice mt-4">
      <button
        type="button"
        className="btn-paper w-full px-3 py-2.5 text-sm"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <MicrophoneIcon className="h-5 w-5" />
          تمرین تلفظ (اختیاری)
        </span>
      </button>

      {expanded && (
        <div className="mt-3 border-t pt-3 text-sm" style={{ borderColor: 'var(--line-soft)' }}>
          <p className="leading-7" style={{ color: 'var(--ink-soft)' }}>
            نمونه را گوش کن، واژه را با صدای خودت بگو، بعد هر دو را مقایسه کن.
          </p>
          <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
            ضبط فقط در حافظهٔ همین صفحه می‌ماند، جایی فرستاده یا ذخیره نمی‌شود و هیچ امتیاز خودکاری به لهجه‌ات داده نمی‌شود.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn-paper py-2.5" disabled={!soundOn || status === 'requesting' || status === 'recording'} onClick={playModel}>
              <span className="inline-flex items-center justify-center gap-2"><SpeakerIcon className="h-4 w-4" />صدای نمونه</span>
            </button>
            {status === 'recording' ? (
              <button type="button" className="btn-crimson py-2.5" onClick={stopRecording}>
                پایان ضبط
              </button>
            ) : (
              <button type="button" className="btn-ink py-2.5" disabled={status === 'requesting'} onClick={() => void startRecording()}>
                <span className="inline-flex items-center justify-center gap-2"><MicrophoneIcon className="h-4 w-4" />{recordingUrl ? 'ضبط دوباره' : status === 'requesting' ? 'در حال گرفتن اجازه…' : 'ضبط صدای من'}</span>
              </button>
            )}
          </div>

          {status === 'recording' && (
            <p className="mt-2 text-xs font-bold" role="status">در حال ضبط… واژه را طبیعی بگو؛ ضبط حداکثر ۴ ثانیه است.</p>
          )}

          {recordingUrl && status === 'recorded' && (
            <button type="button" className="btn-paper mt-2 w-full py-2.5" onClick={playRecording}>
              شنیدن صدای من
            </button>
          )}

          {message && <p className="mt-2 text-xs leading-6" role="status">{message}</p>}
        </div>
      )}
    </div>
  )
}
