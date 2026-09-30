import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { persianPartOfSpeech } from '../src/engine/partOfSpeech'
import { faNum } from '../src/engine/format'
import { clipId } from '../src/engine/audioClips'
import { startOfflineOrigin } from './offlineOrigin'
import { dayKey } from '../src/engine/days'

interface VocabularyEntry {
  id: string
  word: string
  fa: string
  ex: string
  pos: string
}

interface ChapterFixture {
  id: string
  new: string[]
  check: Array<{ a: string }>
  sentences: Array<{ en: string }>
}

const chapter = JSON.parse(
  readFileSync(new URL('../src/data/chapters/b1c1.json', import.meta.url), 'utf8'),
) as ChapterFixture

const vocabulary = JSON.parse(
  readFileSync(new URL('../src/data/vocabulary.json', import.meta.url), 'utf8'),
) as VocabularyEntry[]

const wordById = new Map(vocabulary.map(word => [word.id, word]))
const wordBySurface = new Map(vocabulary.map(word => [word.word, word]))
const chapterWords = chapter.new.map(id => {
  const word = wordById.get(id)
  if (!word) throw new Error(`Missing test vocabulary entry: ${id}`)
  return word
})

async function spokenWord(page: Page): Promise<string> {
  return page.evaluate(() => (
    window as Window & { __ghesseSpoken?: string }
  ).__ghesseSpoken ?? '')
}

async function speechHistory(page: Page): Promise<string[]> {
  return page.evaluate(() => (
    window as Window & { __ghesseSpeechHistory?: string[] }
  ).__ghesseSpeechHistory ?? [])
}

async function openHomeSection(page: Page, name: 'امروز' | 'مسیر' | 'کتابخانه'): Promise<void> {
  const tab = page.getByRole('tab', { name, exact: true })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

async function expectTouchSafeStoryControls(page: Page): Promise<void> {
  const controls = [
    page.getByRole('button', { name: 'شنیدن جمله' }).first(),
    page.getByRole('button', { name: 'نمایش ترجمهٔ فارسی' }).first(),
  ]

  for (const control of controls) {
    await expect(control).toBeVisible()
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5)
  }
}

async function expectRenderedAccessibilityContract(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const isVisible = (element: HTMLElement) => {
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && rect.width > 0
        && rect.height > 0
    }

    const ids = new Map<string, number>()
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('[id]'))) {
      const id = element.id.trim()
      if (id) ids.set(id, (ids.get(id) ?? 0) + 1)
    }

    const duplicateIds = [...ids.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id)

    const controls = Array.from(document.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea',
    )).filter(element => {
      if (!isVisible(element)) return false
      if (element.getAttribute('aria-hidden') === 'true') return false
      if ('disabled' in element && (element as HTMLButtonElement).disabled) return false
      if (element instanceof HTMLInputElement && element.type === 'hidden') return false
      return true
    })

    const unnamedControls = controls
      .filter(element => {
        const labelledBy = element.getAttribute('aria-labelledby')
        const labelledByText = labelledBy
          ? labelledBy
              .split(/\s+/)
              .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
              .join(' ')
              .trim()
          : ''
        const labelText = element instanceof HTMLInputElement
          || element instanceof HTMLSelectElement
          || element instanceof HTMLTextAreaElement
          ? Array.from(element.labels ?? []).map(label => label.textContent?.trim() ?? '').join(' ').trim()
          : ''
        const name = [
          element.getAttribute('aria-label')?.trim() ?? '',
          labelledByText,
          labelText,
          element.innerText?.trim() ?? '',
          element.getAttribute('title')?.trim() ?? '',
        ].find(Boolean)
        return !name
      })
      .map(element => `${element.tagName.toLowerCase()}#${element.id || '(no-id)'}.${element.className || '(no-class)'}`)

    const undersizedButtons = controls
      .filter(element => element.tagName === 'BUTTON' && !element.classList.contains('tok-word'))
      .filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.width < 43.5 || rect.height < 43.5
      })
      .map(element => {
        const rect = element.getBoundingClientRect()
        return `${element.textContent?.trim() || element.getAttribute('aria-label') || 'button'}:${rect.width.toFixed(1)}x${rect.height.toFixed(1)}`
      })

    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      mainCount: document.querySelectorAll('main').length,
      duplicateIds,
      unnamedControls,
      undersizedButtons,
    }
  })

  expect(result.lang).toBe('fa')
  expect(result.dir).toBe('rtl')
  expect(result.mainCount).toBe(1)
  expect(result.duplicateIds).toEqual([])
  expect(result.unnamedControls).toEqual([])
  expect(result.undersizedButtons).toEqual([])
}

async function answerCurrentWrittenWord(page: Page): Promise<void> {
  const stage = page.locator('.learning-focus-card')
  const surface = (await page.getByTestId('written-headword').innerText()).trim()
  const entry = wordBySurface.get(surface)
  if (!entry) throw new Error(`Unknown written headword in browser test: ${surface}`)

  const input = page.getByLabel('ترجمهٔ فارسی')
  await input.fill(entry.fa)
  await input.press('Enter')
  await expect(stage.locator('.feedback-panel')).toContainText('درست')

  await expect.poll(async () => {
    if (await page.getByText('شنیداری · ۱۰۰٪').isVisible()) return 'advanced'
    const headword = page.getByTestId('written-headword')
    if (!await headword.isVisible()) return 'advanced'
    return (await headword.innerText()).trim() === surface ? 'waiting' : 'advanced'
  }).toBe('advanced')

  if (await page.getByTestId('written-headword').isVisible()) {
    await expect(input).toBeFocused()
  }
}

async function answerCurrentListeningWord(page: Page, expected: VocabularyEntry): Promise<void> {
  const stage = page.locator('.learning-focus-card')
  await expect.poll(() => spokenWord(page)).toBe(expected.word)

  const correct = page
    .getByTestId('listening-options')
    .getByRole('button', { name: expected.fa, exact: true })

  await expect(correct).toBeEnabled()
  await correct.click()
  await expect(stage.locator('.feedback-panel')).toContainText(expected.word)

  await expect.poll(async () => {
    if (/\/read\/b1c1$/.test(page.url())) return 'advanced'
    return (await spokenWord(page)) === expected.word ? 'waiting' : 'advanced'
  }).toBe('advanced')
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Playwright supplies a fresh context per test. Do not clear storage on
    // navigation: reloads and extra tabs must preserve the learner's progress.

    // These flows assert on the fake speech engine below, so the recorded
    // narration is hidden unless a test opts in with __ghesseRecordedAudio.
    const realFetch = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const recorded = (window as Window & { __ghesseRecordedAudio?: boolean }).__ghesseRecordedAudio
      if (!recorded && url.endsWith('/audio/index.json')) return Promise.resolve(new Response('', { status: 404 }))
      return realFetch(input, init)
    }

    class FakeSpeechSynthesisUtterance {
      text: string
      voice: unknown = null
      lang = ''
      rate = 1
      pitch = 1
      volume = 1
      onend: (() => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null

      constructor(text: string) {
        this.text = text
      }
    }

    const voice = {
      voiceURI: 'e2e-neural-en-us',
      name: 'E2E Neural English',
      lang: 'en-US',
      default: true,
      localService: false,
    }

    const testWindow = window as Window & {
      __ghesseSpoken?: string
      __ghesseSpeechHistory?: string[]
      __ghesseBlockSpeech?: boolean
    }
    testWindow.__ghesseSpoken = ''
    testWindow.__ghesseSpeechHistory = []

    const synth = {
      cancel() {},
      getVoices() {
        return [voice]
      },
      speak(utterance: FakeSpeechSynthesisUtterance) {
        if (testWindow.__ghesseBlockSpeech) {
          // Chrome's autoplay policy: speech without a recent user gesture.
          window.setTimeout(() => utterance.onerror?.({ error: 'not-allowed' }), 5)
          return
        }
        testWindow.__ghesseSpoken = utterance.text
        testWindow.__ghesseSpeechHistory?.push(utterance.text)
        window.setTimeout(() => utterance.onend?.(), 20)
      },
      addEventListener() {},
      removeEventListener() {},
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: FakeSpeechSynthesisUtterance,
      configurable: true,
    })
    Object.defineProperty(window, 'speechSynthesis', {
      value: synth,
      configurable: true,
    })
  })
})

test('rendered core screens satisfy the structural accessibility contract', async ({ page }) => {
  // Fresh progress cannot read b1c1 yet, so exercise Prep explicitly here.
  // Reader accessibility is asserted again after the full unlock journey below.
  const routes: Array<{ route: string; heading: string | RegExp }> = [
    { route: '/#/map', heading: 'قصه' },
    { route: '/#/glossary', heading: 'واژه‌نامه' },
    { route: '/#/flashcards', heading: 'جعبهٔ لایتنر' },
    { route: '/#/settings', heading: 'تنظیمات' },
    { route: '/#/review', heading: 'مرور هوشمند' },
    { route: '/#/prep/b1c1', heading: /واژه‌های تازه:/ },
    { route: '/#/diagnostic/b1c1', heading: 'تعیین سطح این فصل' },
  ]

  for (const { route, heading } of routes) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expect(page.locator('#main-content')).toBeVisible()
    await expectRenderedAccessibilityContract(page)
    await expectNoHorizontalOverflow(page)
  }
})


test('a deployed update waits for the calm home screen instead of interrupting learning', async ({ page }) => {
  await page.route('**/release.json**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      release: 'ghesse-5.0.0',
      app: 'Ghesse',
      worker: 'vaje-qwen1',
      vocabulary: 899,
      chapters: 40,
      stateSchema: 6,
      learningFlow: 'teach-write-listen-100',
      commit: 'ffffffffffffffffffffffffffffffffffffffff',
      branch: 'main',
    }),
  }))

  await page.goto('/#/map')
  const banner = page.locator('.app-update-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('نسخهٔ فعال برنامه تغییر کرده است')

  await page.goto('/#/prep/b1c1')
  await expect(page.getByRole('heading', { name: /واژه‌های تازه:/ })).toBeVisible()
  await expect(banner).toBeHidden()

  await page.goto('/#/map')
  await expect(banner).toBeVisible()
})

test('locked future books and preparation steps keep readable text opacity', async ({ page }) => {
  await page.goto('/#/map')
  await openHomeSection(page, 'مسیر')

  const locked = page.locator('.future-book-row').first()
  await expect(locked).toBeVisible()
  expect(await locked.evaluate(element => getComputedStyle(element).opacity)).toBe('1')
  expect(await locked.locator('h2').evaluate(element => getComputedStyle(element).opacity)).toBe('1')

  await page.goto('/#/prep/b1c1')
  const steps = page.locator('.prep-stepper li')
  await expect(steps).toHaveCount(4)
  for (let index = 0; index < 4; index++) {
    expect(await steps.nth(index).evaluate(element => getComputedStyle(element).opacity)).toBe('1')
  }
})

test('fresh install can open an unloaded lazy route offline', async ({ page, context }) => {
  // WebKit's setOffline emulation rejects even literal service-worker
  // responses (microsoft/playwright#42775). Stop a real isolated origin so
  // every engine exercises actual network failure and the same cache path.
  const origin = await startOfflineOrigin()
  try {
    await page.goto(`${origin.url}/#/map`)
    await expect(page.getByRole('heading', { level: 1, name: 'قصه' })).toBeVisible()

    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) throw new Error('service worker unavailable in browser QA')
      await navigator.serviceWorker.ready
      if (navigator.serviceWorker.controller) return
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('service worker did not claim page')), 7_000)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.clearTimeout(timeout)
          resolve()
        }, { once: true })
      })
    })

    const offlineClip = './audio/' + clipId('w', chapterWords[0].word) + '.mp3'
    const offlineClipBytes = await page.evaluate(async url => {
      const absolute = new URL(url, window.location.href).href
      const response = await fetch(absolute, { cache: 'no-cache' })
      if (!response.ok) throw new Error('recorded clip unavailable in offline QA fixture')
      const cache = await caches.open('ghesse-audio-v1')
      await cache.put(absolute, response.clone())
      return (await response.arrayBuffer()).byteLength
    }, offlineClip)
    expect(offlineClipBytes).toBeGreaterThan(32)

    await origin.stop()
    // Negative control: an HTTP client without a worker cannot reach the app.
    await expect(context.request.get(`${origin.url}/index.html`, { timeout: 3_000 })).rejects.toThrow()

    const cachedAudioRange = await page.evaluate(async url => {
      const response = await fetch(url, { headers: { Range: 'bytes=0-31' } })
      const bytes = await response.arrayBuffer()
      return {
        status: response.status,
        range: response.headers.get('content-range'),
        acceptRanges: response.headers.get('accept-ranges'),
        length: bytes.byteLength,
      }
    }, offlineClip)
    expect(cachedAudioRange.status).toBe(206)
    expect(cachedAudioRange.range).toBe(`bytes 0-31/${offlineClipBytes}`)
    expect(cachedAudioRange.acceptRanges).toBe('bytes')
    expect(cachedAudioRange.length).toBe(32)

    const uncachedRouteArt = await page.evaluate(async () => {
      const response = await fetch('./art/chapters/b8c5.webp')
      return { ok: response.ok, type: response.headers.get('content-type') }
    })
    expect(uncachedRouteArt.ok).toBe(true)
    expect(uncachedRouteArt.type).toMatch(/^image\//)

    await openHomeSection(page, 'کتابخانه')
    await page.getByRole('button', { name: 'واژه‌نامه' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'واژه‌نامه' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    // A cold navigation must also recover the shell after losing the origin.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'واژه‌نامه' })).toBeVisible()
    // So must a launch URL that was never cached, such as one with a query.
    await page.goto(`${origin.url}/?source=homescreen#/map`)
    await expect(page.getByRole('heading', { level: 1, name: 'قصه' })).toBeVisible()
  } finally {
    await origin.stop()
  }
})

test('the production build enforces its content security policy without a single violation', async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as Window & { __ghesseCspViolations?: string[] }).__ghesseCspViolations = seen
    document.addEventListener('securitypolicyviolation', event => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  await openWithProgress(page, '/map', { exploreAll: true })
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(policy).toContain("script-src 'self'")
  expect(policy).toContain("object-src 'none'")
  expect(policy).toContain("media-src 'self' blob:")
  expect(policy).not.toContain('unsafe-inline')
  expect(policy).not.toContain('unsafe-eval')

  for (const route of ['glossary', 'flashcards', 'offline-audio', 'settings', 'review', 'prep/b1c1', 'read/b1c1', 'exam/book-2', 'exam/final-8', 'map']) {
    await page.goto(`/#/${route}`)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  }
  // Art, recorded narration and a sheet all load under the policy.
  await page.goto('/#/read/b1c1')
  await expect.poll(() => page.evaluate(() => [...document.images].some(image => image.naturalWidth > 0))).toBe(true)
  await page.goto('/#/flashcards')
  await page.getByRole('button', { name: /شروع مرور/ }).click()
  await page.getByRole('button', { name: 'نمایش پاسخ' }).click()
  await expect(page.locator('.flashcard-meaning')).toBeVisible()
  const violations = await page.evaluate(() => (window as Window & { __ghesseCspViolations?: string[] }).__ghesseCspViolations ?? [])
  expect(violations).toEqual([])
})

test.describe('without a service worker', () => {
  // The service worker would answer from its precache; this covers a first
  // visit, or a browser that keeps no worker.
  test.use({ serviceWorkers: 'block' })

  test('a screen whose script fails to load reloads once, then offers a retry without losing the app', async ({ page }) => {
    await page.goto('/#/map')
    await expect(page.getByRole('heading', { level: 1, name: 'قصه' })).toBeVisible()
    await openHomeSection(page, 'کتابخانه')
    const chunk = /\/assets\/GlossaryScreen-[^/]+\.js$/
    let blocked = 0
    await page.route(chunk, route => {
      blocked++
      return route.abort()
    })
    await page.getByRole('button', { name: 'واژه‌نامه', exact: true }).click()
    // The first failure reloads the page by itself; the second one waits.
    const recovery = page.getByTestId('route-error')
    await expect(recovery).toBeVisible()
    await expect(recovery.getByRole('heading', { name: 'این بخش باز نشد' })).toBeVisible()
    expect(blocked).toBe(2)
    await expect(page).toHaveURL(/#\/glossary$/)
    await expect(page.getByRole('main')).toBeVisible()
    await expectRenderedAccessibilityContract(page)

    await page.unroute(chunk)
    await recovery.getByRole('button', { name: 'دوباره تلاش کن' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'واژه‌نامه' })).toBeVisible()

    // The way home works from the recovery card too.
    await page.route(/\/assets\/SettingsScreen-[^/]+\.js$/, route => route.abort())
    await page.goto('/#/map')
    await openHomeSection(page, 'کتابخانه')
    await page.getByRole('button', { name: 'تنظیمات', exact: true }).click()
    await expect(recovery).toBeVisible()
    await recovery.getByRole('button', { name: 'بازگشت به مسیر' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'قصه' })).toBeVisible()
  })
})

test('keyboard skip link focuses the main landmark without changing the hash route', async ({ page }) => {
  await page.goto('/#/map')
  await page.evaluate(() => {
    const body = document.body
    body.tabIndex = -1
    body.focus()
    body.removeAttribute('tabindex')
  })
  await page.keyboard.press('Tab')

  const skip = page.getByRole('link', { name: 'رفتن به محتوای اصلی' })
  await expect(skip).toBeFocused()
  await skip.press('Enter')

  const main = page.locator('#main-content')
  await expect(main).toBeFocused()
  await expect(main).toHaveAttribute('aria-label', 'مسیر یادگیری')
  await expect(page).toHaveTitle('مسیر یادگیری — قصه')
  await expect(page).toHaveURL(/#\/map$/)
})

test('home defaults to Today, keeps Journey focused, and exposes optional tools only in Library', async ({ page }) => {
  await page.goto('/#/map')

  const today = page.getByRole('tab', { name: 'امروز', exact: true })
  const journey = page.getByRole('tab', { name: 'مسیر', exact: true })
  const library = page.getByRole('tab', { name: 'کتابخانه', exact: true })
  await expect(today).toHaveAttribute('aria-selected', 'true')
  await expect(journey).toHaveAttribute('aria-selected', 'false')
  await expect(library).toHaveAttribute('aria-selected', 'false')
  await expect(page.locator('#home-panel-today')).toBeVisible()
  await expect(page.locator('#home-panel-journey')).toBeHidden()
  await expect(page.locator('#home-panel-library')).toBeHidden()
  await expect(page.locator('.next-action-card')).toBeVisible()
  await expect(page.getByTestId('today-strip')).toBeVisible()
  await expect(page.locator('.review-hero')).toBeVisible()
  await expect(page.locator('.home-summary')).toBeHidden()
  await expect(page.getByRole('button', { name: 'واژه‌نامه', exact: true })).toBeHidden()

  // RTL roving-tab keyboard navigation: ArrowLeft advances visually.
  await today.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(journey).toBeFocused()
  await expect(journey).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#home-panel-today')).toBeHidden()
  await expect(page.locator('#home-panel-journey')).toBeVisible()

  await expect(page.locator('.home-summary > div')).toHaveCount(3)
  await expect(page.locator('.journey-overview')).toHaveCount(0)
  await expect(page.locator('.method-details')).not.toHaveAttribute('open', '')
  const homeSurface = await page.locator('.app-main').evaluate(element => {
    const probe = document.createElement('div')
    probe.style.background = 'var(--cream)'
    document.body.append(probe)
    const expected = getComputedStyle(probe).backgroundColor
    probe.remove()
    return { actual: getComputedStyle(element).backgroundColor, expected }
  })
  expect(homeSurface.actual).toBe(homeSurface.expected)

  await expect(page.locator('.book-banner')).toHaveCount(1)
  await expect(page.locator('.future-book-row')).toHaveCount(7)
  const firstBannerHeight = await page.locator('.book-banner').first().evaluate(element => element.getBoundingClientRect().height)
  expect(firstBannerHeight).toBeLessThanOrEqual(170)
  const art = page.locator('.book-banner img').first()
  await expect(art).toHaveJSProperty('complete', true)
  const composition = await art.evaluate(element => {
    const image = element as HTMLImageElement
    const box = image.getBoundingClientRect()
    return { rendered: box.width / box.height, original: image.naturalWidth / image.naturalHeight }
  })
  expect(composition.rendered).toBeCloseTo(composition.original, 2)

  for (let number = 1; number <= 5; number++) {
    const chapterInfo = JSON.parse(readFileSync(new URL(`../src/data/chapters/b1c${number}.json`, import.meta.url), 'utf8')) as { titleFa: string }
    const entry = page.getByRole('button', { name: new RegExp(`^فصل ${faNum(number)}:`) })
    await expect(entry.getByText(chapterInfo.titleFa, { exact: true })).toBeVisible()
    if (number === 1) await expect(entry).toBeEnabled()
    else await expect(entry).toBeDisabled()
  }

  await page.keyboard.press('ArrowLeft')
  await expect(library).toBeFocused()
  await expect(library).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#home-panel-library')).toBeVisible()
  await expect(page.getByRole('button', { name: 'واژه‌نامه', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'تمرین آزاد با جعبهٔ لایتنر', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'صدای آفلاین', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'تنظیمات', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('offline audio manager is optional, book-scoped and progress-neutral', async ({ page }) => {
  await page.goto('/#/map')
  const saved = await page.evaluate(() => window.localStorage.getItem('ghesse:state:v6'))
  await openHomeSection(page, 'کتابخانه')
  await page.getByRole('button', { name: 'صدای آفلاین', exact: true }).click()

  await expect(page).toHaveURL(/#\/offline-audio$/)
  await expect(page.getByRole('heading', { level: 1, name: 'صدای آفلاین' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'چطور کار می‌کند؟' })).toBeVisible()
  await expect(page.getByText(/هیچ پیشرفت یا نمره‌ای تغییر نمی‌کند/)).toBeVisible()
  for (let book = 1; book <= 8; book++) {
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^کتاب ${faNum(book)}:`) })).toBeVisible()
  }
  const clear = page.getByRole('button', { name: 'پاک‌کردن همهٔ صداهای آفلاین' })
  await expect(clear).toBeVisible()

  // A long pack is explicitly cancellable; cache deletion stays disabled
  // until the in-flight workers have observed the abort.
  await page.getByRole('button', { name: 'ذخیره', exact: true }).first().click()
  const cancel = page.getByRole('button', { name: 'توقف دانلود', exact: true })
  await expect(cancel).toBeVisible()
  await expect(clear).toBeDisabled()
  await cancel.click()
  await expect(clear).toBeEnabled()

  expect(await page.evaluate(() => window.localStorage.getItem('ghesse:state:v6'))).toBe(saved)
  await expectNoHorizontalOverflow(page)
})

test('forced-colors mode preserves visible structure, selection and keyboard focus', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('/#/map')

  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)

  const today = page.getByRole('tab', { name: 'امروز', exact: true })
  await expect(today).toHaveAttribute('aria-selected', 'true')
  const selectedStyle = await today.evaluate(element => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, borderStyle: style.borderStyle }
  })
  expect(selectedStyle.outlineStyle).not.toBe('none')
  expect(selectedStyle.borderStyle).not.toBe('none')

  const action = page.locator('.next-action-card').getByRole('button').first()
  await action.focus()
  const focusStyle = await action.evaluate(element => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2)

  await openHomeSection(page, 'مسیر')
  await expect(page.locator('.book-banner')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('settings keeps advanced controls collapsed until requested', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(page.locator('.app-page')).toHaveCount(1)
  const sound = page.getByRole('switch', { name: 'صدا', exact: true })
  const translation = page.getByRole('switch', { name: 'ترجمه‌ی فارسی همیشه باز', exact: true })
  await expect(sound).toHaveAttribute('aria-checked', 'true')
  await expect(translation).toHaveAttribute('aria-checked', 'false')
  await sound.click()
  await expect(sound).toHaveAttribute('aria-checked', 'false')
  await sound.click()
  await expect(sound).toHaveAttribute('aria-checked', 'true')

  const voice = page.getByText('تنظیمات پیشرفتهٔ صدا', { exact: true })
  const privacy = page.getByText('حریم خصوصی', { exact: true })
  await expect(voice).toBeVisible()
  await expect(privacy).toBeVisible()
  const deviceVoice = page.getByRole('combobox', { name: 'صدای جایگزین دستگاه', exact: true })
  await expect(deviceVoice).toBeHidden()

  await voice.click()
  await expect(deviceVoice).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('prove-known is explicit, first-miss fail-closed, and falls back to teaching without progress', async ({ page }) => {
  await page.goto('/#/map')

  const diagnostic = page.getByRole('button', { name: /تعیین سطح اختیاری/ })
  await expect(diagnostic).toBeVisible()
  await diagnostic.click()
  await expect(page).toHaveURL(/#\/diagnostic\/b1c1$/)
  await expect(page.getByRole('heading', { level: 1, name: 'تعیین سطح این فصل' })).toBeVisible()
  await expect(page.getByText(/اولین اشتباه.*تعیین سطح تمام می‌شود/)).toBeVisible()

  await page.getByRole('button', { name: 'شروع تعیین سطح' }).click()
  const input = page.getByLabel('واژهٔ انگلیسی')
  await expect(input).toBeFocused()
  await input.fill('definitely-wrong')
  await input.press('Enter')

  await expect(page.getByRole('heading', { level: 2, name: 'این فصل بهتر است آموزش داده شود' })).toBeVisible()
  const storedBeforeTeaching = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}'))
  expect(storedBeforeTeaching.chapters?.b1c1).toBeUndefined()
  expect(Object.keys(storedBeforeTeaching.words ?? {})).toHaveLength(0)

  // The revealed miss cannot be harvested by backing out and retrying the same
  // deterministic diagnostic word by word.
  await page.getByRole('button', { name: 'بازگشت به نقشه' }).click()
  await expect(page).toHaveURL(/#\/map$/)
  await expect(page.getByRole('button', { name: /تعیین سطح اختیاری/ })).toHaveCount(0)
  await page.goto('/#/diagnostic/b1c1')
  await expect(page).toHaveURL(/#\/prep\/b1c1$/)
  await expect(page.getByTestId('teach-headword')).toHaveText(chapterWords[0].word)
})

test('future chapters cannot be opened through a direct prove-known URL', async ({ page }) => {
  await page.goto('/#/diagnostic/b1c2')
  await expect(page).toHaveURL(/#\/map$/)
  await expect(page.getByRole('heading', { level: 1, name: 'قصه' })).toBeVisible()
})

test('auto teach speaks word and context before advancing, then pauses on demand', async ({ page }) => {
  await page.goto('/#/prep/b1c1')

  await expect(page.getByTestId('teach-headword')).toHaveText(chapterWords[0].word)
  // Teaching and testing keep the word card as the only focus: no chapter art.
  await expect(page.locator('.lesson-chapter-art')).toHaveCount(0)
  await expect.poll(() => spokenWord(page)).toBe(chapterWords[0].word)

  const startAuto = page.getByRole('button', { name: 'شروع آموزش خودکار' })
  await expect(startAuto).toBeEnabled()
  await startAuto.click()
  await expect(page.getByRole('button', { name: 'توقف آموزش خودکار' })).toHaveAttribute('aria-pressed', 'true')

  await expect.poll(async () => (await speechHistory(page)).includes(chapterWords[0].ex)).toBe(true)
  await expect(page.getByTestId('teach-headword')).toHaveText(chapterWords[1].word, { timeout: 7_500 })
  await expect.poll(async () => (await speechHistory(page)).includes(chapterWords[1].word)).toBe(true)

  const history = await speechHistory(page)
  expect(history.indexOf(chapterWords[0].word)).toBeGreaterThanOrEqual(0)
  expect(history.indexOf(chapterWords[0].ex)).toBeGreaterThan(history.indexOf(chapterWords[0].word))
  expect(history.indexOf(chapterWords[1].word)).toBeGreaterThan(history.indexOf(chapterWords[0].ex))

  const stopAuto = page.getByRole('button', { name: 'توقف آموزش خودکار' })
  await stopAuto.click()
  await expect(page.getByRole('button', { name: 'شروع آموزش خودکار' })).toHaveAttribute('aria-pressed', 'false')

  await page.waitForTimeout(2_000)
  await expect(page.getByTestId('teach-headword')).toHaveText(chapterWords[1].word)
})

test('an autoplay refusal asks for one tap instead of reporting missing speech', async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __ghesseBlockSpeech?: boolean }).__ghesseBlockSpeech = true
  })
  await page.goto('/#/prep/b1c1')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('مرورگر پخش خودکار صدا را متوقف کرد')
  await expect(alert).not.toContainText('در دسترس نیست')

  // The learner's tap is the gesture the browser was waiting for.
  await page.evaluate(() => {
    (window as Window & { __ghesseBlockSpeech?: boolean }).__ghesseBlockSpeech = false
  })
  await page.getByRole('button', { name: 'پخش دوبارهٔ تلفظ واژه' }).click()
  await expect.poll(() => spokenWord(page)).toBe(chapterWords[0].word)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /واژهٔ بعدی/ })).toBeEnabled()
})

test('listening gate fails closed when no English audio path can start', async ({ page }) => {
  await page.goto('/#/map')

  await page.evaluate(({ chapterWordIds, teachIndex }) => {
    window.sessionStorage.setItem('ghesse:prep:v1:b1c1', JSON.stringify({
      version: 1,
      chapterId: 'b1c1',
      phase: 'listening',
      teachIndex,
      writtenQueue: [],
      writtenPassed: chapterWordIds,
      writtenMissed: [],
      listeningQueue: chapterWordIds,
      listeningPassed: [],
      listeningMissed: [],
      feedback: null,
      selected: '',
      typed: '',
      updatedAt: Date.now(),
    }))
  }, {
    chapterWordIds: chapter.new,
    teachIndex: chapter.new.length - 1,
  })

  await page.evaluate(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: undefined,
      configurable: true,
    })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: undefined,
      configurable: true,
    })
    window.location.hash = '/prep/b1c1'
  })

  await expect(page.getByText('شنیداری · ۱۰۰٪')).toBeVisible()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('پخش تلفظ انگلیسی روی این دستگاه در دسترس نیست')
  await expect(alert).toContainText('تا یک پخش موفق، گزینه‌های آزمون شنیداری غیرفعال می‌مانند')

  const options = page.getByTestId('listening-options').getByRole('button')
  await expect(options).toHaveCount(4)
  for (let index = 0; index < 4; index++) {
    await expect(options.nth(index)).toBeDisabled()
  }

  await expect(page.getByRole('button', { name: 'نمی‌دانم — نشان بده و دوباره بپرس' })).toBeDisabled()
  await expect(page).toHaveURL(/#\/prep\/b1c1$/)
  await expectNoHorizontalOverflow(page)
})

test('a missed listening word replays by itself when it comes straight back', async ({ page }) => {
  const last = chapterWords[0]
  await page.goto('/#/map')
  await page.evaluate(({ chapterWordIds, lastId, teachIndex }) => {
    window.sessionStorage.setItem('ghesse:prep:v1:b1c1', JSON.stringify({
      version: 1,
      chapterId: 'b1c1',
      phase: 'listening',
      teachIndex,
      writtenQueue: [],
      writtenPassed: chapterWordIds,
      writtenMissed: [],
      listeningQueue: [lastId],
      listeningPassed: chapterWordIds.filter(id => id !== lastId),
      listeningMissed: [],
      feedback: null,
      selected: '',
      typed: '',
      updatedAt: Date.now(),
    }))
    window.location.hash = '/prep/b1c1'
  }, {
    chapterWordIds: chapter.new,
    lastId: last.id,
    teachIndex: chapter.new.length - 1,
  })

  const options = page.getByTestId('listening-options').getByRole('button')
  await expect(options.first()).toBeEnabled()
  expect(await speechHistory(page)).toEqual([last.word])

  await page.getByRole('button', { name: 'نمی‌دانم — نشان بده و دوباره بپرس' }).click()
  await page.getByRole('button', { name: 'ادامه و تکرار این واژه ←' }).click()

  // The only word left is the one just missed: it must play again without a
  // manual replay, or its answers would stay locked.
  await expect.poll(() => speechHistory(page)).toEqual([last.word, last.word])
  await expect(options.first()).toBeEnabled()
  await page.getByTestId('listening-options').getByRole('button', { name: last.fa, exact: true }).click()
  await expect(page).toHaveURL(/#\/read\/b1c1$/)
})

async function openWithProgress(page: Page, route: string, progress: {
  words?: Record<string, Record<string, unknown>>
  chapters?: Record<string, Record<string, unknown>>
  exams?: Record<string, Record<string, unknown>>
  exploreAll?: boolean
  leitner?: Record<string, unknown>
  activity?: Record<string, number>
}): Promise<void> {
  await page.addInitScript(({ progress }) => {
    // Seed before React mounts. Writing after page.goto races the initial
    // persistence effect on WebKit; reloads must retain subsequent changes.
    if (window.sessionStorage.getItem('ghesse:e2e:progress-seeded')) return
    const now = Date.now()
    window.localStorage.setItem('ghesse:state:v6', JSON.stringify({
      version: 6,
      currentChapter: 'b1c1',
      chapters: progress.chapters ?? {},
      exams: progress.exams ?? {},
      words: progress.words ?? {},
      soundOn: true,
      showFaDefault: false,
      narratorVoiceURI: '',
      narratorRate: 0.92,
      dailyReviewGoal: 15,
      exploreAll: progress.exploreAll === true,
      ...(progress.leitner ? { leitner: progress.leitner } : {}),
      ...(progress.activity ? { activity: progress.activity } : {}),
      created: now - 2 * 86_400_000,
    }))
    window.sessionStorage.setItem('ghesse:e2e:progress-seeded', 'true')
  }, { progress })
  await page.goto(`/#${route}`)
}

/** A word taught two days ago and recalled without help yesterday: consolidated, not due. */
function consolidatedWord(): Record<string, unknown> {
  const now = Date.now()
  return { introduced: true, firstSeenAt: now - 2 * 86_400_000, lastIndependentSuccessAt: now - 86_400_000, reviewStage: 1, reviewCorrect: 1, dueAt: now + 5 * 86_400_000 }
}

function dueWord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now()
  return { introduced: true, firstSeenAt: now - 2 * 86_400_000, reviewStage: 0, dueAt: now - 60_000, ...overrides }
}

test('smart review keeps the graded card on screen until the learner moves on', async ({ page }) => {
  const target = chapterWords[1]
  await openWithProgress(page, '/review', { words: { [target.id]: dueWord() } })

  // A first review is recognition: Persian prompt, English options.
  const prompt = page.getByTestId('review-prompt')
  await expect(prompt).toHaveText(target.fa)
  const correct = page.locator('.review-focus-card').getByRole('button', { name: target.word, exact: true })
  await correct.click()

  // Grading advances the word's stage (and therefore its next retrieval
  // mode), but the answered card must stay exactly as the learner saw it.
  await expect(page.locator('.feedback-panel')).toContainText('درست')
  await expect(prompt).toHaveText(target.fa)
  await expect(correct).toHaveClass(/answer-correct/)

  const next = page.getByRole('button', { name: 'کارت بعدی ←' })
  await expect(next).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'جلسه تمام شد' })).toBeVisible()
})

test('smart review speaks a spelling card on arrival and supports a keyboard-only answer', async ({ page }) => {
  const target = chapterWords[2]
  // Every skill but form is well covered, so the weakest channel is spelling.
  await openWithProgress(page, '/review', {
    words: {
      [target.id]: dueWord({
        reviewStage: 5,
        reviewCorrect: 15,
        skillStats: {
          meaning: { correct: 5, wrong: 0 },
          context: { correct: 5, wrong: 0 },
          production: { correct: 5, wrong: 0 },
          form: { correct: 0, wrong: 0 },
        },
      }),
    },
  })

  await expect(page.getByText('واژه را گوش کن؛ متن انگلیسی پنهان می‌ماند.')).toBeVisible()
  await expect.poll(() => spokenWord(page)).toBe(target.word)

  const input = page.getByLabel('آنچه شنیدی را به انگلیسی بنویس')
  await expect(input).toBeEnabled()
  await expect(input).toBeFocused()
  await page.keyboard.type(target.word)
  await page.keyboard.press('Enter')
  await expect(page.locator('.feedback-panel')).toContainText('درست')
  await expect(page.getByRole('button', { name: 'کارت بعدی ←' })).toBeFocused()
})

test('the optional Leitner box opens from Library, moves cards between boxes and keeps them after a reload', async ({ page }) => {
  await page.goto('/#/map')
  await openHomeSection(page, 'کتابخانه')
  const leitnerButton = page.getByRole('button', { name: 'تمرین آزاد با جعبهٔ لایتنر', exact: true })
  await expect(page.getByRole('button', { name: 'واژه‌نامه', exact: true })).toBeVisible()
  await expect(leitnerButton).toBeVisible()
  // Free practice remains discoverable beside the glossary, but it is no
  // longer a competing due system on the home screen.
  await expect(page.getByRole('button', { name: 'واژه‌نامه', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'تمرین آزاد با جعبهٔ لایتنر', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await leitnerButton.click()
  await expect(page).toHaveURL(/#\/flashcards$/)
  await expect(page.getByRole('heading', { level: 1, name: 'جعبهٔ لایتنر' })).toBeVisible()

  // Every course word is a card, and none has started yet.
  const total = faNum(vocabulary.length)
  await expect(page.getByText(`${total} کارت هنوز شروع نشده`)).toBeVisible()
  await expect(page.getByText(`۰ از ${total} کارت شروع شده`)).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  await expectNoHorizontalOverflow(page)

  await page.getByRole('button', { name: /شروع مرور \(۱۰ کارت\)/ }).click()
  const card = page.getByTestId('flashcard')
  const cardWord = card.locator('.flashcard-word')
  // New cards come in course order; the English side is heard at once.
  await expect(cardWord).toHaveText(chapterWords[0].word)
  await expect.poll(() => spokenWord(page)).toBe(chapterWords[0].word)
  await expect(page.getByText('کارت ۱ از ۱۰')).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  await expectNoHorizontalOverflow(page)

  // Space turns the card; the main grade then takes focus.
  const flipButton = page.getByRole('button', { name: 'نمایش پاسخ' })
  await expect(flipButton).toBeFocused()
  await page.keyboard.press('Space')
  await expect(card).toContainText(chapterWords[0].fa)
  const good = page.getByRole('button', { name: /^بلد بودم/ })
  await expect(good).toBeFocused()
  await expect(good).toContainText('۲ روز بعد')
  await page.keyboard.press('3')

  // A forgotten card comes back later in the same session.
  await expect(cardWord).toHaveText(chapterWords[1].word)
  await flipButton.click()
  await page.getByRole('button', { name: /^بلد نبودم/ }).click()

  const summary = page.getByTestId('flashcards-summary')
  let sawMissedAgain = false
  for (let steps = 0; ; steps++) {
    expect(steps).toBeLessThan(20)
    await expect(summary.or(flipButton)).toBeVisible()
    if (await summary.isVisible()) break
    if (await cardWord.textContent() === chapterWords[1].word) sawMissedAgain = true
    await page.keyboard.press('Space')
    await expect(good).toBeFocused()
    await page.keyboard.press('Space')
  }
  expect(sawMissedAgain).toBe(true)
  await expect(summary).toContainText('۱۰کارت مرورشده')
  await expect(summary).toContainText('۹۰٪به یاد آمده')
  await expect(summary).toContainText('۱به جعبهٔ ۱ برگشت')

  await page.getByTestId('flashcards-summary').getByRole('button', { name: 'بازگشت به جعبه‌ها' }).click()
  await expect(page.getByRole('button', { name: /^جعبهٔ ۲، هر ۲ روز: ۹ کارت$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^جعبهٔ ۱، هر روز: ۱ کارت$/ })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: /^جعبهٔ ۲، هر ۲ روز: ۹ کارت$/ })).toBeVisible()
  await page.getByRole('button', { name: /^جعبهٔ ۱، / }).click()
  const list = page.getByTestId('leitner-box-list')
  await expect(list.locator('.glossary-row')).toHaveCount(1)
  await expect(list.locator('.glossary-row')).toContainText(chapterWords[1].word)
  await expect(list.locator('.glossary-row')).toContainText('فردا')
  await expectNoHorizontalOverflow(page)
})

test('a due Leitner card shows on the map and can be answered by typing', async ({ page }) => {
  const target = chapterWords[3]
  const now = Date.now()
  await openWithProgress(page, '/map', {
    leitner: {
      cards: { [target.id]: { box: 3, dueAt: now - 86_400_000, addedAt: now - 5 * 86_400_000, reviews: 2, correct: 2, lapses: 0 } },
      settings: { direction: 'faEn', scope: 'all', newPerDay: 0, typed: true },
      days: {},
    },
  })
  await openHomeSection(page, 'کتابخانه')
  const leitnerButton = page.getByRole('button', { name: 'تمرین آزاد با جعبهٔ لایتنر' })
  // Free practice is intentionally subordinate to Smart Review: no competing
  // due badge appears on the journey home.
  await expect(leitnerButton.locator('.home-toolbar-badge')).toHaveCount(0)
  await leitnerButton.click()

  await page.getByRole('button', { name: /شروع مرور \(۱ کارت\)/ }).click()
  const card = page.getByTestId('flashcard')
  await expect(card.locator('.flashcard-meaning')).toHaveText(target.fa)
  await expect(card.locator('.flashcard-word')).toHaveCount(0)
  const answer = page.getByLabel('واژهٔ انگلیسی')
  await expect(answer).toBeFocused()
  await page.keyboard.type(` ${target.word.toUpperCase()} `)
  await page.keyboard.press('Enter')
  await expect(card).toContainText('درست است.')
  await expect(card.locator('.flashcard-word')).toHaveText(target.word)
  await expect.poll(() => spokenWord(page)).toBe(target.word)
  await expect(page.getByRole('button', { name: /^بلد نبودم/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^بلد بودم/ })).toContainText('۸ روز بعد')
  await page.keyboard.press('2')
  await expect(page.getByTestId('flashcards-summary')).toContainText('۱یک جعبه بالاتر رفت')

  await page.getByTestId('flashcards-summary').getByRole('button', { name: 'بازگشت به جعبه‌ها' }).click()
  await expect(page.getByRole('button', { name: /^جعبهٔ ۴، هر ۸ روز: ۱ کارت$/ })).toBeVisible()
  await page.getByRole('button', { name: 'بازگشت به نقشه' }).click()
  await openHomeSection(page, 'کتابخانه')
  await expect(page.getByRole('button', { name: 'تمرین آزاد با جعبهٔ لایتنر', exact: true }).locator('.home-toolbar-badge')).toHaveCount(0)
})

test('a finished book is consolidated in review, and today\'s answers fill the daily goal with a celebration', async ({ page }) => {
  const bookIds = new Set<string>()
  for (const id of ['b1c1', 'b1c2', 'b1c3', 'b1c4', 'b1c5']) {
    const fixture = JSON.parse(readFileSync(new URL(`../src/data/chapters/${id}.json`, import.meta.url), 'utf8')) as ChapterFixture
    for (const wordId of fixture.new) bookIds.add(wordId)
  }
  // Three words were taught two days ago and never recalled since.
  const pending = chapterWords.slice(0, 3)
  const now = Date.now()
  const words = Object.fromEntries([...bookIds].map(id => [id, consolidatedWord()]))
  for (const word of pending) words[word.id] = { introduced: true, firstSeenAt: now - 2 * 86_400_000, reviewStage: 0, dueAt: now + 5 * 86_400_000 }
  await openWithProgress(page, '/map', {
    chapters: Object.fromEntries(['b1c1', 'b1c2', 'b1c3', 'b1c4', 'b1c5'].map(id => [id, { preparedAt: 1, prepAttempts: 1, completed: true, completedAt: 2, checksCorrect: 10, checksTotal: 10, reads: 1 }])),
    words,
    activity: { [dayKey(now)]: 13 },
  })

  const next = page.locator('.next-action-card')
  await expect(next.getByRole('heading', { name: 'قدم بعدی: تثبیت واژه‌های کتاب ۱' })).toBeVisible()
  await expect(next.getByRole('progressbar', { name: 'واژه‌های ثابت‌شده' })).toHaveAttribute('aria-valuenow', String(bookIds.size - 3))
  await openHomeSection(page, 'مسیر')
  await expect(page.getByText(`پس از تثبیت دیرهنگام همهٔ واژه‌ها باز می‌شود: ${faNum(bookIds.size - 3)} از ${faNum(bookIds.size)} واژه`, { exact: false })).toBeVisible()
  await openHomeSection(page, 'امروز')
  const strip = page.getByTestId('today-strip')
  await expect(strip).toContainText('۲ پاسخ تا کامل‌شدن هدف امروز')
  await expect(strip).toContainText('۱۳ از ۱۵')
  await expect(strip.getByRole('img', { name: '۰ روز پیاپی' })).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  await expectNoHorizontalOverflow(page)

  await next.getByRole('button', { name: 'شروع مرور' }).click()
  await expect(page.getByText('تثبیت واژه‌های دیروز و پیش‌تر')).toBeVisible()
  for (let answered = 1; answered <= 3; answered++) {
    const prompt = (await page.getByTestId('review-prompt').innerText()).trim()
    const target = pending.find(word => word.fa === prompt)!
    await page.locator('.review-focus-card').getByRole('button', { name: target.word, exact: true }).click()
    await expect(page.locator('.feedback-panel')).toContainText('درست')
    // The fifteenth answer of the day completes the goal.
    if (answered === 2) {
      const celebration = page.getByTestId('goal-celebration')
      await expect(celebration).toContainText('هدف امروز کامل شد!')
      await expect(celebration).toContainText('اولین روز از روزهای پیاپی‌ات')
      await celebration.getByRole('button', { name: 'بستن' }).click()
      await expect(celebration).toHaveCount(0)
    }
    await page.getByRole('button', { name: 'کارت بعدی ←' }).click()
  }
  await expect(page.getByRole('heading', { name: 'جلسه تمام شد' })).toBeVisible()

  // A later-day recall of every word opens the book's test.
  await page.goto('/#/map')
  await expect(next.getByRole('heading', { name: 'قدم بعدی: آزمون پایان کتاب ۱' })).toBeVisible()
  await expect(strip).toContainText('هدف امروز کامل شد')
  await expect(strip.getByRole('img', { name: '۱ روز پیاپی' })).toBeVisible()
  await page.reload()
  await expect(strip).toContainText('۱۵ از ۱۵')
})

test('glossary search tolerates Arabic-layout Persian letters and keeps filtering compact', async ({ page }) => {
  await page.goto('/#/glossary')
  const search = page.getByLabel('جست‌وجو در واژه‌نامه')
  const filter = page.getByLabel('فیلتر سطح تسلط')
  await expect(filter).toBeVisible()
  await expect(page.locator('.strip-scroll')).toHaveCount(0)

  // Arabic kaf and yeh, as typed on an Arabic keyboard layout.
  await search.fill('كيك')
  await expect(page.locator('.glossary-row')).toHaveCount(1)
  await expect(page.locator('.glossary-row')).toContainText('cake')
  await search.fill('BOOK')
  await expect(page.locator('.glossary-row').first()).toContainText('book')

  await search.fill('کتاب')
  const first = page.locator('.glossary-row').first()
  await expect(first).toContainText('book')
  await expect(first.locator('.glossary-meaning')).toHaveText('کتاب')

  await search.fill('an')
  await expect(page.locator('.glossary-row').first()).toContainText('a, an')

  await filter.selectOption('mastered')
  await expectNoHorizontalOverflow(page)
})

test('Journey shows reviewed artwork only for reachable books and announces chapter status', async ({ page }) => {
  await page.goto('/#/map')
  await openHomeSection(page, 'مسیر')
  const bookArt = page.locator('.book-banner img')
  await expect(bookArt).toHaveCount(1)
  await expect(bookArt.first()).toBeVisible()
  await expect(bookArt.first()).toHaveAttribute('src', /art\/chapters\/b1c1\.avif$/)
  await expect(bookArt.first()).toHaveAttribute('loading', 'eager')
  await expect(page.locator('.future-book-row')).toHaveCount(7)
  await expect(page.getByLabel(/کتاب ۲: .+ — قفل/)).toBeVisible()
  await expect(page.getByRole('button', { name: /^فصل ۱: .+ — آموزش \+ آزمون واژه‌ها$/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: /^فصل ۲: .+ — قفل$/ }).first()).toBeDisabled()
})

test('opening and closing a story word gloss keeps the reading position', async ({ page }) => {
  const total = chapter.new.length
  await openWithProgress(page, '/read/b1c1', {
    words: Object.fromEntries(chapter.new.map(id => [id, { introduced: true }])),
    chapters: {
      b1c1: {
        preparedAt: 1,
        prepAttempts: 1,
        prepWrittenCorrect: total,
        prepWrittenTotal: total,
        prepListeningCorrect: total,
        prepListeningTotal: total,
        completed: false,
        checksCorrect: 0,
        checksTotal: 0,
        reads: 0,
      },
    },
  })

  // A word well down the story, so the page is scrolled when it is tapped.
  const word = page.locator('.story-line').last().locator('.tok-word').first()
  await word.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(0)
  await word.click()

  // The meaning must appear on screen at once, not at the bottom of the page.
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet).toBeInViewport({ ratio: 1 })
  await expect(sheet.getByRole('button', { name: 'بستن' })).toBeFocused()
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.scrollY)).toBe(before)

  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(word).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBe(before)
})

test('story sentences and words play the recorded natural voice', async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as Window & { __ghesseRecordedAudio?: boolean; __ghesseClips?: string[] }
    testWindow.__ghesseRecordedAudio = true
    testWindow.__ghesseClips = []
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      testWindow.__ghesseClips?.push(new URL(this.src).pathname)
      window.setTimeout(() => this.dispatchEvent(new Event('ended')), 20)
      return Promise.resolve()
    }
  })
  const total = chapter.new.length
  await openWithProgress(page, '/read/b1c1', {
    words: Object.fromEntries(chapter.new.map(id => [id, { introduced: true }])),
    chapters: {
      b1c1: {
        preparedAt: 1,
        prepAttempts: 1,
        prepWrittenCorrect: total,
        prepWrittenTotal: total,
        prepListeningCorrect: total,
        prepListeningTotal: total,
        completed: false,
        checksCorrect: 0,
        checksTotal: 0,
        reads: 0,
      },
    },
  })
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.endsWith('/audio/index.json')))
  const clips = () => page.evaluate(() => (window as Window & { __ghesseClips?: string[] }).__ghesseClips ?? [])

  await page.getByRole('button', { name: 'شنیدن جمله' }).first().click()
  await expect.poll(clips).toContain(`/audio/${clipId('s', chapter.sentences[0].en)}.mp3`)

  const word = page.locator('.story-line').first().locator('.tok-word').first()
  await word.click()
  const heading = await page.getByRole('dialog').evaluate(sheet => (
    document.getElementById(sheet.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() ?? ''
  ))
  const entry = wordBySurface.get(heading)
  expect(entry, `gloss heading ${heading} is a vocabulary word`).toBeDefined()
  await expect.poll(clips).toContain(`/audio/${clipId('w', entry?.word ?? '')}.mp3`)
  expect(await speechHistory(page)).toEqual([])
})

interface TextFixture {
  titleEn: string
  titleFa: string
  sentences: Array<{ en: string; fa: string }>
  questions: Array<{ q: string; options: string[]; answer: number }>
}

interface BookTestFixture {
  reading: TextFixture[]
  listening: TextFixture[]
}

async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText)
}

test('the end-of-book test uses a bounded cumulative vocabulary sample plus reading and listening', async ({ page }) => {
  test.setTimeout(240_000)
  const book1 = ['b1c1', 'b1c2', 'b1c3', 'b1c4', 'b1c5']
  const bookWords = new Map<string, VocabularyEntry>()
  for (const id of book1) {
    const fixture = JSON.parse(readFileSync(new URL(`../src/data/chapters/${id}.json`, import.meta.url), 'utf8')) as ChapterFixture
    for (const wordId of fixture.new) bookWords.set(wordById.get(wordId)!.word, wordById.get(wordId)!)
  }
  const content = JSON.parse(readFileSync(new URL('../src/data/bookTests/b1.json', import.meta.url), 'utf8')) as BookTestFixture
  const reading = content.reading[0]
  const listening = content.listening[0]

  await openWithProgress(page, '/map', {
    chapters: Object.fromEntries(book1.map(id => [id, { preparedAt: 1, prepAttempts: 1, completed: true, completedAt: 2, checksCorrect: 10, checksTotal: 10, reads: 1 }])),
    // Every book-1 word already recalled on a later day than it was taught.
    words: Object.fromEntries([...bookWords.values()].map(word => [word.id, consolidatedWord()])),
  })
  const futureBook2 = page.getByLabel(/کتاب ۲: .+ — قفل/)

  await expect(page.getByRole('heading', { name: 'قدم بعدی: آزمون پایان کتاب ۱' })).toBeVisible()
  // Future books stay compact inside Journey until the previous book gate is cleared.
  await openHomeSection(page, 'مسیر')
  await expect(futureBook2).toBeVisible()
  await expect(page.getByText('آزمون پایان کتاب ۲', { exact: true })).toHaveCount(0)
  await openHomeSection(page, 'امروز')
  await page.locator('.next-action-card').getByRole('button', { name: 'شروع آزمون' }).click()
  await expect(page).toHaveURL(/#\/exam\/book-1$/)
  await expect(page.getByRole('heading', { level: 1, name: 'آزمون پایان کتاب ۱' })).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'شروع آزمون' }).click()

  // 1. Typed translations: the bounded book-1 sample is split between the two
  // word sections; progress survives a reload.
  const fromFaDigits = (value: string) => Number(value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))))
  const counter = page.getByText(/^واژهٔ .+ از .+$/)
  const sectionSize = async () => fromFaDigits((await counter.innerText()).replace(/^.* از /, ''))
  const translationCount = await sectionSize()
  const answerTranslation = async () => {
    const surface = (await page.getByTestId('translation-headword').innerText()).trim()
    await page.getByLabel('معنی فارسی').fill(bookWords.get(surface)!.fa)
    await page.getByLabel('معنی فارسی').press('Enter')
  }
  for (let item = 1; item <= 3; item++) await answerTranslation()
  await expect(counter).toHaveText(`واژهٔ ۴ از ${faNum(translationCount)}`)
  await page.reload()
  await expect(page.getByText('پیشرفت این آزمون بازیابی شد؛ از همان‌جا ادامه می‌دهی.')).toBeVisible()
  await expect(counter).toHaveText(`واژهٔ ۴ از ${faNum(translationCount)}`)
  await expectRenderedAccessibilityContract(page)
  // A short break every 40 words.
  const passBreak = async (answered: number, total: number) => {
    if (answered % 40 !== 0 || answered >= total) return
    await expect(page.getByTestId('book-test-break')).toContainText(`${faNum(answered)} واژه از ${faNum(total)}`)
    await page.getByRole('button', { name: 'ادامه ←' }).click()
  }
  for (let item = 4; item <= translationCount; item++) {
    await answerTranslation()
    await passBreak(item, translationCount)
  }

  // 2. Listening words: options wait for the word to be heard.
  await expect(page.getByRole('heading', { level: 2, name: 'شنیدن واژه‌ها' })).toBeVisible()
  const listeningCount = await sectionSize()
  expect(translationCount + listeningCount).toBe(24)
  const listeningOptions = page.getByTestId('book-test-listening-options').getByRole('button')
  for (let item = 1; item <= listeningCount; item++) {
    await expect(page.getByText(`واژهٔ ${faNum(item)} از ${faNum(listeningCount)}`)).toBeVisible()
    await expect(listeningOptions.first()).toBeEnabled()
    const heard = bookWords.get(await spokenWord(page))!
    await page.getByTestId('book-test-listening-options').getByRole('button', { name: heard.fa, exact: true }).click()
    await passBreak(item, listeningCount)
  }

  // 3. Reading: the text is on screen with its five questions.
  await expect(page.getByRole('heading', { level: 3, name: reading.titleEn })).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  await expectNoHorizontalOverflow(page)
  const answerQuestions = async (questions: BookTestFixture['reading'][number]['questions']) => {
    for (const [index, question] of questions.entries()) {
      await page.getByRole('group', { name: `${index + 1}. ${question.q}` })
        .getByRole('button', { name: question.options[question.answer], exact: true })
        .click()
    }
  }
  await answerQuestions(reading.questions)
  await page.getByRole('button', { name: 'ثبت و رفتن به بخش شنیداری ←' }).click()

  // 4. Listening: only audio. The text is never in the page during the test.
  await expect(page.getByRole('heading', { level: 2, name: 'درک مطلب شنیداری' })).toBeVisible()
  for (const sentence of listening.sentences) expect(await pageText(page)).not.toContain(sentence.en)
  expect(await page.content()).not.toContain(listening.titleEn)
  const firstAnswer = page.getByRole('group', { name: `1. ${listening.questions[0].q}` }).getByRole('button').first()
  await expect(firstAnswer).toBeDisabled()
  await page.getByRole('button', { name: 'پخش متن' }).click()
  await expect(page.getByText('متن را کامل شنیدی؛ حالا به سؤال‌ها پاسخ بده.')).toBeVisible()
  expect((await speechHistory(page)).slice(-listening.sentences.length)).toEqual(listening.sentences.map(sentence => sentence.en))
  await expect(firstAnswer).toBeEnabled()
  await expectRenderedAccessibilityContract(page)
  await answerQuestions(listening.questions)
  for (const sentence of listening.sentences) expect(await pageText(page)).not.toContain(sentence.en)
  await page.getByRole('button', { name: 'ثبت و پایان آزمون' }).click()

  // Review: scores per part, and the listening text is revealed on request.
  await expect(page.getByRole('heading', { level: 1, name: 'آزمون پایان کتاب را گذراندی' })).toBeVisible()
  await expect(page.getByText('هر ۲۴ واژه درست بود.')).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  await expectNoHorizontalOverflow(page)
  await expect(page.getByText(listening.sentences[0].en, { exact: true })).toBeHidden()
  await page.getByText(/^متن شنیداری: /).click()
  await expect(page.getByText(listening.sentences[0].en, { exact: true })).toBeVisible()
  await expect(page.getByText(listening.sentences[0].fa, { exact: true })).toBeVisible()

  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}').exams?.['book-1'])
  expect(stored).toMatchObject({ attempts: 1, passed: true, lastScore: 1, missedWordIds: [] })
  expect(stored.testedWordIds).toHaveLength(24)
  expect(await page.evaluate(() => window.localStorage.getItem('ghesse:book-test:v3:1'))).toBeNull()

  await page.getByRole('button', { name: 'ادامهٔ مسیر ←' }).click()
  await openHomeSection(page, 'مسیر')
  await expect(futureBook2).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^فصل ۱: .+ — آموزش \+ آزمون واژه‌ها$/ })).toBeEnabled()
})

test('the midpoint exam ends with two reading and two listening texts, all required', async ({ page }) => {
  const content = JSON.parse(readFileSync(new URL('../src/data/examTests/midpoint.json', import.meta.url), 'utf8')) as BookTestFixture
  const texts = [...content.reading.slice(0, 2), ...content.listening.slice(0, 2)]
  await openWithProgress(page, '/map', { exploreAll: true })
  // Set the route only once explore mode is loaded, or the map redirects it.
  await page.goto('/#/exam/midpoint-4')
  await page.reload()
  const saved = await page.evaluate(() => window.localStorage.getItem('ghesse:state:v6'))
  await expect(page.getByText('بازخورد در پایان آزمون می‌آید. حد عبور ۹۰٪ کل آزمون، ۸۸٪ یادآوری نوشتاری و ۹۰٪ درک مطلب است.', { exact: true })).toBeVisible()

  // Explore mode jumps past the word questions to the texts.
  await page.getByRole('button', { name: 'پرش به درک مطلب ←' }).click()
  const card = page.getByTestId('exam-text')
  const answer = async (text: TextFixture, choose: (question: TextFixture['questions'][number]) => number) => {
    for (const [index, question] of text.questions.entries()) {
      await card.getByRole('group', { name: `${index + 1}. ${question.q}` })
        .getByRole('button', { name: question.options[choose(question)], exact: true })
        .click()
    }
  }

  for (const [index, text] of texts.entries()) {
    await expect(page.getByText(`درک مطلب · متن ${faNum(index + 1)} از ۴`)).toBeVisible()
    const next = card.getByRole('button', { name: index === 3 ? 'ثبت و پایان آزمون' : 'ثبت و متن بعدی ←' })
    await expect(next).toBeDisabled()
    if (index < 2) {
      await expect(card.getByRole('heading', { level: 3, name: text.titleEn })).toBeVisible()
      await answer(text, question => question.answer)
    } else {
      // Heard only: the text is never on the page, and questions wait for it.
      for (const sentence of text.sentences) expect(await pageText(page)).not.toContain(sentence.en)
      expect(await page.content()).not.toContain(text.titleEn)
      await expect(card.getByRole('group').first().getByRole('button').first()).toBeDisabled()
      await card.getByRole('button', { name: 'پخش متن' }).click()
      await expect(card.getByText('متن را کامل شنیدی؛ حالا به سؤال‌ها پاسخ بده.')).toBeVisible()
      expect((await speechHistory(page)).slice(-text.sentences.length)).toEqual(text.sentences.map(sentence => sentence.en))
      // One wrong answer in the last text.
      await answer(text, question => index === 3 && question === text.questions[0] ? (question.answer + 1) % 4 : question.answer)
    }
    if (index === 0) {
      await expectRenderedAccessibilityContract(page)
      await expectNoHorizontalOverflow(page)
    }
    if (index === 2) {
      // The texts stage and its answers survive a reload.
      await page.reload()
      await expect(page.getByText('درک مطلب · متن ۳ از ۴')).toBeVisible()
      await expect(page.getByText('پیشرفت این آزمون بازیابی شد؛ از متن ۳ ادامه می‌دهی.')).toBeVisible()
      await expect(card.getByText('متن را کامل شنیدی؛ حالا به سؤال‌ها پاسخ بده.')).toBeVisible()
    }
    await expect(next).toBeEnabled()
    await next.click()
  }

  // Word questions were skipped, so this is unrecorded practice even though 19/20 comprehension clears the midpoint comprehension threshold.
  await expect(page.getByRole('heading', { level: 1, name: 'هنوز آمادهٔ عبور نیستی' })).toBeVisible()
  await expect(page.getByTestId('exam-comprehension-score')).toContainText('۱۹/۲۰')
  await expect(page.getByText(/حد عبور: ۹۰٪ کل آزمون، ۸۸٪ یادآوری نوشتاری، و ۹۰٪ درک مطلب/)).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  await expectNoHorizontalOverflow(page)
  const lastText = texts[3]
  await expect(page.getByText(lastText.sentences[0].en, { exact: true })).toBeHidden()
  await page.getByText(new RegExp(`^متن شنیداری ۲: ${lastText.titleFa}`)).click()
  await expect(page.getByText(lastText.sentences[0].en, { exact: true })).toBeVisible()
  await expect(page.getByText(`پاسخ درست: ${lastText.questions[0].options[lastText.questions[0].answer]}`)).toBeVisible()
  expect(await page.evaluate(() => window.localStorage.getItem('ghesse:state:v6'))).toBe(saved)

  // A new run brings the other two reading and two listening texts.
  await page.getByRole('button', { name: 'دوباره امتحان کن' }).click()
  await page.getByRole('button', { name: 'پرش به درک مطلب ←' }).click()
  await expect(card.getByRole('heading', { level: 3, name: content.reading[2].titleEn })).toBeVisible()
})

test('later end-of-book tests grow gradually: book 3 asks 32 vocabulary items and two texts of each kind', async ({ page }) => {
  const content = JSON.parse(readFileSync(new URL('../src/data/bookTests/b3.json', import.meta.url), 'utf8')) as BookTestFixture
  await openWithProgress(page, '/map', { exploreAll: true })
  await page.goto('/#/exam/book-3')
  await page.reload()
  await expect(page.getByText(/^۳۲ واژهٔ نمونه از کتاب‌های ۱ تا ۳/).first()).toBeVisible()
  await expect(page.getByText('درک مطلب خواندنی — ۲ متن تازه، هر کدام با ۵ سؤال.')).toBeVisible()
  await page.getByRole('button', { name: 'شروع آزمون' }).click()
  await page.getByRole('list', { name: 'بخش‌های آزمون' }).getByRole('button', { name: /درک مطلب خواندنی/ }).click()

  const answerText = async (text: TextFixture) => {
    for (const [index, question] of text.questions.entries()) {
      await page.getByRole('group', { name: `${index + 1}. ${question.q}` })
        .getByRole('button', { name: question.options[question.answer], exact: true })
        .click()
    }
  }
  await expect(page.getByText('متن ۱ از ۲', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: content.reading[0].titleEn })).toBeVisible()
  const next = page.getByRole('button', { name: 'ثبت و متن بعدی ←' })
  await expect(next).toBeDisabled()
  await answerText(content.reading[0])
  await next.click()
  await expect(page.getByText('متن ۲ از ۲', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: content.reading[1].titleEn })).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  await expectNoHorizontalOverflow(page)

  // The position within the section survives a reload.
  await page.reload()
  await expect(page.getByText('متن ۲ از ۲', { exact: true })).toBeVisible()
  await answerText(content.reading[1])
  await page.getByRole('button', { name: 'ثبت و رفتن به بخش شنیداری ←' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'درک مطلب شنیداری' })).toBeVisible()
  await expect(page.getByText('متن ۱ از ۲', { exact: true })).toBeVisible()
})

test('explore mode opens every chapter as an unrecorded preview and closes again', async ({ page }) => {
  const last = JSON.parse(
    readFileSync(new URL('../src/data/chapters/b8c6.json', import.meta.url), 'utf8'),
  ) as { n: number; titleFa: string }
  const lastNodeName = (status: string) => `فصل ${faNum(last.n)}: ${last.titleFa} — ${status}`

  await page.goto('/#/settings')
  const toggle = page.getByRole('switch', { name: 'حالت کاوش: باز کردن همهٔ فصل‌ها' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('button', { name: 'بازگشت به نقشه' }).click()
  await expect(page.getByText('حالت کاوش روشن است.')).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  await expect(page.locator('.future-book-row')).toHaveCount(0)
  await expect(page.locator('.book-banner')).toHaveCount(8)
  // Every book test is open too, as a preview.
  expect(await page.getByRole('button', { name: 'پیش‌نمایش', exact: true }).count()).toBeGreaterThanOrEqual(8)

  const saved = await page.evaluate(() => window.localStorage.getItem('ghesse:state:v6'))
  await page.getByRole('button', { name: lastNodeName('پیش‌نمایش در حالت کاوش') }).click()
  await expect(page).toHaveURL(/#\/read\/b8c6$/)
  await expect(page.getByText('پیش‌نمایش در حالت کاوش.')).toBeVisible()

  // Answering in a preview records nothing.
  await page.getByTestId('comprehension-options').getByRole('button').first().click()
  await expect(page.locator('.feedback-panel')).toBeVisible()
  expect(await page.evaluate(() => window.localStorage.getItem('ghesse:state:v6'))).toBe(saved)

  await page.getByRole('button', { name: 'واژه‌های این فصل' }).click()
  await expect(page).toHaveURL(/#\/prep\/b8c6$/)
  await expect(page.getByTestId('teach-headword')).toBeVisible()
  await expect(page.getByText('پیش‌نمایش در حالت کاوش.')).toBeVisible()

  await page.getByRole('button', { name: 'بازگشت به نقشه' }).click()
  await page.getByRole('button', { name: 'خاموش کردن' }).click()
  await expect(page.getByText('حالت کاوش روشن است.')).toHaveCount(0)
  await expect(page.locator('.future-book-row')).toHaveCount(7)
  await expect(page.getByRole('button', { name: lastNodeName('قفل') })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}').chapters)).toEqual({})
})

test('explore mode opens every step of the lessons, tests and review without prerequisites', async ({ page }) => {
  const open = async (route: string) => {
    await page.goto(`/#${route}`)
    await page.reload()
  }
  await openWithProgress(page, '/prep/b1c1', { exploreAll: true })
  const saved = await page.evaluate(() => window.localStorage.getItem('ghesse:state:v6'))

  // Lessons: each step of the chapter opens directly from the stepper.
  await expect(page.getByTestId('teach-headword')).toHaveText(chapterWords[0].word)
  const steps = page.getByRole('list', { name: 'مرحله‌های آمادگی' })
  await steps.getByRole('button', { name: /شنیداری/ }).click()
  await expect(page.getByTestId('listening-options')).toBeVisible()
  await steps.getByRole('button', { name: /ترجمهٔ نوشتاری/ }).click()
  await expect(page.getByTestId('written-headword')).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  await steps.getByRole('button', { name: /قصه/ }).click()
  await expect(page).toHaveURL(/#\/read\/b1c1$/)

  // Reading: any comprehension question opens directly.
  await page.getByRole('navigation', { name: 'پرش به سؤال‌ها' }).getByRole('button', { name: 'سؤال ۵' }).click()
  await expect(page.getByText('سؤال ۵ از ۱۰')).toBeVisible()
  await page.getByTestId('comprehension-options').getByRole('button').first().click()
  await expect(page.locator('.feedback-panel')).toBeVisible()
  await expectRenderedAccessibilityContract(page)
  // The out-of-order answer survives a reload instead of being asked again.
  await page.reload()
  await expect(page.getByText('سؤال ۵ از ۱۰')).toBeVisible()
  await expect(page.locator('.feedback-panel')).toBeVisible()
  // The listening part is open before the reading one is finished.
  const listeningPart = page.getByTestId('chapter-listening')
  await expect(listeningPart.getByText('در حالت کاوش این بخش پیش از پایان درک مطلب خواندنی هم باز است.')).toBeVisible()
  await listeningPart.getByRole('button', { name: 'پخش متن' }).click()
  await expect(listeningPart.getByText('متن را کامل شنیدی؛ حالا به سؤال‌ها پاسخ بده.')).toBeVisible()
  await listeningPart.getByRole('group').first().getByRole('button').first().click()

  // Book test: any section opens directly; skipping makes the run practice.
  await open('/exam/book-1')
  await page.getByRole('button', { name: 'شروع آزمون' }).click()
  await page.getByRole('list', { name: 'بخش‌های آزمون' }).getByRole('button', { name: /درک مطلب خواندنی/ }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'درک مطلب خواندنی' })).toBeVisible()
  await page.getByRole('group').first().getByRole('button').first().click()
  await expectRenderedAccessibilityContract(page)
  await page.reload()
  await expect(page.getByRole('heading', { level: 2, name: 'درک مطلب خواندنی' })).toBeVisible()
  await expect(page.getByText('پیشرفت این آزمون بازیابی شد؛ از همان‌جا ادامه می‌دهی.')).toBeVisible()

  // Midpoint exam: questions can be skipped and revisited.
  await open('/exam/midpoint-4')
  await expect(page.getByText(/^سؤال ۱ از /)).toBeVisible()
  await page.getByRole('button', { name: 'رد کردن ←' }).click()
  await expect(page.getByText(/^سؤال ۲ از /)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/^سؤال ۲ از /)).toBeVisible()
  await page.getByRole('button', { name: 'سؤال قبلی' }).click()
  await expect(page.getByText(/^سؤال ۱ از /)).toBeVisible()
  await page.getByRole('button', { name: 'پرش به درک مطلب ←' }).click()
  await expect(page.getByText('درک مطلب · متن ۱ از ۴')).toBeVisible()
  await page.getByRole('button', { name: 'رد کردن ←' }).click()
  await expect(page.getByText('درک مطلب · متن ۲ از ۴')).toBeVisible()
  await page.getByRole('button', { name: 'متن قبلی' }).click()
  await page.getByRole('button', { name: 'بازگشت به واژه‌ها' }).click()
  await expect(page.getByText(/^سؤال .+ از ۵۶$/)).toBeVisible()

  // Review: with nothing learned yet, explore offers a practice session.
  await open('/review')
  await expect(page.getByText('تمرین آزاد در حالت کاوش')).toBeVisible()
  await page.getByRole('button', { name: 'نمی‌دانم — پاسخ را نشان بده' }).click()
  await expect(page.locator('.feedback-panel')).toBeVisible()
  await expectRenderedAccessibilityContract(page)

  // None of it is recorded.
  expect(await page.evaluate(() => window.localStorage.getItem('ghesse:state:v6'))).toBe(saved)
})

test('exported progress is self-describing and integrity-verified before restore', async ({ page }) => {
  await openWithProgress(page, '/settings', { words: { [chapterWords[0].id]: dueWord() } })

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'دریافت پشتیبان' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^ghesse-progress-\d{4}-\d{2}-\d{2}\.json$/)
  const downloadedPath = await download.path()
  expect(downloadedPath).toBeTruthy()

  const raw = JSON.parse(readFileSync(downloadedPath!, 'utf8'))
  expect(raw.format).toBe('ghesse-progress-backup')
  expect(raw.schemaVersion).toBe(1)
  expect(raw.stateVersion).toBe(6)
  expect(raw.vocabularySha256).toMatch(/^[a-f0-9]{64}$/)
  expect(raw.integrity).toMatchObject({ algorithm: 'SHA-256' })
  expect(raw.integrity.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(raw.state.words?.[chapterWords[0].id]).toBeDefined()

  await page.getByLabel('فایل پشتیبان پیشرفت').setInputFiles(downloadedPath!)
  const confirm = page.getByRole('group', { name: 'جایگزینی پیشرفت؟' })
  await expect(confirm).toContainText('سلامت پشتیبان با SHA-256 تأیید شد.')
  await confirm.getByRole('button', { name: 'انصراف' }).click()
})

test('importing a backup asks before replacing progress', async ({ page }) => {
  await openWithProgress(page, '/settings', { words: { [chapterWords[0].id]: dueWord() } })
  await page.evaluate(() => window.sessionStorage.setItem('ghesse:prep:v1:b1c1', '{"stale":true}'))

  const backup = {
    version: 6,
    currentChapter: 'b1c2',
    chapters: { b1c1: { preparedAt: 1, prepAttempts: 1, completed: true, completedAt: 2, checksCorrect: 10, checksTotal: 10, reads: 1 } },
    words: Object.fromEntries(chapter.new.map(id => [id, { introduced: true }])),
    exams: {},
  }
  const file = { name: 'ghesse-progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) }
  const fileInput = page.getByLabel('فایل پشتیبان پیشرفت')
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}').words)).toHaveProperty(chapterWords[0].id)

  await fileInput.setInputFiles(file)
  const confirm = page.getByRole('group', { name: 'جایگزینی پیشرفت؟' })
  await expect(confirm).toContainText(`۱ فصل تمام‌شده، ${faNum(chapter.new.length)} واژهٔ آموخته`)
  await expect(confirm).toContainText('۰ فصل تمام‌شده، ۱ واژهٔ آموخته')

  // Cancelling leaves progress untouched.
  await confirm.getByRole('button', { name: 'انصراف' }).click()
  await expect(confirm).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}').chapters)).toEqual({})

  await fileInput.setInputFiles(file)
  await page.getByRole('button', { name: 'جایگزین کن' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'قصه' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}').chapters.b1c1.completed)).toBe(true)
  expect(await page.evaluate(() => window.sessionStorage.getItem('ghesse:prep:v1:b1c1'))).toBeNull()
})

test('backup import rejects unrelated JSON before replacement confirmation', async ({ page }) => {
  await openWithProgress(page, '/settings', { words: { [chapterWords[0].id]: dueWord() } })

  const unrelated = {
    name: 'other-app-settings.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 6, theme: 'dark', preferences: { compact: true } })),
  }
  await page.getByLabel('فایل پشتیبان پیشرفت').setInputFiles(unrelated)

  await expect(page.getByText('این فایل پشتیبان معتبر قصه نیست.', { exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'جایگزینی پیشرفت؟' })).toHaveCount(0)

  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}'))
  expect(stored.words?.[chapterWords[0].id]).toBeDefined()
})


test('startup recovers a valid rolling backup when primary storage is parseable but structurally corrupt', async ({ page }) => {
  const backup = JSON.stringify({
    version: 6,
    dayEvidenceVersion: 1,
    currentChapter: 'b1c1',
    chapters: {
      b1c1: {
        preparedAt: 1,
        prepAttempts: 1,
        completed: true,
        completedAt: 2,
        lastReadAt: 2,
        checksCorrect: 10,
        checksTotal: 10,
        listeningCorrect: 5,
        listeningTotal: 5,
        reads: 1,
      },
    },
    words: {},
    exams: {},
    soundOn: true,
    showFaDefault: false,
    narratorVoiceURI: '',
    narratorRate: 0.92,
    dailyReviewGoal: 15,
    exploreAll: false,
    activity: {},
    created: 1,
  })

  await page.addInitScript(({ backup }) => {
    window.localStorage.setItem('ghesse:state:v6', '{}')
    window.localStorage.setItem('ghesse:state:v6:backup', backup)
  }, { backup })

  await page.goto('/#/map')
  await expect(page.getByRole('heading', { level: 1, name: 'قصه' })).toBeVisible()

  const stored = await page.evaluate(() => ({
    primary: JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}'),
    backup: window.localStorage.getItem('ghesse:state:v6:backup'),
  }))
  expect(stored.primary.chapters?.b1c1?.completed).toBe(true)
  expect(stored.backup).toBe(backup)
  await expect(page.getByText('ذخیره‌سازی مرورگر در دسترس نیست')).toHaveCount(0)
})


test('malformed encoded routes recover to the map instead of crashing', async ({ page }) => {
  await page.goto('/#/read/%E0%A4%A')
  await expect(page).toHaveURL(/#\/map$/)
  await expect(page.getByRole('heading', { level: 1, name: 'قصه' })).toBeVisible()
  await expect(page.locator('#main-content')).toBeVisible()
})

test('a stale tab save preserves unrelated progress written after its render', async ({ page }) => {
  await openWithProgress(page, '/settings', {})

  const remoteWordId = chapterWords[0].id
  await page.evaluate(({ remoteWordId }) => {
    const state = JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}')
    state.words[remoteWordId] = {
      introduced: true,
      taps: 0,
      checkCorrect: 0,
      checkWrong: 0,
      reviewStage: 0,
      reviewCorrect: 0,
      reviewWrong: 0,
      reviewStreak: 0,
      intervalDays: 0,
      productiveCorrect: 0,
      successDays: [],
      productiveSuccessDays: [],
      difficulty: 5,
      stabilityDays: 0,
      lapses: 0,
      retrievalMsTotal: 0,
      retrievalMsCount: 0,
      skillStats: {
        meaning: { correct: 0, wrong: 0 },
        context: { correct: 0, wrong: 0 },
        production: { correct: 0, wrong: 0 },
        form: { correct: 0, wrong: 0 },
      },
    }
    window.localStorage.setItem('ghesse:state:v6', JSON.stringify(state))
  }, { remoteWordId })

  await page.getByRole('group', { name: 'هدف روزانه' }).getByRole('button', { name: faNum(20), exact: true }).click()

  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}'))
  expect(stored.dailyReviewGoal).toBe(20)
  expect(stored.words?.[remoteWordId]?.introduced).toBe(true)
})

test('conflicting stale-tab settings are rejected instead of overwriting persisted state', async ({ page }) => {
  await openWithProgress(page, '/settings', {})

  await page.evaluate(() => {
    const state = JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}')
    state.dailyReviewGoal = 20
    window.localStorage.setItem('ghesse:state:v6', JSON.stringify(state))
  })

  await page.getByRole('group', { name: 'هدف روزانه' }).getByRole('button', { name: faNum(25), exact: true }).click()

  await expect(page.getByRole('alert')).toContainText('پیشرفت در برگهٔ دیگری هم‌زمان تغییر کرده بود')
  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}'))
  expect(stored.dailyReviewGoal).toBe(20)
})

test('a reset propagates across tabs and later settings saves cannot resurrect old progress', async ({ page, context }) => {
  await openWithProgress(page, '/settings', { words: { [chapterWords[0].id]: dueWord() } })

  const other = await context.newPage()
  await other.goto('/#/settings')
  await other.getByRole('button', { name: 'پاک کردن پیشرفت' }).click()
  await other.getByRole('group', { name: 'تأیید پاک کردن پیشرفت' }).getByRole('button', { name: 'بله، پاک کن' }).click()

  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}')
    return Object.keys(state.words ?? {}).length
  })).toBe(0)

  await page.getByRole('group', { name: 'هدف روزانه' }).getByRole('button', { name: faNum(20), exact: true }).click()
  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}'))
  expect(stored.words).toEqual({})
  expect(stored.dailyReviewGoal).toBe(20)
  await other.close()
})


test('an ordinary cross-tab settings save preserves this tab\'s active prep draft', async ({ page, context }) => {
  const wordIds = chapter.new
  const state = {
    version: 6,
    dayEvidenceVersion: 1,
    currentChapter: 'b1c1',
    chapters: {},
    words: {},
    exams: {},
    soundOn: true,
    showFaDefault: false,
    narratorVoiceURI: '',
    narratorRate: 0.92,
    dailyReviewGoal: 15,
    exploreAll: false,
    activity: {},
    created: Date.now() - 86_400_000,
  }
  const draft = {
    version: 1,
    chapterId: 'b1c1',
    phase: 'listening',
    teachIndex: wordIds.length - 1,
    writtenQueue: [],
    writtenPassed: wordIds,
    writtenMissed: [],
    listeningQueue: [wordIds[0]],
    listeningPassed: wordIds.slice(1),
    listeningMissed: [],
    feedback: null,
    selected: '',
    typed: '',
    updatedAt: Date.now(),
  }

  await page.addInitScript(({ state, draft }) => {
    window.localStorage.setItem('ghesse:state:v6', JSON.stringify(state))
    window.sessionStorage.setItem('ghesse:prep:v1:b1c1', JSON.stringify(draft))
  }, { state, draft })

  await page.goto('/#/prep/b1c1')
  await expect(page.getByText('شنیداری · ۱۰۰٪')).toBeVisible()

  const other = await context.newPage()
  await other.goto('/#/settings')
  await other.getByRole('group', { name: 'هدف روزانه' }).getByRole('button', { name: faNum(20), exact: true }).click()

  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}').dailyReviewGoal
  ))).toBe(20)
  await expect(page.getByText('شنیداری · ۱۰۰٪')).toBeVisible()
  const survivingDraft = await page.evaluate(() => window.sessionStorage.getItem('ghesse:prep:v1:b1c1'))
  expect(survivingDraft).not.toBeNull()
  expect(JSON.parse(survivingDraft!).phase).toBe('listening')

  await other.close()
})


test('the tab that replaces progress does not misclassify a later ordinary cross-tab save', async ({ page, context }) => {
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'پاک کردن پیشرفت' }).click()
  await page.getByRole('group', { name: 'تأیید پاک کردن پیشرفت' }).getByRole('button', { name: 'بله، پاک کن' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'قصه' })).toBeVisible()

  const wordIds = chapter.new
  const draft = {
    version: 1,
    chapterId: 'b1c1',
    phase: 'listening',
    teachIndex: wordIds.length - 1,
    writtenQueue: [],
    writtenPassed: wordIds,
    writtenMissed: [],
    listeningQueue: [wordIds[0]],
    listeningPassed: wordIds.slice(1),
    listeningMissed: [],
    feedback: null,
    selected: '',
    typed: '',
    updatedAt: Date.now(),
  }
  await page.evaluate(({ draft }) => {
    window.sessionStorage.setItem('ghesse:prep:v1:b1c1', JSON.stringify(draft))
  }, { draft })
  await openHomeSection(page, 'مسیر')
  await page.getByRole('button', { name: /^فصل ۱: .+ — آموزش \+ آزمون واژه‌ها$/ }).click()
  await expect(page).toHaveURL(/#\/prep\/b1c1$/)
  await expect(page.getByText('شنیداری · ۱۰۰٪')).toBeVisible()

  const other = await context.newPage()
  await other.goto('/#/settings')
  await other.getByRole('group', { name: 'هدف روزانه' }).getByRole('button', { name: faNum(20), exact: true }).click()

  await expect.poll(async () => page.evaluate(() => (
    JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}').dailyReviewGoal
  ))).toBe(20)
  await expect(page.getByText('شنیداری · ۱۰۰٪')).toBeVisible()
  const survivingDraft = await page.evaluate(() => window.sessionStorage.getItem('ghesse:prep:v1:b1c1'))
  expect(survivingDraft).not.toBeNull()
  expect(JSON.parse(survivingDraft!).phase).toBe('listening')

  await other.close()
})


test('a cross-tab reset invalidates this tab\'s active prep draft before it can restore progress', async ({ page, context }) => {
  const wordIds = chapter.new
  const backupState = {
    version: 6,
    dayEvidenceVersion: 1,
    currentChapter: 'b1c1',
    chapters: {},
    words: {},
    exams: {},
    soundOn: true,
    showFaDefault: false,
    narratorVoiceURI: '',
    narratorRate: 0.92,
    dailyReviewGoal: 15,
    exploreAll: false,
    activity: {},
    created: Date.now() - 86_400_000,
  }
  const draft = {
    version: 1,
    chapterId: 'b1c1',
    phase: 'listening',
    teachIndex: wordIds.length - 1,
    writtenQueue: [],
    writtenPassed: wordIds,
    writtenMissed: [],
    listeningQueue: [wordIds[0]],
    listeningPassed: wordIds.slice(1),
    listeningMissed: [],
    feedback: null,
    selected: '',
    typed: '',
    updatedAt: Date.now(),
  }

  await page.addInitScript(({ state, draft }) => {
    window.localStorage.setItem('ghesse:state:v6', JSON.stringify(state))
    window.sessionStorage.setItem('ghesse:prep:v1:b1c1', JSON.stringify(draft))
  }, { state: backupState, draft })

  await page.goto('/#/prep/b1c1')
  await expect(page.getByText('شنیداری · ۱۰۰٪')).toBeVisible()
  expect(await page.evaluate(() => window.sessionStorage.getItem('ghesse:prep:v1:b1c1'))).not.toBeNull()

  const other = await context.newPage()
  await other.goto('/#/settings')
  await other.getByRole('button', { name: 'پاک کردن پیشرفت' }).click()
  await other.getByRole('group', { name: 'تأیید پاک کردن پیشرفت' }).getByRole('button', { name: 'بله، پاک کن' }).click()

  // b1c1 remains a valid route after reset, so route validity alone cannot
  // protect us. The replacement signal must clear this tab's session draft and
  // remount prep at the first teaching card.
  await expect(page.getByTestId('teach-headword')).toHaveText(chapterWords[0].word)
  expect(await page.evaluate(() => window.sessionStorage.getItem('ghesse:prep:v1:b1c1'))).toBeNull()

  await other.close()
})


test('chapter 1 enforces teach → written 100% → listening 100% → story → 10 corrected questions → listening text', async ({ page }) => {
  // This is the full 72-word chapter flow. Written and listening gates intentionally
  // exercise the product's 650 ms feedback/auto-advance timing for every word, so the
  // default 120 s per-test budget is too small even when the app is behaving correctly.
  test.setTimeout(360_000)
  await page.goto('/#/read/b1c1')

  // Direct reading is impossible before both preparation gates pass.
  await expect(page).toHaveURL(/#\/prep\/b1c1$/)
  await expect(page.locator('.learning-focus-card').getByText(`واژهٔ ${faNum(1)} از ${faNum(chapterWords.length)}`, { exact: true })).toBeVisible()
  await expect(page.locator('.lesson-chapter-art')).toHaveCount(0)
  await expect.poll(() => spokenWord(page)).toBe(chapterWords[0].word)
  await expectNoHorizontalOverflow(page)

  const stage = page.locator('.learning-focus-card')
  await expect(stage.locator('.lexical-role-chip')).toHaveText(persianPartOfSpeech(chapterWords[0].pos))

  const exampleAudio = stage.getByRole('button', { name: 'شنیدن مثال' })
  await expect(exampleAudio).toBeVisible()
  await expect(exampleAudio).toBeEnabled()
  await exampleAudio.click()
  await expect.poll(() => spokenWord(page)).toBe(chapterWords[0].ex)

  // Pronunciation rehearsal is optional and privacy-first: no score, no
  // progress gate, and the learner sees the local-only recording contract
  // before any microphone request is made.
  const pronunciation = stage.getByRole('button', { name: 'تمرین تلفظ (اختیاری)' })
  await expect(pronunciation).toBeVisible()
  await expect(pronunciation).toBeEnabled()
  await pronunciation.click()
  await expect(stage.getByText('ضبط فقط در حافظهٔ همین صفحه می‌ماند', { exact: false })).toBeVisible()
  await expect(stage.getByText('هیچ امتیاز خودکاری به لهجه‌ات داده نمی‌شود', { exact: false })).toBeVisible()
  await pronunciation.click()

  // Open-ended transfer is optional and self-assessed: the learner writes a
  // genuinely new sentence, compares it with the model and may shadow the
  // complete model sentence. The free text never enters saved progress.
  const activeUse = stage.getByTestId('active-use-practice')
  await activeUse.getByText('کاربرد فعال در جمله (اختیاری)', { exact: true }).click()
  const sentence = `My private transfer sentence uses ${chapterWords[0].word} today.`
  const sentenceInput = activeUse.getByLabel(`یک جملهٔ انگلیسی با ${chapterWords[0].word}`)
  await sentenceInput.fill(sentence)
  await expect(activeUse).toContainText('واژهٔ هدف، با همین معنی یا یکی از شکل‌های صرفی طبیعی آن')
  await activeUse.getByRole('button', { name: 'مقایسه با نمونه' }).click()
  await expect(activeUse.locator('div.font-en').filter({ hasText: sentence })).toBeVisible()
  await expect(activeUse.locator('div.font-en').filter({ hasText: chapterWords[0].ex })).toBeVisible()
  const sentenceShadow = activeUse.getByRole('button', { name: 'تمرین گفتاری جمله (اختیاری)' })
  await expect(sentenceShadow).toBeEnabled()
  expect(await page.evaluate(text => window.localStorage.getItem('ghesse:state:v6')?.includes(text) ?? false, sentence)).toBe(false)

  // Teaching stays learner-paced. Prove the new backward control can revisit
  // a word and retrigger its automatic pronunciation without bypassing audio.
  const firstNext = stage.getByRole('button', { name: /واژهٔ بعدی/ })
  await firstNext.click()
  await expect(page.getByTestId('teach-headword')).toHaveText(chapterWords[1].word)
  await expect.poll(() => spokenWord(page)).toBe(chapterWords[1].word)
  const previous = stage.getByRole('button', { name: 'قبلی', exact: true })
  await expect(previous).toBeEnabled()
  await previous.click()
  await expect(page.getByTestId('teach-headword')).toHaveText(chapterWords[0].word)
  await expect.poll(() => spokenWord(page)).toBe(chapterWords[0].word)
  await expect(stage.locator('.lexical-role-chip')).toHaveText(persianPartOfSpeech(chapterWords[0].pos))

  // Teaching is exposure, not a guess-first quiz.
  for (let index = 0; index < chapterWords.length; index++) {
    await expect(page.getByTestId('teach-headword')).toHaveText(chapterWords[index].word)
    const label = index === chapterWords.length - 1
      ? /شروع آزمون ترجمهٔ نوشتاری/
      : /واژهٔ بعدی/
    const nextTeachingStep = stage.getByRole('button', { name: label })
    await expect(nextTeachingStep).toBeEnabled()
    await nextTeachingStep.click()
  }

  // Written gate: force one error to prove retry-until-correct behavior.
  const writtenInput = page.getByLabel('ترجمهٔ فارسی')
  await expect(writtenInput).toBeVisible()
  await writtenInput.fill('پاسخ اشتباه')
  await writtenInput.press('Enter')
  await expect(stage.locator('.feedback-panel')).toContainText('دوباره در همین آزمون')
  // The disabled answer field hands focus to the retry step, and the Enter
  // that submitted the answer must not also skip past the correction.
  await expect(stage.getByRole('button', { name: /ادامه و تکرار این واژه/ })).toBeFocused()
  await expect(stage.locator('.feedback-panel')).toContainText('دوباره در همین آزمون')
  await stage.getByRole('button', { name: /ادامه و تکرار این واژه/ }).click()

  // Pass one real answer without a separate Continue tap, then reload to prove browser-level session recovery.
  await answerCurrentWrittenWord(page)
  await expect.poll(() => page.evaluate(() => {
    const raw = window.sessionStorage.getItem('ghesse:prep:v1:b1c1')
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { writtenPassed?: string[] }
    return parsed.writtenPassed?.length ?? 0
  })).toBe(1)

  const expectedAfterReload = (await page.getByTestId('written-headword').innerText()).trim()
  await page.reload()
  await expect(page.getByText('پیشرفت این جلسه بازیابی شد؛ از همان‌جایی که رها کردی ادامه بده.')).toBeVisible()
  await expect(page.getByTestId('written-headword')).toHaveText(expectedAfterReload)

  // Finish the deterministic written queue without assuming chapter-order positions.
  for (let guard = 0; guard < chapterWords.length + 2; guard++) {
    if (await page.getByText('شنیداری · ۱۰۰٪').isVisible()) break
    await answerCurrentWrittenWord(page)
  }

  // Listening gate uses a separate stable order and remains disabled until
  // the spoken word reaches onend.
  await expect(page.getByText('شنیداری · ۱۰۰٪')).toBeVisible()

  const firstOptions = page.getByTestId('listening-options').getByRole('button')
  await expect(firstOptions.first()).toBeEnabled()
  const firstSpokenSurface = await spokenWord(page)
  const firstListeningWord = wordBySurface.get(firstSpokenSurface)
  if (!firstListeningWord) throw new Error(`Unknown first listening word: ${firstSpokenSurface}`)

  const firstOptionLabels = (await firstOptions.allTextContents()).map(label => label.trim())
  const wrongOptionIndex = firstOptionLabels.findIndex(label => label !== firstListeningWord.fa)
  expect(wrongOptionIndex).toBeGreaterThanOrEqual(0)
  await firstOptions.nth(wrongOptionIndex).click()
  await expect(stage.locator('.feedback-panel')).toContainText('دوباره در همین آزمون')
  await expect(stage.getByRole('button', { name: /ادامه و تکرار این واژه/ })).toBeFocused()
  await stage.getByRole('button', { name: /ادامه و تکرار این واژه/ }).click()

  for (let guard = 0; guard < chapterWords.length + 2; guard++) {
    if (/\/read\/b1c1$/.test(page.url())) break

    const options = page.getByTestId('listening-options').getByRole('button')
    await expect(options.first()).toBeEnabled()
    const spokenSurface = await spokenWord(page)
    const expected = wordBySurface.get(spokenSurface)
    if (!expected) throw new Error(`Unknown listening word in browser test: ${spokenSurface}`)
    await answerCurrentListeningWord(page, expected)
  }

  await expect(page).toHaveURL(/#\/read\/b1c1$/)

  // A stale/direct preparation URL must not replay teaching after both 100%
  // gates have been passed. The router should resolve straight back to reading.
  await page.goto('/#/prep/b1c1')
  await expect(page).toHaveURL(/#\/read\/b1c1$/)
  await expect(page.locator('.learning-focus-card').getByText('آموزش', { exact: true })).toHaveCount(0)

  await expect(page.locator('#main-content')).toBeFocused()
  await expect(page.locator('#main-content')).toHaveAttribute('aria-label', /خواندن داستان:/)
  await expect(page).toHaveTitle(/خواندن داستان: .* — قصه/)
  await expect(page.locator('.lesson-chapter-art')).toBeVisible()
  await expect(page.locator('.tok-new')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await expectTouchSafeStoryControls(page)
  await expectRenderedAccessibilityContract(page)

  const viewport = page.viewportSize()
  if (viewport && viewport.width >= 768) {
    const coverDisplay = await page.locator('.lesson-cover-card').evaluate(element => getComputedStyle(element).display)
    expect(coverDisplay).toBe('grid')
  }

  await expectNoHorizontalOverflow(page)

  // First-pass comprehension: deliberately miss authored question 1.
  const firstCorrectLabel = wordById.get(chapter.check[0].a)?.word
  if (!firstCorrectLabel) throw new Error('Missing first checkpoint answer label')

  for (let index = 0; index < 10; index++) {
    const options = page.getByTestId('comprehension-options').getByRole('button')
    await expect(options.first()).toBeVisible()

    if (index === 0) {
      const labels = (await options.allTextContents()).map(label => label.trim())
      const wrong = labels.findIndex(label => label !== firstCorrectLabel)
      expect(wrong).toBeGreaterThanOrEqual(0)
      await options.nth(wrong).click()
      await expect(page.locator('.question-card .feedback-panel')).toContainText('پاسخ درست')
      await expect(page.getByRole('button', { name: 'سؤال بعدی ←', exact: true })).toBeFocused()
    } else {
      await options.first().click()
      await expect(page.locator('.question-card .feedback-panel')).toBeVisible()
    }

    if (index < 9) {
      await page.getByRole('button', { name: 'سؤال بعدی ←', exact: true }).click()
    }
  }

  const correctionButton = page.getByRole('button', { name: /اصلاح .* پاسخ اشتباه/ })
  await expect(correctionButton).toBeVisible()
  await correctionButton.click()

  // Correction round: use the UI's own revealed answer, then retry only missed items.
  for (let guard = 0; guard < 10; guard++) {
    if (await page.getByTestId('chapter-listening').isVisible()) break

    const options = page.getByTestId('comprehension-options').getByRole('button')
    await options.first().click()
    const feedback = page.locator('.question-card .feedback-panel')
    await expect(feedback).toBeVisible()
    const feedbackText = (await feedback.innerText()).trim()

    if (feedbackText.startsWith('پاسخ درست:')) {
      const correctLabel = feedbackText.replace(/^پاسخ درست:\s*/, '').trim()
      await page.getByRole('button', { name: 'دوباره پاسخ بده', exact: true }).click()
      await page
        .getByTestId('comprehension-options')
        .getByRole('button', { name: correctLabel, exact: true })
        .click()
      await expect(page.locator('.question-card .feedback-panel')).toContainText('درست است')
    }

    const next = page.getByRole('button', { name: 'سؤال بعدی ←', exact: true })
    if (await next.isVisible()) await next.click()
  }

  // Listening comprehension: a new text about the chapter, only heard.
  const listening = JSON.parse(
    readFileSync(new URL('../src/data/chapterListening/b1c1.json', import.meta.url), 'utf8'),
  ) as TextFixture
  const section = page.getByTestId('chapter-listening')
  const finishChapter = page.getByRole('button', { name: /پایان فصل — درک مطلب خواندنی و شنیداری کامل شد/ })
  await expect(section.getByRole('heading', { level: 2, name: 'درک مطلب شنیداری' })).toBeVisible()
  await expect(section.getByRole('button', { name: 'پخش متن' })).toBeFocused()
  await expect(finishChapter).toHaveCount(0)
  for (const sentence of listening.sentences) expect(await pageText(page)).not.toContain(sentence.en)
  const group = (index: number) => section.getByRole('group', { name: `${index + 1}. ${listening.questions[index].q}` })
  const option = (index: number, choice: number) => group(index).getByRole('button', { name: listening.questions[index].options[choice], exact: true })
  await expect(group(0).getByRole('button').first()).toBeDisabled()
  await section.getByRole('button', { name: 'پخش متن' }).click()
  await expect(section.getByText('متن را کامل شنیدی؛ حالا به سؤال‌ها پاسخ بده.')).toBeVisible()
  expect((await speechHistory(page)).slice(-listening.sentences.length)).toEqual(listening.sentences.map(sentence => sentence.en))
  await expectRenderedAccessibilityContract(page)

  // Miss question 1 at the first check: only it opens again, without the answer.
  const wrongChoice = (listening.questions[0].answer + 1) % 4
  await option(0, wrongChoice).click()
  for (let index = 1; index < listening.questions.length; index++) await option(index, listening.questions[index].answer).click()
  await section.getByRole('button', { name: 'بررسی پاسخ‌ها' }).click()
  await expect(section.getByText(/۱ سؤال هنوز درست نشده است/)).toBeFocused()
  await expect(option(0, wrongChoice)).toBeDisabled()
  await expect(option(1, listening.questions[1].answer)).toBeDisabled()
  await expect(section.getByText('۴ از ۵ درست')).toBeVisible()
  await expect(finishChapter).toHaveCount(0)

  // The listening progress survives a reload.
  await page.reload()
  await expect(section.getByText('۴ از ۵ درست')).toBeVisible()
  await expect(option(0, wrongChoice)).toBeDisabled()
  await option(0, listening.questions[0].answer).click()
  await section.getByRole('button', { name: 'بررسی پاسخ‌ها' }).click()
  await expect(finishChapter).toBeFocused()
  await section.getByText('متن شنیداری و ترجمه‌اش').click()
  await expect(section.getByText(listening.sentences[0].en, { exact: true })).toBeVisible()
  await finishChapter.click()
  await expect(page.getByText('فصل تمام شد', { exact: true })).toBeVisible()
  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}').chapters?.b1c1)
  expect(stored).toMatchObject({ completed: true, checksTotal: 10, listeningCorrect: 4, listeningTotal: 5 })
  expect(await page.evaluate(() => window.sessionStorage.getItem('ghesse:chapter-listening:v1:b1c1'))).toBeNull()
})

test('dictionary columns stay aligned across different word and meaning lengths', async ({ page }) => {
  await page.goto('/#/glossary')
  const rows = page.locator('.glossary-row')
  await expect(rows.first()).toBeVisible()
  const positions = await rows.evaluateAll(elements => elements.slice(0, 30).map(element => {
    const word = element.querySelector('[dir="ltr"]')!
    const meaning = element.querySelector('.glossary-meaning')!
    const status = element.querySelector('.glossary-status')!
    return {
      wordLeft: word.getBoundingClientRect().left,
      wordRight: word.getBoundingClientRect().right,
      meaningLeft: meaning.getBoundingClientRect().left,
      meaningRight: meaning.getBoundingClientRect().right,
      statusLeft: status.getBoundingClientRect().left,
    }
  }))
  expect(positions).toHaveLength(30)
  for (const position of positions) {
    expect(position.wordLeft).toBeCloseTo(positions[0].wordLeft, 1)
    expect(position.meaningLeft).toBeCloseTo(positions[0].meaningLeft, 1)
    expect(position.wordRight).toBeLessThan(position.meaningLeft)
    expect(position.meaningRight).toBeLessThan(position.statusLeft)
  }
  await rows.first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const evidence = dialog.getByTestId('mastery-evidence')
  await expect(evidence).toContainText('چرا وضعیت این واژه «تازه» است؟')
  await evidence.getByText('چرا وضعیت این واژه «تازه» است؟', { exact: true }).click()
  await expect(evidence).toContainText('ابتدا این واژه را در فصل مربوط یاد بگیر.')

  const pronunciation = dialog.getByRole('button', { name: 'تمرین تلفظ (اختیاری)' })
  await expect(pronunciation).toBeVisible()
  await pronunciation.click()
  await expect(dialog.getByText('ضبط فقط در حافظهٔ همین صفحه می‌ماند', { exact: false })).toBeVisible()
  await pronunciation.click()

  const activeUse = dialog.getByTestId('active-use-practice')
  await expect(activeUse.getByText('کاربرد فعال در جمله (اختیاری)', { exact: true })).toBeVisible()
  await activeUse.getByText('کاربرد فعال در جمله (اختیاری)', { exact: true }).click()
  await activeUse.locator('textarea').fill('This is my own new sentence.')
  await activeUse.getByRole('button', { name: 'مقایسه با نمونه' }).click()
  await expect(activeUse.getByText('یک نمونهٔ طبیعی', { exact: true })).toBeVisible()

  const geometry = await dialog.evaluate(element => ({
    height: element.getBoundingClientRect().height,
    viewport: window.innerHeight,
    scrollable: element.scrollHeight > element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
  }))
  expect(geometry.height).toBeLessThanOrEqual(geometry.viewport - 8)
  expect(geometry.scrollable).toBe(true)
  expect(geometry.overflowY).toBe('auto')
  await expectNoHorizontalOverflow(page)
})

test('narrow phones and wide screens retain the same page canvas across routes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 960 })
    for (const route of ['map', 'glossary', 'flashcards', 'settings', 'prep/b1c1']) {
      await page.goto(`/#/${route}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const main = await page.getByRole('main').boundingBox()
      expect(main).not.toBeNull()
      expect(main!.width).toBe(Math.min(width, 960))
      expect(main!.x).toBe((width - Math.min(width, 960)) / 2)
      await expectNoHorizontalOverflow(page)
      if (route === 'settings') {
        const label = await page.getByText('صدا', { exact: true }).boundingBox()
        const control = await page.getByRole('switch', { name: 'صدا', exact: true }).boundingBox()
        expect(control!.width).toBeGreaterThanOrEqual(44)
        expect(control!.width).toBeLessThan(120)
        expect(control!.x + control!.width).toBeLessThan(label!.x)
      }
    }
  }
})
