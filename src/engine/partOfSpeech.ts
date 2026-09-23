const RULES: Array<[RegExp, string]> = [
  [/indefinite article/gi, 'حرف تعریف نامعین'],
  [/definite article/gi, 'حرف تعریف معین'],
  [/infinitive marker/gi, 'نشانهٔ مصدر'],
  [/auxiliary\s+v\./gi, 'فعل کمکی'],
  [/modal\s+v\./gi, 'فعل وجهی'],
  [/\bprep\./gi, 'حرف اضافه'],
  [/\bpron\./gi, 'ضمیر'],
  [/\bconj\./gi, 'حرف ربط'],
  [/\bdet\./gi, 'تعیین‌گر'],
  [/\badj\./gi, 'صفت'],
  [/\badv\./gi, 'قید'],
  [/\bexclam\./gi, 'حرف ندا'],
  [/\bv\./gi, 'فعل'],
  [/\bn\./gi, 'اسم'],
  [/\bnumber\b/gi, 'عدد'],
]

export function persianPartOfSpeech(value: string): string {
  let translated = value.trim()
  for (const [pattern, replacement] of RULES) {
    translated = translated.replace(pattern, replacement)
  }

  return translated
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s*,\s*/g, '، ')
    .replace(/\s+/g, ' ')
    .trim()
}
