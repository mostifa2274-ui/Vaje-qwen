import { CHAPTER_SCENES } from '../art/scenes'
import { ArtIds, Defs, Finish } from '../art/kit'
import { GENERATED_CHAPTER_ART } from '../art/generatedChapterArt'

interface Props {
  chapterId: string
  titleFa: string
}

export default function ChapterIllustration({ chapterId, titleFa }: Props) {
  const generated = GENERATED_CHAPTER_ART[chapterId]
  if (generated) {
    return (
      <img
        className="lesson-chapter-art lesson-chapter-image"
        src={generated.src}
        width={generated.width}
        height={generated.height}
        alt={generated.altFa}
        decoding="async"
      />
    )
  }

  const scene = CHAPTER_SCENES[chapterId]
  if (!scene) {
    return (
      <div className="lesson-cover-fallback" role="img" aria-label={`تصویر داستان: ${titleFa}`}>
        <span aria-hidden="true">🐥</span>
      </div>
    )
  }

  return (
    <svg
      className="lesson-chapter-art"
      viewBox="0 0 800 420"
      role="img"
      aria-label={`تصویر داستان «${titleFa}»: ${scene.alt}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <ArtIds prefix={`art-${chapterId}`}>
        <Defs />
        {scene.draw()}
        <Finish width={800} height={420} />
      </ArtIds>
    </svg>
  )
}
