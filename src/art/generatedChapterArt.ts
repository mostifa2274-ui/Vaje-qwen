export interface GeneratedChapterArt {
  src: string
  altFa: string
  altEn: string
  width: number
  height: number
}

function publicAsset(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path
  return `${import.meta.env.BASE_URL}${clean}`
}

/**
 * Production-generated chapter illustrations.
 *
 * Only reviewed assets are listed here. Every other chapter keeps using the
 * existing vector scene, so artwork can be rolled out incrementally without
 * breaking the learning flow.
 */
export const GENERATED_CHAPTER_ART: Record<string, GeneratedChapterArt> = {
  b2c1: {
    src: publicAsset('art/chapters/b2c1.webp'),
    altFa: 'مینا همراه پدر و مادرش در پارکی در تهران دنبال نینو می‌گردد.',
    altEn: 'Mina, her mother and father search a Tehran park for Nino.',
    width: 640,
    height: 336,
  },
}
