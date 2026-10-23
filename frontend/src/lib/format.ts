import type { Money } from './types'

/** Each supported currency belongs to one country; amounts use that country's formatting (NFR-08). */
const CURRENCY_LOCALES: Record<string, string> = {
  USD: 'en-US',
  INR: 'en-IN',
  GBP: 'en-GB',
  EUR: 'de-DE',
  CAD: 'en-CA',
  AUD: 'en-AU',
}

const moneyFormats = new Map<string, Intl.NumberFormat>()

/** "5000.00" USD → "$5,000.00". Formatting only: the amount itself is never converted. */
export function formatMoney(money: Money | null | undefined): string {
  if (!money) return '—'
  let format = moneyFormats.get(money.currency)
  if (!format) {
    format = new Intl.NumberFormat(CURRENCY_LOCALES[money.currency], {
      style: 'currency',
      currency: money.currency,
      currencyDisplay: 'code',
    })
    moneyFormats.set(money.currency, format)
  }
  return format.format(Number(money.amount))
}

/** "2026-10" → "October 2026" */
export function formatMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(year, monthIndex - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

/** "2026-10-31" or an ISO timestamp → "31 Oct 2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Today in YYYY-MM-DD, local time. */
export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function currentMonth(): string {
  return today().slice(0, 7)
}
