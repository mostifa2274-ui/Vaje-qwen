import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const chapterDir = join(root, 'src/data/chapters')
const chapters = readdirSync(chapterDir)
  .filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(readFileSync(join(chapterDir, name), 'utf8')))
  .sort((a, b) => a.book - b.book || a.n - b.n)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const forbiddenEnglish = [
  'It is Nino.',
  'It is a black morning.',
  'It is a black evening.',
  'Do you see any cat?',
  'What is your age?',
  'Where is he born?',
  'Life in the city is big.',
  'A minute is little.',
  'Nino is born in winter.',
  'A week ago, Nino is home.',
  'Yesterday is bad.',
  'Yesterday, Nino is not home.',
  'The bill is big.',
  'The price of the fish is big.',
  'Both cats are black.',
  'The feeling is sad.',
  'The internet is big.',
  'Welcome, the bread man says.',
  'The test is hard.',
  'It is your cat?',
  'The telephone does not call.',
  'The traffic is big.',
  'The room is two meters.',
  'The train is off.',
  'The fish man has a boat.',
  'Cats always come home.',
  'The vacation is little.',
  'Her hobby is stories.',
  'Do you like her hair? she says.',
  'A quick drive is fine.',
  'Fruit and vegetables are a good diet.',
  'Writers become writers from little books.',
  'Small stars work as hard as big ones.',
  'A negative girl sees nothing.',
  'A positive girl sees the road home.',
  'One page is free.',
  'Somebody little.',
  'She would know him in a thousand cats.',
  'The park is near.',
  'Nino follows the bird.',
  'Each cat has a home.',
  'Healthy people exercise.',
  'Cats know their homes.',
  'The family climbs the mountain.',
  'Their mother calls them for dinner.',
  'The plane is above.',
  'A thousand cats, and not one is Nino.',
  'Cats know their homes.',
  'A smart chicken can sometimes find his way home from far away.',
  // Mina searches with her family, not alone or with unrelated boys.
  'Mina goes to the street with Nino\'s picture in her hand.',
  'Some boys help her look behind the chairs.',
  'The boy says he can walk part of the road with Mina.',
  'The boy is Mina\'s friend from school.',
  'He takes Mina there because looking for Nino is very important.',
  'Her brother studies at college and sees the new note.',
  'Saturday begins the busy part of their weekend work to find Nino.',
  'The city has about a million people, which once made Mina feel small.',
]

const allEnglish = chapters.flatMap(c => c.sentences.map(s => s.en))
const allPersian = chapters.flatMap(c => c.sentences.map(s => s.fa))
for (const bad of forbiddenEnglish) {
  assert(!allEnglish.includes(bad), `editorial regression: ${bad}`)
}
assert(!allPersian.some(text => text.includes('برویمین')), 'editorial regression: Persian typo برویمین')

const chickenCanonRegressions = [
  /\bNino\b[^.]*\bfur\b/i,
  /\bNino\b[^.]*\bpurr/i,
  /\bNino\b[^.]*\bpaw/i,
  /\bNino\b[^.]*\bcollar\b/i,
  /\bchicken\b[^.]*\bfur\b/i,
  /\brubs? against (?:her|his) legs\b/i,
  /\bcurls? up in Mina's arms\b/i,
]
for (const pattern of chickenCanonRegressions) {
  const bad = allEnglish.find(text => pattern.test(text))
  assert(!bad, `chicken-canon regression: ${bad}`)
}

for (const chapter of chapters) {
  for (const sentence of chapter.sentences) {
    if (/(?:golden|yellow) chicken/i.test(sentence.en)) {
      assert(!sentence.fa.includes('سیاه'), `${chapter.id}: yellow/golden chicken cannot translate as black chicken`)
    }
  }
}

for (const chapter of chapters) {
  for (const [index, sentence] of chapter.sentences.entries()) {
    assert(sentence.en.trim().length > 0, `${chapter.id}:${index} empty English sentence`)
    assert(sentence.fa.trim().length > 0, `${chapter.id}:${index} empty Persian sentence`)
    const quotes = (sentence.en.match(/"/g) || []).length
    assert(quotes % 2 === 0, `${chapter.id}:${index} unbalanced English quotation marks`)
    // Direct questions/exclamations followed by a reporting clause must be quoted.
    assert(!/[!?]\s+(?:Mina|Mom|Dad|Grandmother|Grandfather|the man|the woman|the boy|the girl|the teacher|the doctor|the nurse|the farmer|the cousin|Aunt|Uncle|she|he)\s+(?:says|asks|answers|writes|thinks)\.$/.test(sentence.en),
      `${chapter.id}:${index} unquoted direct speech: ${sentence.en}`)
  }
}

// Direct speech needs quotation marks when the reporting clause follows it
// ("Let's go," Mom says.) or introduces it (Dad says, "Let's go.").
const speaker = String.raw`(?:Mina|Mom|Dad|Grandmother|Grandfather|Uncle|Aunt|the (?:man|woman|boy|girl|teacher|doctor|nurse|farmer|cousin|policeman|scientist|waiter|neighbor)|her (?:brother|aunt|cousin)|she|he)`
const trailingClause = new RegExp(String.raw`,\s+${speaker}\s+(?:says|asks|answers|adds|calls|explains|tells \w+)\.$`)
const leadingClause = /\b(?:says|asks|answers|adds|calls),\s+[A-Z]/
for (const chapter of chapters) {
  for (const [index, sentence] of chapter.sentences.entries()) {
    if (sentence.en.includes('"')) continue
    assert(!trailingClause.test(sentence.en) && !leadingClause.test(sentence.en),
      `${chapter.id}:${index} unquoted direct speech: ${sentence.en}`)
  }
}

// Family-friendly content for Iranian learners: no alcohol, dancing, dating or
// pork anywhere in the course, and Nino (a yellow chicken) is never "black".
const bookTestDir = join(root, 'src/data/bookTests')
const bookTexts = readdirSync(bookTestDir)
  .filter(name => name.endsWith('.json'))
  .flatMap(name => {
    const content = JSON.parse(readFileSync(join(bookTestDir, name), 'utf8'))
    return [...content.reading, ...content.listening]
  })
const vocabulary = JSON.parse(readFileSync(join(root, 'src/data/vocabulary.json'), 'utf8'))
const courseEnglish = [
  ...allEnglish,
  ...bookTexts.flatMap(text => [text.titleEn, ...text.sentences.map(sentence => sentence.en)]),
  ...vocabulary.flatMap(word => [word.word, word.ex]),
]
const unsuitable = /\b(?:wine|beer|alcohol|drunk|dances?|danced|dancing|dancers?|boyfriends?|girlfriends?|pigs?|pork|bacon)\b/i
for (const text of courseEnglish) {
  assert(!unsuitable.test(text), `unsuitable course content: ${text}`)
}
for (const text of allEnglish) {
  assert(!/\b(?:something|anything) black\b|\bwas it black\b|^"Black,"/i.test(text), `Nino is yellow, not black: ${text}`)
}
const persian = [...allPersian, ...bookTexts.flatMap(text => text.sentences.map(sentence => sentence.fa))]
assert(!persian.some(text => text.includes('ـ')), 'Persian text contains a tatweel (ـ)')

const byId = new Map(chapters.map(c => [c.id, c]))
const expectedChecks = {
  b3c1: [['look'], ['friday']],
  b3c3: [['chicken'], ['midnight']],
  b7c3: [['snow'], ['north']],
  b7c5: [['boat'], ['island']],
  b8c2: [['tooth'], ['spring']],
  b8c3: [['hospital'], ['ok']],
  b8c4: [['two'], ['hope']],
  b8c5: [['chicken'], ['home']],
  b8c6: [['woman'], ['home']],
}
for (const [id, expected] of Object.entries(expectedChecks)) {
  const chapter = byId.get(id)
  assert(chapter, `missing chapter ${id}`)
  assert(chapter.check.length === expected.length, `${id}: unexpected checkpoint count`)
  expected.forEach((answers, index) => {
    assert(answers.includes(chapter.check[index].a), `${id}: checkpoint ${index} has wrong answer ${chapter.check[index].a}`)
  })
}

console.log(`Editorial validation passed for ${chapters.length} chapters and ${allEnglish.length} English/Persian sentence pairs.`)
