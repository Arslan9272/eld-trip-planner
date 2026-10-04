// The API speaks naive home-terminal times; reading them as UTC keeps arithmetic free of local DST shifts.
const parse = (iso: string) => new Date(`${iso}Z`)

const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const longDayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })

export const minutesBetween = (a: string, b: string) => (parse(b).getTime() - parse(a).getTime()) / 60000

export const clock = (iso: string) => iso.slice(11, 16)

export const addMinutes = (iso: string, minutes: number) =>
  new Date(parse(iso).getTime() + minutes * 60000).toISOString().slice(0, 16)

export const dayLabel = (date: string) => dayFormat.format(parse(date.slice(0, 10) + 'T00:00'))

export const longDayLabel = (date: string) => longDayFormat.format(parse(date.slice(0, 10) + 'T00:00'))

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export const hours = (minutes: number) => String(Math.round((minutes / 60) * 100) / 100)

export const miles = (value: number) => Math.round(value).toLocaleString('en-US')

export const town = (name: string) => name.split(',')[0]

export function nextQuarterHour(now = new Date()) {
  const d = new Date(now)
  d.setSeconds(0, 0)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
