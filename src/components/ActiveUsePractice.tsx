import { useMemo, useState } from 'react'
import type { WordEntry } from '../engine/types'
import { normalizeTypedAnswer } from '../engine/review'
import { sentenceUsesTargetSense } from '../engine/activeUse'
import PronunciationPractice from './PronunciationPractice'

interface Props {
  word: WordEntry
  soundOn: boolean
  narratorVoiceURI: string
  narratorRate: number
  disabled?: boolean
}

/**
 * Optional transfer practice: spontaneous sentence creation plus model-sentence
 * shadowing. It is deliberately self-assessed and never written to progress or
 * used as mastery evidence until real learner validation justifies a scoring
 * model.
 */
export default function ActiveUsePractice({
  word,
  soundOn,
  narratorVoiceURI,
  narratorRate,
  disabled = false,
}: Props) {
  const [sentence, setSentence] = useState('')
  const [showComparison, setShowComparison] = useState(false)
  const normalizedSentence = useMemo(() => normalizeTypedAnswer(sentence), [sentence])
  const copiedModel = normalizedSentence !== '' && normalizedSentence === normalizeTypedAnswer(word.ex)
  const containsTargetSense = sentenceUsesTargetSense(sentence, word.id)

  return (
    <details className="method-details mt-4" data-testid="active-use-practice">
      <summary>کاربرد فعال در جمله (اختیاری)</summary>
      <div className="pt-3 text-sm leading-7">
        <p style={{ color: 'var(--ink-soft)' }}>
          یک جملهٔ تازه از خودت بساز. این تمرین نمره و تسلط را تغییر نمی‌دهد و متن تو ذخیره یا ارسال نمی‌شود.
        </p>

        <label htmlFor={`active-use-${word.id}`} className="mt-4 block font-bold">
          یک جملهٔ انگلیسی با <span className="font-en" dir="ltr">{word.word}</span>
        </label>
        <textarea
          id={`active-use-${word.id}`}
          className="answer-input mt-2 min-h-24 w-full font-en"
          dir="ltr"
          autoComplete="off"
          spellCheck
          value={sentence}
          placeholder="Write a new sentence in your own words…"
          onChange={event => {
            setSentence(event.target.value)
            setShowComparison(false)
          }}
        />

        {sentence.trim() && (
          <div className="paper-note mt-3 text-xs leading-6" role="status">
            {copiedModel
              ? 'این همان جملهٔ نمونه است. برای تمرین انتقال، یک جملهٔ متفاوت از خودت بساز.'
              : containsTargetSense
                ? 'واژهٔ هدف، با همین معنی یا یکی از شکل‌های صرفی طبیعی آن، در جمله‌ات دیده می‌شود. حالا طبیعی‌بودن جمله را با نمونه مقایسه کن.'
                : 'هنوز کاربرد همین واژه/معنی در جمله تشخیص داده نشد. شکل صرفی، املا یا معنی موردنظر را دوباره بررسی کن.'}
          </div>
        )}

        <button
          type="button"
          className="btn-paper mt-3 w-full py-2.5"
          disabled={!sentence.trim()}
          onClick={() => setShowComparison(true)}
        >
          مقایسه با نمونه
        </button>

        {showComparison && (
          <div className="learning-example mt-4 pt-4">
            <div className="text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>جملهٔ تو</div>
            <div className="mt-1 font-en leading-7" dir="ltr">{sentence.trim()}</div>
            <div className="mt-4 text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>یک نمونهٔ طبیعی</div>
            <div className="mt-1 font-en leading-7" dir="ltr">{word.ex}</div>
            <div className="mt-1 text-xs leading-6" dir="rtl" style={{ color: 'var(--ink-soft)' }}>{word.tr}</div>

            <ul className="mt-3 list-disc space-y-1 pr-5 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
              <li>آیا جملهٔ تو یک معنی کامل و روشن دارد؟</li>
              <li>آیا واژه در همان معنایی که یاد گرفتی طبیعی به کار رفته؟</li>
              <li>آیا می‌توانی جملهٔ خودت را بدون خواندن، با صدای بلند بگویی؟</li>
            </ul>

            <PronunciationPractice
              word={word.ex}
              soundOn={soundOn}
              narratorVoiceURI={narratorVoiceURI}
              narratorRate={narratorRate}
              disabled={disabled}
              practiceKind="sentence"
            />
          </div>
        )}

        <p className="mt-3 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
          قصه عمداً برای این تمرین «نمرهٔ گرامر» یا «نمرهٔ لهجه» نمی‌سازد؛ بازخورد خودکار نادرست نباید به تسلط واقعی تبدیل شود.
        </p>
      </div>
    </details>
  )
}
