import type { WordEntry } from './types'

export function normalizePersianAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/[‐‑‒–—−-]/g, ' ')
    .replace(/[،,؛;:!?؟."“”'()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function withoutParenthetical(value: string): string {
  return value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/（[^）]*）/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function acceptedPersianAnswers(word: Pick<WordEntry, 'fa'>): string[] {
  const surfaces = new Set<string>()
  const primary = word.fa.split(/[؛;،,/]/).map(part => part.trim()).filter(Boolean)

  const add = (value: string) => {
    const normalized = normalizePersianAnswer(value)
    if (normalized) surfaces.add(normalized)
  }

  add(word.fa)
  add(withoutParenthetical(word.fa))

  // Persian glosses sometimes omit a repeated compound head after a slash:
  // "ساعت دیواری/رومیزی" means "ساعت دیواری" OR "ساعت رومیزی".
  // Reconstruct only that explicitly omitted prefix; do not infer synonyms.
  const slashGroups = word.fa
    .split(/[؛;،,]/)
    .map(group => group.trim())
    .filter(Boolean)

  for (const group of slashGroups) {
    const slashParts = group.split('/').map(part => withoutParenthetical(part).trim()).filter(Boolean)
    if (slashParts.length < 2) continue
    const leftWords = slashParts[0].split(/\s+/).filter(Boolean)
    if (leftWords.length < 2) continue
    const sharedPrefix = leftWords.slice(0, -1).join(' ')
    for (const right of slashParts.slice(1)) {
      if (!right.includes(' ')) add(`${sharedPrefix} ${right}`)
    }
  }

  for (const part of primary) {
    add(part)
    const stripped = withoutParenthetical(part)
    add(stripped)

    for (const candidate of [part, stripped]) {
      const orParts = candidate.split(/\s+یا\s+/).map(item => item.trim()).filter(Boolean)
      if (orParts.length > 1) {
        for (const alternative of orParts) add(alternative)
      }
    }
  }

  return [...surfaces]
}

export function isPersianTranslationCorrect(input: string, word: Pick<WordEntry, 'fa'>): boolean {
  const normalized = normalizePersianAnswer(input)
  if (!normalized) return false
  return acceptedPersianAnswers(word).includes(normalized)
}
