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

این repository برای Cloudflare Workers static assets و Git deployment آماده است. تنظیم فعلی Worker بدون تغییر داشبورد پشتیبانی می‌شود:

- production branch: `main`
- root: `/`
- build command: خالی / `None`
- build variables:
  - `SKIP_DEPENDENCY_INSTALL=1`
  - `GHESSE_RIGHTS_CONFIRMED=1` **فقط پس از ثبت evidence حقوق بازتوزیع مطابق `CONTENT_PROVENANCE.md`**؛ این flag به‌تنهایی کافی نیست و `provenance/release-rights.json` نیز باید `cleared` و با SHA-256 دقیق `src/data/vocabulary.json` منطبق باشد.
- deploy command: `npm run deploy`
- output: `dist/`
- Worker name: `vaje-qwen1`
- production URL: `https://vaje-qwen1.mostifa2273.workers.dev/`

`npm run deploy` عمداً self-contained و fail-closed است: ابتدا dependencyها را از lockfile نصب می‌کند، سپس `npm run release:check` را از مسیر `cloudflare:build` اجرا می‌کند، بعد همهٔ validationها، lint، test، TypeScript و Vite build را می‌گذراند و در پایان Wrangler را deploy می‌کند. public deploy زمانی متوقف می‌شود که `GHESSE_RIGHTS_CONFIRMED=1` وجود نداشته باشد **یا** manifest حقوقی checked-in هنوز blocked باشد **یا** SHA-256 ثبت‌شده با vocabulary فعال فرق کند. بنابراین flag محیطی به‌تنهایی هیچ release را مجاز نمی‌کند.

برای تنظیم استاندارد جدید Cloudflare نیز Build command را `npm run cloudflare:build` و Deploy command را `npx wrangler@4.135.0 deploy` بگذار؛ همان `GHESSE_RIGHTS_CONFIRMED=1` باید فقط پس از ثبت evidence حقوق انتشار موجود باشد. در هر دو مسیر `dist/` پیش از deploy ساخته می‌شود و release gate قابل دورزدن نیست.

`.github/workflows/live-smoke.yml` پس از هر push روی `main` منتظر انتشار Cloudflare می‌ماند و `/release.json` را بررسی می‌کند. همچنین `.github/workflows/deploy-production.yml` پس از موفقیت CI همان commit را مستقیماً با Wrangler deploy می‌کند، اگر secrets استاندارد `CLOUDFLARE_API_TOKEN` و `CLOUDFLARE_ACCOUNT_ID` در GitHub Actions موجود باشند؛ در غیر این صورت بدون افشای secret، direct deploy را skip می‌کند و Cloudflare Git integration مسیر فعال باقی می‌ماند.

## provenance

کیفیت فنی و حقوق بازتوزیع دو موضوع جدا هستند. `CONTENT_PROVENANCE.md` و `provenance/release-rights.json` باید همراه release نگهداری شوند. `npm run release:check` عمداً بدون acknowledgement محیطی، manifest `cleared`، evidence منبع/مجوز و SHA-256 منطبق fail می‌شود. مسیر بازسازی مستقل واژگان در `provenance/open-vocab/README.md` ثبت شده است.