# قصه — Ghesse 5.0 Production

قصه یک PWA فارسی‌محور برای **تسلط واقعی بر ۸۹۹ واژهٔ A1 انگلیسی** در دل یک داستان ۴۰ فصلی است. نسخهٔ 5.0 مسیر را بر پایهٔ تشخیص اولیه، بازیابی فعال، مرور فاصله‌دار FSRS، تولید نوشتاری، آزمون‌های مرحله‌ای و remediation دقیق می‌سازد؛ پایان فصل به‌تنهایی هیچ واژه‌ای را «مسلط» نمی‌کند.

## مسیر هر فصل

1. **آموزش مستقیم واژه‌های تازه**؛ هر واژه با معنی فارسی، IPA، مثال و تلفظ خودکار انگلیسی نمایش داده می‌شود. این مرحله آزمون نیست و هیچ حدس اولیه‌ای ندارد.
2. **آزمون ترجمهٔ نوشتاری ۱۰۰٪**؛ همهٔ واژه‌های فصل باید از انگلیسی به فارسی درست ترجمه شوند. پاسخ غلط بعد از بازخورد دوباره وارد صف می‌شود.
3. **آزمون شنیداری ۱۰۰٪**؛ واژه بدون نمایش متن انگلیسی پخش می‌شود و زبان‌آموز معنی فارسی را انتخاب می‌کند. پاسخ غلط دوباره در همان آزمون تکرار می‌شود.
4. **بازشدن قصه فقط پس از قبولی کامل هر دو آزمون**؛ برای فصل‌های ناتمام، `preparedAt` قدیمی یا نتیجهٔ ناقص دیگر کافی نیست.
5. **قصه + درک مطلب** در بافت طبیعی، با ترجمهٔ اختیاری.
6. **Smart Review** بر اساس دشواری، پایداری، retrievability، نوع خطا و فاصلهٔ واقعی زمانی.

## آزمون‌های gate

- پایان هر کتاب: **۳۲ سؤال**، حداقل **۸۵٪ کل** و **۸۰٪ typed recall**.
- پس از کتاب ۴: **۵۶ سؤال تجمعی**، حداقل **۸۸٪ کل** و **۸۵٪ typed recall**.
- پایان مسیر: **۸۸ سؤال تجمعی**، حداقل **۹۲٪ کل** و **۹۰٪ typed recall**.
- هر آزمون حداقل از همهٔ فصل‌های محدودهٔ خود نمونه می‌گیرد و ظرفیت باقی‌مانده را به واژه‌های ضعیف و کمتر آزموده‌شده اختصاص می‌دهد.
- حتی اگر نمرهٔ آزمون قبول باشد، واژه‌های غلط باید بعد از آزمون با بازیابی مستقل remediation شوند تا gate بعدی واقعاً باز شود.

## تعریف mastery

سطوح واژه:

`تازه → دیده‌شده → در حال یادگیری → قوی → مسلط`

«مسلط» فقط با شواهد مستقل و فاصله‌دار به دست می‌آید: موفقیت در روزهای متفاوت، پوشش معنی/بافت/تولید/فرم، productive recall، accuracy مناسب، پایداری کافی و آخرین retrieval موفق. لمس معنی، reread، completion و retry بلافاصله بعد از دیدن جواب mastery evidence نیستند.

## Scheduler

هستهٔ زمان‌بندی از مدل FSRS-6 استفاده می‌کند، اما برای واژگان تازه guardrailهای acquisition دارد تا یک پاسخ سریع نتواند فاصله را غیرواقعی به ماه‌ها یا سال‌ها بپراند. retry بعد از feedback برای relearning مفید است ولی stability، success day یا mastery را افزایش نمی‌دهد.

## محتوا و صدا

- **۸۹۹** واژه
- **۴۰** فصل
- **۱۸۵۴** جفت جملهٔ انگلیسی/فارسی
- **۴۰۰** سؤال درک مطلب (۱۰ سؤال برای هر فصل)
- **۶۰۶** جملهٔ ویرایش‌شده نسبت به script ضبط اولیه، بنابراین MP3 قدیمی آن‌ها هرگز به‌عنوان fallback استفاده نمی‌شود.
- deployment GitHub/Cloudflare به‌صورت **speech-first** است: صدای انگلیسی منتخب سیستم/مرورگر برای قصه، واژه و مثال استفاده می‌شود. MP3 فقط در buildهایی فعال می‌شود که واقعاً pack را با `VITE_BUNDLED_AUDIO=1` همراه دارند.

## persistence

- state schema: **v6**
- migration امن از نسخه‌های قبلی
- فیلتر IDهای ناشناخته
- rolling backup
- export/import JSON با محدودیت ۲MB
- gate engine منبع حقیقت progression است

## QA

```bash
npm ci
npm run check
npm run build
```

`npm run check` شامل validation کامل داده/ویرایش/assignment/mastery، ESLint، Vitest، TypeScript و Vite production build است.

## Cloudflare

این مخزن برای Cloudflare Workers static assets و انتشار خودکار از شاخهٔ `main` آماده است:

- root: `/`
- build command: خالی / `None`
- build variable: `SKIP_DEPENDENCY_INSTALL=1` اگر نصب خودکار Cloudflare غیرفعال شده است
- deploy command: `npm run deploy`
- output: `dist/`
- Worker name: `vaje-qwen1`
- production URL: `https://vaje-qwen1.mostifa2273.workers.dev/`

`npm run deploy` وابستگی‌ها را از lockfile نصب می‌کند، همهٔ بررسی‌های محتوا و کیفیت، lint، test و build را اجرا می‌کند، سپس Wrangler را اجرا می‌کند. اگر تنظیمات Cloudflare دو فرمان جداگانه می‌خواهد، Build command را `npm run cloudflare:build` و Deploy command را `npx wrangler@4.135.0 deploy` قرار بده. `dist/` باید پیش از اجرای Wrangler ساخته شده باشد.

`.github/workflows/live-smoke.yml` پس از هر push روی `main` منتظر انتشار Cloudflare می‌ماند و `/release.json` را با commit بررسی می‌کند. `.github/workflows/deploy-production.yml` تنها در صورت وجود دو secret استاندارد `CLOUDFLARE_API_TOKEN` و `CLOUDFLARE_ACCOUNT_ID` انتشار مستقیم جایگزین را انجام می‌دهد؛ سبز شدن این workflow هنگام نبود secret به معنی انتشار نیست.

## Provenance

`CONTENT_PROVENANCE.md` و `provenance/release-rights.json` وضعیت منبع واژگان را ثبت می‌کنند. رکورد فعلی همچنان `blocked` است، زیرا مدرک حقوق بازنشر برای انتخاب واژگان فعلی در این مخزن وجود ندارد. این وضعیت دیگر ساخت یا انتشار فنی را متوقف نمی‌کند و انتشار موفق به معنی تأیید حقوق محتوا نیست. مسیر بازسازی مستقل در `provenance/open-vocab/README.md` آمده است.
