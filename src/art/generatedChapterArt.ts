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
  b1c1: {
    src: publicAsset('art/chapters/b1c1.avif'),
    altFa: 'نینو از خانه به‌دنبال پرندهٔ قرمز می‌دود و مینا با کتاب قرمزش به‌دنبالش می‌رود.',
    altEn: 'Nino runs out after the red bird while Mina reacts and follows with her red book.',
    width: 640,
    height: 336,
  },
  b2c1: {
    src: publicAsset('art/chapters/b2c1.webp'),
    altFa: 'مینا همراه پدر و مادرش در پارکی در تهران دنبال نینو می‌گردد.',
    altEn: 'Mina, her mother and father search a Tehran park for Nino.',
    width: 640,
    height: 336,
  },
  b2c2: {
    src: publicAsset('art/chapters/b2c2.avif'),
    altFa: 'مینا همراه پدر و مادرش در یک خیابان مسکونی تهران عکس نینو را به همسایه نشان می‌دهد و دربارهٔ او سؤال می‌کند.',
    altEn: 'Mina, her mother and father show Nino’s photo to a neighbor on a residential Tehran street.',
    width: 640,
    height: 336,
  },
  b8c6: {
    src: publicAsset('art/chapters/b8c6.avif'),
    altFa: 'پس از بازگشت نینو، مینا همراه مادر و پدرش در خانه کنار سبد نینو نقشه و عکس‌های جست‌وجو را مرور می‌کند.',
    altEn: 'After Nino returns, Mina, her mother and father review the search map and photos at home beside Nino’s basket.',
    width: 640,
    height: 336,
  },
}
