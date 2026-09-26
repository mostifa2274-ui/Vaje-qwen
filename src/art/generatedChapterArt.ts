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
  b1c2: {
    src: publicAsset('art/chapters/b1c2.webp'),
    altFa: 'مینا عکس نینو را در دست دارد و خانواده‌اش همه‌جای خانه را برای پیدا کردن او می‌گردند.',
    altEn: 'Mina holds Nino’s photo while her family searches their home for him.',
    width: 640,
    height: 336,
  },
  b1c3: {
    src: publicAsset('art/chapters/b1c3.webp'),
    altFa: 'مینا فهرست جست‌وجو و کیف آب و نان را آماده می‌کند و برادرش برای بیرون رفتن منتظر است.',
    altEn: 'Mina prepares her search list and a bag with water and bread while her brother waits to leave.',
    width: 640,
    height: 336,
  },
  b1c4: {
    src: publicAsset('art/chapters/b1c4.webp'),
    altFa: 'مینا در حیاط خیس پس از باران میان گل‌ها دنبال نینو می‌گردد و یک پرندهٔ قرمز از باغچه پرواز می‌کند.',
    altEn: 'Mina searches the wet garden after the rain as a red bird flies out from the flowers.',
    width: 640,
    height: 336,
  },
  b1c5: {
    src: publicAsset('art/chapters/b1c5.webp'),
    altFa: 'مینا شب کنار در باز به حیاط گوش می‌دهد و ظرف آب و کمی نان برای بازگشت نینو بیرون گذاشته شده است.',
    altEn: 'Mina listens at the open door at night while water and bread wait outside for Nino.',
    width: 640,
    height: 336,
  },
  b2c3: {
    src: publicAsset('art/chapters/b2c3.webp'),
    altFa: 'مینا در پارک از دو پسری که فوتبال بازی می‌کنند دربارهٔ نینو می‌پرسد.',
    altEn: 'Mina asks two boys playing football in the park whether they have seen Nino.',
    width: 640,
    height: 336,
  },
  b3c4: {
    src: publicAsset('art/chapters/b3c4.webp'),
    altFa: 'مینا در جشن کوچک خانوادگی تولد با شنیدن صدایی امیدوارانه به سوی در برمی‌گردد.',
    altEn: 'At the small family birthday gathering, Mina turns hopefully toward the door after hearing a sound.',
    width: 640,
    height: 336,
  },
  b3c3: {
    src: publicAsset('art/chapters/b3c3.webp'),
    altFa: 'مینا پس از یک روز طولانی جست‌وجو در دفتر قرمزش برنامهٔ فردا را می‌نویسد و عکس نینو کنار اوست.',
    altEn: 'After a long day searching, Mina writes tomorrow’s plan in her red notebook beside a photo of Nino.',
    width: 640,
    height: 336,
  },
  b2c4: {
    src: publicAsset('art/chapters/b2c4.webp'),
    altFa: 'مینا و مادرش در کافهٔ خیابانی به اجرای یک نوازندهٔ مرد گوش می‌دهند.',
    altEn: 'Mina and her mother listen to a male street musician from a family cafe table.',
    width: 640,
    height: 336,
  },
  b4c3: {
    src: publicAsset('art/chapters/b4c3.webp'),
    altFa: 'مینا پس از قدم‌زدن در بازار در کافه نشسته و نوشیدنی می‌نوشد.',
    altEn: 'After walking through the market, Mina sits at the cafe with a drink.',
    width: 640,
    height: 336,
  },
  b3c2: {
    src: publicAsset('art/chapters/b3c2.webp'),
    altFa: 'مینا و برادرش با دفتر و مداد خانه‌ها و باغچه‌های خیابان‌های آرام را یکی‌یکی بررسی می‌کنند.',
    altEn: 'Mina and her brother use a notebook while checking houses and gardens on quiet streets.',
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
  b3c6: {
    src: publicAsset('art/chapters/b3c6.webp'),
    altFa: 'مینا شب کنار در باز ایستاده است و آب و نان برای بازگشت نینو بیرون آماده مانده است.',
    altEn: 'Mina stands at the open door at night while water and bread wait outside in case Nino returns.',
    width: 640,
    height: 336,
  },
  b4c1: {
    src: publicAsset('art/chapters/b4c1.webp'),
    altFa: 'مینا در بازار شلوغ میان میوه‌ها و سبزی‌ها به دنبال نشانه‌ای از نینو می‌گردد.',
    altEn: 'Mina searches a busy produce market for any sign of Nino.',
    width: 640,
    height: 336,
  },
  b4c5: {
    src: publicAsset('art/chapters/b4c5.webp'),
    altFa: 'مینا در بازار جوجهٔ زردی را که شبیه نینو است با دقت نگاه می‌کند و می‌فهمد نینو نیست.',
    altEn: 'At the market, Mina studies a real yellow lookalike chicken and realizes it is not Nino.',
    width: 640,
    height: 336,
  },
  b5c1: {
    src: publicAsset('art/chapters/b5c1.webp'),
    altFa: 'مینا پس از یک روز جست‌وجو همراه پدر و مادرش دربارهٔ جاهای بررسی‌شده و برنامهٔ فردا صحبت می‌کند.',
    altEn: 'After a long search day, Mina talks with her mother and father about where they looked and tomorrow’s plan.',
    width: 640,
    height: 336,
  },
  b5c2: {
    src: publicAsset('art/chapters/b5c2.webp'),
    altFa: 'مینا پشت میز نشسته و با مداد یادداشت تازه‌ای دربارهٔ نینو می‌نویسد.',
    altEn: 'Mina sits at the table and writes a new note about Nino with a pencil.',
    width: 640,
    height: 336,
  },
  b6c1: {
    src: publicAsset('art/chapters/b6c1.webp'),
    altFa: 'مینا در کلاس مدرسه همراه دانش‌آموزان دیگر مشغول نوشتن و یادگیری است.',
    altEn: 'Mina writes and learns in her classroom with other students.',
    width: 640,
    height: 336,
  },
  b7c3: {
    src: publicAsset('art/chapters/b7c3.webp'),
    altFa: 'مینا از پنجرهٔ قطار به دشت‌های سبز و کوه‌های شمال نگاه می‌کند.',
    altEn: 'Mina looks from the train window across green fields toward the northern mountains.',
    width: 640,
    height: 336,
  },
  b7c1: {
    src: publicAsset('art/chapters/b7c1.webp'),
    altFa: 'مینا همراه مادر و پدرش لباس‌ها و چمدان‌ها را برای سفر آماده می‌کند.',
    altEn: 'Mina packs clothes and luggage with her mother and father before the family trip.',
    width: 640,
    height: 336,
  },
  b7c2: {
    src: publicAsset('art/chapters/b7c2.webp'),
    altFa: 'مینا با کوله‌پشتی و بلیت در سکوی قطار آمادهٔ ادامهٔ سفر خانوادگی است.',
    altEn: 'Mina waits on the train platform with her backpack and ticket, ready to continue the family trip.',
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
