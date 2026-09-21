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
]

const allEnglish = chapters.flatMap(c => c.sentences.map(s => s.en))
const allPersian = chapters.flatMap(c => c.sentences.map(s => s.fa))
for (const bad of forbiddenEnglish) {
  assert(!allEnglish.includes(bad), `editorial regression: ${bad}`)
}
assert(!allPersian.some(text => text.includes('برویمین')), 'editorial regression: Persian typo برویمین')

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

const byId = new Map(chapters.map(c => [c.id, c]))
const expectedChecks = {
  b3c1: [['look'], ['friday']],
  b3c3: [['look'], ['midnight']],
  b7c3: [['north'], ['dad']],
  b7c5: [['ocean'], ['home']],
  b8c2: [['leg'], ['story']],
  b8c3: [['hospital'], ['exercise']],
  b8c4: [['no-one'], ['write']],
  b8c5: [['star'], ['home']],
  b8c6: [['cat'], ['home']],
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
