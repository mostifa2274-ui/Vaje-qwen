import { useCallback, useEffect, useRef, useState } from 'react'
import type { TestSentence } from '../data/bookTests'
import { cancelEnglishSpeech, speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'

export const SPEECH_UNAVAILABLE = 'پخش صدای انگلیسی روی این دستگاه در دسترس نیست. صدای English Text-to-Speech مرورگر یا سیستم را فعال کن و دوباره «پخش» را بزن.'

export interface PassagePlayer {
  /** Index of the sentence being spoken, or -1. */
  playing: number
  notice: string
  play: () => void
  stop: () => void
}

/** Plays a text sentence by sentence with the device's English voice. */
export function usePassagePlayer(sentences: readonly TestSentence[], voiceURI: string, rate: number, onComplete: () => void): PassagePlayer {
  const [playing, setPlaying] = useState(-1)
  const [notice, setNotice] = useState('')
  const token = useRef(0)
  const completeRef = useRef(onComplete)

  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])

  useEffect(() => () => {
    token.current++
    cancelEnglishSpeech()
  }, [])

  const stop = useCallback(() => {
    token.current++
    cancelEnglishSpeech()
    setPlaying(-1)
  }, [])

  const play = useCallback(() => {
    cancelEnglishSpeech()
    const current = ++token.current
    setNotice('')
    const fail = (failure: SpeechFailure = 'unavailable') => {
      if (token.current !== current) return
      token.current++
      cancelEnglishSpeech()
      setPlaying(-1)
      setNotice(speechFailureNotice(failure, SPEECH_UNAVAILABLE))
    }
    const at = (index: number) => {
      if (token.current !== current) return
      if (index >= sentences.length) {
        setPlaying(-1)
        completeRef.current()
        return
      }
      setPlaying(index)
      const next = () => {
        if (token.current === current) window.setTimeout(() => at(index + 1), 220)
      }
      if (!speakEnglishWithFallback(sentences[index].en, voiceURI, rate, 's', next, fail)) fail()
    }
    at(0)
  }, [rate, sentences, voiceURI])

  return { playing, notice, play, stop }
}
