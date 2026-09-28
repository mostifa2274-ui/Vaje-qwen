import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const policy = JSON.parse(fs.readFileSync(path.join(root, 'src/data/learningPolicy.json'), 'utf8'))
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
const product = fs.readFileSync(path.join(root, 'PRODUCT.md'), 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function faNum(value) {
  return String(value).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
}

assert(policy.version === 1, 'learning policy version must be 1')
assert(policy.chapterPreparation.passRate === 1, 'chapter preparation remains a 100% coverage gate')
assert(policy.bookTest.sectionPassRate > 0 && policy.bookTest.sectionPassRate < 1, 'book-test section threshold must be a criterion rate')
assert(policy.bookTest.newestBookWeight > policy.bookTest.olderBookWeight, 'newest book must receive stronger sampling weight')

const sizes = Array.from({ length: 8 }, (_, index) =>
  Math.min(
    policy.bookTest.maxVocabularyQuestions,
    policy.bookTest.minVocabularyQuestions + index * policy.bookTest.vocabularyQuestionStep,
  ),
)
for (const size of sizes) assert(readme.includes(faNum(size)), `README is missing book-test vocabulary size ${size}`)
assert(readme.includes(`${faNum(Math.round(policy.bookTest.sectionPassRate * 100))}٪`), 'README book-test threshold does not match learningPolicy.json')
assert(readme.includes(`${faNum(Math.round(policy.midpointExam.passRate * 100))}٪`), 'README midpoint threshold does not match learningPolicy.json')
assert(readme.includes(`${faNum(Math.round(policy.midpointExam.productivePassRate * 100))}٪`), 'README midpoint productive threshold does not match learningPolicy.json')
assert(readme.includes(`${faNum(Math.round(policy.finalExam.passRate * 100))}٪`), 'README final threshold does not match learningPolicy.json')
assert(readme.includes(`${faNum(Math.round(policy.finalExam.productivePassRate * 100))}٪`), 'README final productive threshold does not match learningPolicy.json')

const asciiSizes = sizes.join(', ')
assert(product.includes(asciiSizes), 'PRODUCT.md end-of-book vocabulary sizes do not match learningPolicy.json')
assert(product.includes(`${Math.round(policy.bookTest.sectionPassRate * 100)}%`), 'PRODUCT.md book-test threshold does not match learningPolicy.json')
assert(product.includes(`${Math.round(policy.midpointExam.passRate * 100)}% overall / ${Math.round(policy.midpointExam.productivePassRate * 100)}% productive`), 'PRODUCT.md midpoint thresholds do not match learningPolicy.json')
assert(product.includes(`${Math.round(policy.finalExam.passRate * 100)}% overall / ${Math.round(policy.finalExam.productivePassRate * 100)}% productive`), 'PRODUCT.md final thresholds do not match learningPolicy.json')

console.log(`Learning policy validated: book-test vocabulary ${sizes.join('/')}; section ${policy.bookTest.sectionPassRate}; midpoint ${policy.midpointExam.passRate}/${policy.midpointExam.productivePassRate}; final ${policy.finalExam.passRate}/${policy.finalExam.productivePassRate}.`)
