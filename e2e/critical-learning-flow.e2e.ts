import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

interface VocabularyEntry {
  id: string
  word: string
  fa: string
}

interface ChapterFixture {
  id: string
  new: string[]
  check: Array<{ a: string }>
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

async function answerCurrentWrittenWord(page: Page): Promise<void> {
  const stage = page.locator('.learning-focus-card')
  const surface = (await page.getByTestId('written-headword').innerText()).trim()
  const entry = wordBySurface.get(surface)
  if (!entry) throw new Error(`Unknown written headword in browser test: ${surface}`)

  const input = page.getByLabel('ترجمهٔ فارسی')
  await input.fill(entry.fa)
  await input.press('Enter')
  await expect(stage.locator('.feedback-panel')).toContainText('درست')
  await stage.getByRole('button', { name: 'ادامه ←', exact: true }).click()
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
  await stage.getByRole('button', { name: 'ادامه ←', exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (window.name !== '__ghesse_e2e_initialized__') {
        window.localStorage.clear()
        window.sessionStorage.clear()
        window.name = '__ghesse_e2e_initialized__'
      }
    } catch {
      // The real app handles unavailable storage; this test starts from a clean origin.
    }

    class FakeSpeechSynthesisUtterance {
      text: string
      voice: unknown = null
      lang = ''
      rate = 1
      pitch = 1
      volume = 1
      onend: (() => void) | null = null
      onerror: (() => void) | null = null

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

    const testWindow = window as Window & { __ghesseSpoken?: string }
    testWindow.__ghesseSpoken = ''

    const synth = {
      cancel() {},
      getVoices() {
        return [voice]
      },
      speak(utterance: FakeSpeechSynthesisUtterance) {
        testWindow.__ghesseSpoken = utterance.text
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

test('chapter 1 enforces teach → written 100% → listening 100% → story → 10 corrected questions', async ({ page }) => {
  await page.goto('/#/read/b1c1')

  // Direct reading is impossible before both preparation gates pass.
  await expect(page).toHaveURL(/#\/prep\/b1c1$/)
  await expect(page.getByText('فقط یاد بگیر؛ این بخش آزمون نیست')).toBeVisible()
  await expect.poll(() => spokenWord(page)).toBe(chapterWords[0].word)
  await expectNoHorizontalOverflow(page)

  const stage = page.locator('.learning-focus-card')

  // Teaching is exposure, not a guess-first quiz.
  for (let index = 0; index < chapterWords.length; index++) {
    await expect(page.getByTestId('teach-headword')).toHaveText(chapterWords[index].word)
    const label = index === chapterWords.length - 1
      ? /شروع آزمون ترجمهٔ نوشتاری/
      : /واژهٔ بعدی/
    await stage.getByRole('button', { name: label }).click()
  }

  // Written gate: force one error to prove retry-until-correct behavior.
  const writtenInput = page.getByLabel('ترجمهٔ فارسی')
  await expect(writtenInput).toBeVisible()
  await writtenInput.fill('پاسخ اشتباه')
  await stage.getByRole('button', { name: 'ثبت پاسخ', exact: true }).click()
  await expect(stage.locator('.feedback-panel')).toContainText('دوباره در همین آزمون')
  await stage.getByRole('button', { name: /ادامه و تکرار این واژه/ }).click()

  // Pass one real answer, then reload to prove browser-level session recovery.
  await answerCurrentWrittenWord(page)
  await expect.poll(() => page.evaluate(() => {
    const raw = window.sessionStorage.getItem('ghesse:prep:v1:b1c1')
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { writtenPassed?: string[] }
    return parsed.writtenPassed?.length ?? 0
  })).toBe(1)

  const expectedAfterReload = chapterWords[2].word
  await page.reload()
  await expect(page.getByText('پیشرفت این جلسه بازیابی شد؛ از همان‌جایی که رها کردی ادامه بده.')).toBeVisible()
  await expect(page.getByTestId('written-headword')).toHaveText(expectedAfterReload)

  // Remaining queue = original words 3..N, then the deliberately missed first word.
  for (const expected of [...chapterWords.slice(2), chapterWords[0]]) {
    await expect(page.getByTestId('written-headword')).toHaveText(expected.word)
    await answerCurrentWrittenWord(page)
  }

  // Listening gate: answers remain disabled until the spoken word reaches onend.
  await expect(page.getByText('فقط گوش کن؛ همهٔ واژه‌ها باید درست شوند — ۱۰۰٪')).toBeVisible()
  await expect.poll(() => spokenWord(page)).toBe(chapterWords[0].word)

  const firstOptions = page.getByTestId('listening-options').getByRole('button')
  await expect(firstOptions.first()).toBeEnabled()
  const firstOptionLabels = (await firstOptions.allTextContents()).map(label => label.trim())
  const wrongOptionIndex = firstOptionLabels.findIndex(label => label !== chapterWords[0].fa)
  expect(wrongOptionIndex).toBeGreaterThanOrEqual(0)
  await firstOptions.nth(wrongOptionIndex).click()
  await expect(stage.locator('.feedback-panel')).toContainText('دوباره در همین آزمون')
  await stage.getByRole('button', { name: /ادامه و تکرار این واژه/ }).click()

  for (const expected of [...chapterWords.slice(1), chapterWords[0]]) {
    await answerCurrentListeningWord(page, expected)
  }

  await expect(page).toHaveURL(/#\/read\/b1c1$/)
  await expect(page.locator('svg.lesson-chapter-art[role="img"]')).toBeVisible()
  await expect(page.locator('.tok-new')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await expectTouchSafeStoryControls(page)

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
    const finish = page.getByRole('button', { name: /پایان فصل/ })
    if (await finish.isVisible()) break

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

  const finishChapter = page.getByRole('button', { name: /پایان فصل.*۱۰ از ۱۰ تأیید شد/ })
  await expect(finishChapter).toBeVisible()
  await finishChapter.click()
  await expect(page.getByText('فصل تمام شد', { exact: true })).toBeVisible()
})
