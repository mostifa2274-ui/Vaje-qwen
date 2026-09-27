import { GENERATED_CHAPTER_ART } from '../art/generatedChapterArt'

interface Props {
  chapterId: string
  titleFa: string
}

export default function ChapterIllustration({ chapterId, titleFa }: Props) {
  const generated = GENERATED_CHAPTER_ART[chapterId]
  if (!generated) {
    return (
      <div className="lesson-cover-fallback" role="img" aria-label={`تصویر داستان: ${titleFa}`}>
        <span aria-hidden="true">🐥</span>
      </div>
    )
  }

  return (
    <img
      className="lesson-chapter-art lesson-chapter-image"
      src={generated.src}
      width={generated.width}
      height={generated.height}
      alt={generated.altFa}
      decoding="async"
      loading="eager"
      fetchPriority="high"
    />
  )
}
