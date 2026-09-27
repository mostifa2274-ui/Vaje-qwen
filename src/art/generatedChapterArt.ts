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
 * Production chapter illustrations: one reviewed raster scene per chapter.
 *
 * Only reviewed assets are listed here, and every chapter must have one
 * (ChapterIllustration.test.tsx, scripts/validate-generated-art.mjs).
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
  b4c2: {
    src: publicAsset('art/chapters/b4c2.webp'),
    altFa: 'مینا در مغازهٔ نان با نانوا دربارهٔ جوجهٔ زردی که صبح‌ها دیده می‌شود صحبت می‌کند.',
    altEn: 'Mina speaks with the baker in the bread shop about the little yellow chicken seen there in the mornings.',
    width: 640,
    height: 336,
  },
  b4c4: {
    src: publicAsset('art/chapters/b4c4.webp'),
    altFa: 'مینا در کافه کنار مادرش نشسته است و پیشخدمت هنگام پرداخت صورتحساب، یک سکه به مادر برمی‌گرداند.',
    altEn: 'At the cafe, Mina watches as the waiter returns a coin to her mother while she pays the bill.',
    width: 640,
    height: 336,
  },
  b5c3: {
    src: publicAsset('art/chapters/b5c3.webp'),
    altFa: 'مینا تلفن را پاسخ می‌دهد و اطلاعات تازه‌ای دربارهٔ نینو دریافت می‌کند.',
    altEn: 'Mina answers the telephone and receives new information about Nino.',
    width: 640,
    height: 336,
  },
  b6c2: {
    src: publicAsset('art/chapters/b6c2.webp'),
    altFa: 'مینا یادداشت جست‌وجو را می‌نویسد و معلم به نمودار خیابان‌ها اشاره می‌کند؛ عکس نینو روی میز است.',
    altEn: 'Mina improves her search note while her teacher points to a street chart; a flat photo of Nino lies on the desk.',
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
  b2c5: {
    src: publicAsset('art/chapters/b2c5.webp'),
    altFa: 'مینا و پدرش با عکس نینو از زن همسایه دربارهٔ مسیر مرکز شهر راهنمایی می‌گیرند.',
    altEn: 'Mina and her father show Nino’s photograph to a neighbor who points toward the city center.',
    width: 640,
    height: 336,
  },
  b3c1: {
    src: publicAsset('art/chapters/b3c1.webp'),
    altFa: 'مینا و مادرش در پایان یک هفته جست‌وجو، مسیر کنار رودخانه را با نقشه و دفتر قرمز بررسی می‌کنند.',
    altEn: 'Mina and her mother continue their week of searching along the river road with a map and red notebook.',
    width: 640,
    height: 336,
  },
  b3c5: {
    src: publicAsset('art/chapters/b3c5.webp'),
    altFa: 'مینا و پدرش پشت میز اطلاعات شهر، نقشه و گزارش‌های جست‌وجوی نینو را بررسی می‌کنند.',
    altEn: 'Mina and her father review a city map and search reports at the information desk.',
    width: 640,
    height: 336,
  },
  b5c4: {
    src: publicAsset('art/chapters/b5c4.webp'),
    altFa: 'مینا کنار یادداشت جست‌وجوی نینو از کمک زن همسایه تشکر می‌کند و خانواده‌اش همراه او هستند.',
    altEn: 'With her family beside the missing-pet notice, Mina thanks a neighbor for helping.',
    width: 640,
    height: 336,
  },
  b6c3: {
    src: publicAsset('art/chapters/b6c3.webp'),
    altFa: 'مینا در دفتر کار پدرش چاپ عکس و یادداشت نینو را می‌بیند؛ نقشهٔ شهر روی رایانه است.',
    altEn: 'At her father’s office, Mina watches a notice with Nino’s photograph emerge from the printer beside a city map.',
    width: 640,
    height: 336,
  },
  b6c4: {
    src: publicAsset('art/chapters/b6c4.webp'),
    altFa: 'مینا و پدرش در دانشگاه جوجه‌ای شبیه نینو را با حلقهٔ آبی پا بررسی می‌کنند و می‌فهمند نینو نیست.',
    altEn: 'At the university, Mina and her father recognize that the yellow chick with a blue leg band is a lookalike, not Nino.',
    width: 640,
    height: 336,
  },
  b7c4: {
    src: publicAsset('art/chapters/b7c4.webp'),
    altFa: 'پس از باران، کشاورز در ایوان خانهٔ مزرعه به مینا نان و یک گل می‌دهد و پدر و مادرش همراه او هستند.',
    altEn: 'After the rain, a farmer gives Mina bread and a flower at the farmhouse porch while her parents stand beside her.',
    width: 640,
    height: 336,
  },
  b7c5: {
    src: publicAsset('art/chapters/b7c5.webp'),
    altFa: 'مینا و مادرش هنگام غروب کنار قایق ماهیگیری، عکس نینو را به مرد ماهیگیر نشان می‌دهند.',
    altEn: 'At dusk on the beach, Mina and her mother show Nino’s photograph to a fisherman beside his boat.',
    width: 640,
    height: 336,
  },
  b8c1: {
    src: publicAsset('art/chapters/b8c1.webp'),
    altFa: 'مینا همراه پدر و مادرش از مسیر کوه بالا می‌رود و به خانهٔ خاکستری با باغ پرگل نزدیک می‌شود.',
    altEn: 'Mina and her parents climb the mountain path toward the gray family house and its flower-filled garden.',
    width: 640,
    height: 336,
  },
  b8c2: {
    src: publicAsset('art/chapters/b8c2.webp'),
    altFa: 'مینا پس از کوه‌پیمایی زیر لحاف استراحت می‌کند و با عکس نینو در دست به قصهٔ مادربزرگ گوش می‌دهد.',
    altEn: 'Resting under a quilt after the climb, Mina holds Nino’s photograph and listens to her grandmother’s story.',
    width: 640,
    height: 336,
  },
  b8c3: {
    src: publicAsset('art/chapters/b8c3.webp'),
    altFa: 'مینا در اتاق معاینه به پزشک گوش می‌دهد و پرستار برای عمویش یک لیوان آب می‌آورد.',
    altEn: 'Mina listens to the doctor while a nurse brings her uncle a glass of water after his examination.',
    width: 640,
    height: 336,
  },
  b8c4: {
    src: publicAsset('art/chapters/b8c4.webp'),
    altFa: 'مینا و مادربزرگ در شب بارانی کنار آتش دربارهٔ نینو حرف می‌زنند و دفتر قرمز روی پای میناست.',
    altEn: 'On a rainy night, Mina and her grandmother talk beside the fire with Mina’s red notebook on her lap.',
    width: 640,
    height: 336,
  },
  b8c5: {
    src: publicAsset('art/chapters/b8c5.webp'),
    altFa: 'مینا در باغ زیر ستاره‌ها تصویر نینو را در دفتر قرمزش نقاشی می‌کند و مادربزرگ به یک ستاره اشاره می‌کند.',
    altEn: 'Under the stars, Mina paints Nino in her red notebook while her grandmother points to a bright star.',
    width: 640,
    height: 336,
  },

}

