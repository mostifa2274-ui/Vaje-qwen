import { describe, expect, it } from 'vitest'
import { VOCAB, WORD_BY_ID } from '../data/chapters'
import { HOMOPHONE_GROUPS, differentlySpelledHomophones, headwordKey, sameHeadwordEntries, soundsAlike } from './homophones'
import { buildReviewQuestion, listeningChoiceOptions } from './review'
import { isHeadwordTranslationCorrect, isPersianTranslationCorrect } from './persianTranslation'

function soundKey(ipa: string): string {
  return ipa.replace(/[ˈˌ/.\sː]/g, '').toLowerCase()
}

const word = (id: string) => WORD_BY_ID.get(id)!

describe('homophones', () => {
  it('lists every pair of deck words the IPA says sound the same', () => {
    const bySound = new Map<string, Set<string>>()
    for (const entry of VOCAB) {
      const key = soundKey(entry.ipa)
      if (!key) continue
      bySound.set(key, (bySound.get(key) ?? new Set()).add(headwordKey(entry)))
    }
    const unlisted: string[] = []
    for (const surfaces of bySound.values()) {
      const [first, ...rest] = [...surfaces]
      for (const other of rest) {
        if (!soundsAlike({ word: first }, { word: other })) unlisted.push(`${first}/${other}`)
      }
    }
    expect(unlisted).toEqual([])
  })

  it('only lists words that are in the deck', () => {
    const headwords = new Set(VOCAB.map(headwordKey))
    for (const surface of HOMOPHONE_GROUPS.flat()) expect(headwords, surface).toContain(surface.toLowerCase())
  })

  it('treats one headword with two entries as sounding alike', () => {
    expect(sameHeadwordEntries(word('like'), VOCAB).map(entry => entry.id).sort()).toEqual(['like', 'like-2'])
    expect(sameHeadwordEntries(word('second-2'), VOCAB).map(entry => entry.id).sort()).toEqual(['second', 'second-2'])
    expect(soundsAlike(word('like'), word('like-2'))).toBe(true)
    expect(soundsAlike(word('right'), VOCAB.find(entry => entry.word === 'write')!)).toBe(true)
    expect(soundsAlike(word('right'), VOCAB.find(entry => entry.word === 'red')!)).toBe(false)
  })

  it('never offers a sound-alike meaning beside a word the learner only hears', () => {
    const targets = VOCAB.filter(target => VOCAB.some(other => other.id !== target.id && soundsAlike(target, other)))
    expect(targets.length).toBeGreaterThan(25)
    for (const target of targets) {
      for (let seed = 0; seed < 12; seed++) {
        const options = listeningChoiceOptions(target, VOCAB, `probe:${seed}`)
        expect(options, target.id).toHaveLength(4)
        expect(options.map(option => option.id), target.id).toContain(target.id)
        const clashes = options.filter(option => option.id !== target.id && soundsAlike(target, word(option.id)))
        expect(clashes, `${target.id} seed ${seed}`).toEqual([])
      }
    }
  })

  it('tells the learner which meaning an audio-only spelling card asks for', () => {
    const write = VOCAB.find(entry => entry.word === 'write')!
    expect(differentlySpelledHomophones(write, VOCAB).map(entry => entry.word)).toEqual(['right'])
    expect(buildReviewQuestion(write, VOCAB, 'spelling', 's').hintFa).toBe(write.fa)
    // Same spelling needs no hint; nor does a word without a homophone.
    expect(buildReviewQuestion(word('like'), VOCAB, 'spelling', 's').hintFa).toBeUndefined()
    expect(buildReviewQuestion(VOCAB.find(entry => entry.word === 'book')!, VOCAB, 'spelling', 's').hintFa).toBeUndefined()
  })

  it('accepts either meaning when a shown headword names two entries', () => {
    const likeVerb = word('like-2')
    const likePrep = word('like')
    expect(isPersianTranslationCorrect('مانند', likeVerb)).toBe(false)
    expect(isHeadwordTranslationCorrect('مانند', likeVerb, VOCAB)).toBe(true)
    expect(isHeadwordTranslationCorrect('دوست داشتن', likePrep, VOCAB)).toBe(true)
    expect(isHeadwordTranslationCorrect('دوم', word('second-2'), VOCAB)).toBe(true)
    expect(isHeadwordTranslationCorrect('کتاب', likeVerb, VOCAB)).toBe(false)
  })
})
