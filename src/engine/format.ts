const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** Persian is the interface language, so every visible count uses Persian digits. */
export function faNum(value: number | string): string {
  return String(value).replace(/\d/g, digit => PERSIAN_DIGITS[+digit])
}

export function percent(value: number): string {
  return `${faNum(Math.round(value * 100))}٪`
}
