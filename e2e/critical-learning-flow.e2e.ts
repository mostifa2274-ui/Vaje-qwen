import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { persianPartOfSpeech } from '../src/engine/partOfSpeech'
import { faNum } from '../src/engine/format'
import { clipId } from '../src/engine/audioClips'
import { startOfflineOrigin } from './offlineOrigin'

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
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
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
    { route: '/#/settings', heading: 'تنظیمات' },
    { route: '/#/review', heading: 'مرور هوشمند' },
    { route: '/#/prep/b1c1', heading: /واژه‌های تازه:/ },
  ]

  for (const { route, heading } of routes) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expect(page.locator('#main-content')).toBeVisible()
    await expectRenderedAccessibilityContract(page)
    await expectNoHorizontalOverflow(page)
  }
})


test('locked future books and preparation steps keep readable text opacity', async ({ page }) => {
  await page.goto('/#/map')

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

    await origin.stop()
    // Negative control: an HTTP client without a worker cannot reach the app.
    await expect(context.request.get(`${origin.url}/index.html`, { timeout: 3_000 })).rejects.toThrow()
    const uncachedRouteArt = await page.evaluate(async () => {
      const response = await fetch('./art/chapters/b8c5.webp')
      return { ok: response.ok, type: response.headers.get('content-type') }
    })
    expect(uncachedRouteArt.ok).toBe(true)
    expect(uncachedRouteArt.type).toMatch(/^image\//)

    await page.getByRole('button', { name: 'واژه‌نامه' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'واژه‌نامه' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    // A cold navigation must also recover the shell after losing the origin.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'واژه‌نامه' })).toBeVisible()
  } finally {
    await origin.stop()
  }
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

test('journey home keeps a compact hierarchy without the old dashboard layer', async ({ page }) => {
  await page.goto('/#/map')

  await expect(page.locator('.home-summary > div')).toHaveCount(3)
  await expect(page.locator('.journey-overview')).toHaveCount(0)
  await expect(page.locator('.method-details')).not.toHaveAttribute('open', '')

  await expect(page.locator('.book-banner')).toHaveCount(1)
  await expect(page.locator('.future-book-row')).toHaveCount(7)
  const firstBannerHeight = await page.locator('.book-banner').first().evaluate(element => element.getBoundingClientRect().height)
  expect(firstBannerHeight).toBeLessThanOrEqual(170)
  await expectNoHorizontalOverflow(page)
})

test('settings keeps advanced controls collapsed until requested', async ({ page }) => {
  await page.goto('/#/settings')

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
  await page.getByRole('button', { name: `پخش تلفظ ${chapterWords[0].word}` }).click()
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
      created: now - 2 * 86_400_000,
    }))
    window.sessionStorage.setItem('ghesse:e2e:progress-seeded', 'true')
  }, { progress })
  await page.goto(`/#${route}`)
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
  await filter.selectOption('mastered')
  await expectNoHorizontalOverflow(page)
})

test('map shows reviewed artwork only for reachable books and announces chapter status', async ({ page }) => {
  await page.goto('/#/map')
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
  })
  const futureBook2 = page.getByLabel(/کتاب ۲: .+ — قفل/)

  await expect(page.getByRole('heading', { name: 'قدم بعدی: آزمون پایان کتاب ۱' })).toBeVisible()
  // Future books stay compact until the previous book gate is cleared.
  await expect(futureBook2).toBeVisible()
  await expect(page.getByText('آزمون پایان کتاب ۲', { exact: true })).toHaveCount(0)
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
  await expect(page.getByText('بازخورد در پایان آزمون می‌آید. حد عبور ۸۸٪ کل آزمون، ۸۵٪ یادآوری نوشتاری و ۸۸٪ درک مطلب است.', { exact: true })).toBeVisible()

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
  await expect(page.getByText(/حد عبور: ۸۸٪ کل آزمون، ۸۵٪ یادآوری نوشتاری، و ۸۸٪ درک مطلب/)).toBeVisible()
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
  await expect(page.getByRole('button', { name: lastNodeName('قفل') })).toBeDisabled()
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

  await page.getByRole('group', { name: 'هدف مرور روزانه' }).getByRole('button', { name: faNum(20), exact: true }).click()

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

  await page.getByRole('group', { name: 'هدف مرور روزانه' }).getByRole('button', { name: faNum(25), exact: true }).click()

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

  await page.getByRole('group', { name: 'هدف مرور روزانه' }).getByRole('button', { name: faNum(20), exact: true }).click()
  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ghesse:state:v6') ?? '{}'))
  expect(stored.words).toEqual({})
  expect(stored.dailyReviewGoal).toBe(20)
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
  await expect(page.locator('.learning-focus-card').getByText('آموزش', { exact: true })).toBeVisible()
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
  await expect(section.getByText('۴ / ۵ درست')).toBeVisible()
  await expect(finishChapter).toHaveCount(0)

  // The listening progress survives a reload.
  await page.reload()
  await expect(section.getByText('۴ / ۵ درست')).toBeVisible()
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
