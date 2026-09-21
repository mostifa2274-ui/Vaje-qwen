# قصه — Ghesse 5.0 Production

قصه یک PWA فارسی‌محور برای **تسلط واقعی بر ۸۹۹ واژهٔ A1 انگلیسی** در دل یک داستان ۴۰ فصلی است. نسخهٔ 5.0 مسیر را بر پایهٔ تشخیص اولیه، بازیابی فعال، مرور فاصله‌دار FSRS، تولید نوشتاری، آزمون‌های مرحله‌ای و remediation دقیق می‌سازد؛ پایان فصل به‌تنهایی هیچ واژه‌ای را «مسلط» نمی‌کند.

## مسیر هر فصل

1. **Pretest کم‌ریسک** برای تشخیص دانسته‌های اولیه، بدون امتیاز mastery.
2. **آموزش اصلاحی فوری** برای واژه‌های تازه.
3. **Readiness recognition**؛ همهٔ واژه‌های تازه باید درست بازیابی شوند و خطاها دوباره در صف می‌آیند.
4. **Productive recall**؛ همهٔ خطاها + نمونه‌ای نظام‌مند از بقیه باید بدون گزینه تایپ شوند.
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
- **۸۰** سؤال درک مطلب
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

این repository برای Cloudflare Workers static assets و Git deployment آماده است. تنظیم فعلی Worker بدون تغییر داشبورد پشتیبانی می‌شود:

- production branch: `main`
- root: `/`
- build command: خالی / `None`
- build variable: `SKIP_DEPENDENCY_INSTALL=1`
- deploy command: `npm run deploy`
- output: `dist/`
- Worker name: `vaje-qwen`
- production URL: `https://vaje-qwen.mostifa2273.workers.dev/`

`npm run deploy` عمداً self-contained است: ابتدا `npm ci --ignore-scripts` را از lockfile اجرا می‌کند، سپس همهٔ validationها، lint، test، TypeScript و Vite build را با `npm run cloudflare:build` می‌گذراند و در پایان Wrangler را deploy می‌کند. بنابراین `SKIP_DEPENDENCY_INSTALL=1` در تنظیم فعلی Cloudflare امن است.

Cloudflare با تنظیم استاندارد جدید نیز پشتیبانی می‌شود: dependency install خودکار، Build command برابر `npm run build` و Deploy command برابر `npx wrangler@4.135.0 deploy`. در هر دو حالت `dist/` قبل از deploy ساخته می‌شود.

`.github/workflows/live-smoke.yml` پس از هر push روی `main` منتظر انتشار Cloudflare می‌ماند و `/release.json` را بررسی می‌کند.

## provenance

کیفیت فنی و حقوق بازتوزیع دو موضوع جدا هستند. `CONTENT_PROVENANCE.md` باید همراه release نگهداری شود. `npm run release:check` عمداً بدون `GHESSE_RIGHTS_CONFIRMED=1` fail می‌شود؛ این متغیر فقط زمانی باید تنظیم شود که evidence حقوق انتشار در release record موجود باشد.