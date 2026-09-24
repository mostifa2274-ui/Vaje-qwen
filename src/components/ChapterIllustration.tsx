import { CHAPTER_SCENES } from '../art/scenes'
import { ArtIds, Defs, Finish } from '../art/kit'

interface Props {
  chapterId: string
  titleFa: string
}

export default function ChapterIllustration({ chapterId, titleFa }: Props) {
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
