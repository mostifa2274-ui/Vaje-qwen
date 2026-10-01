/**
 * Shown on an audio-only spelling card when another deck word sounds the same
 * but is spelled differently (right/write): the meaning says which is asked.
 */
export default function SpellingHint({ meaning }: { meaning: string }) {
  return (
    <div className="spelling-hint luxury-spelling-hint mt-3 text-sm leading-7" data-testid="spelling-hint">
      واژهٔ هم‌آوای دیگری هم هست؛ منظور این معنی است: <b>{meaning}</b>
    </div>
  )
}
