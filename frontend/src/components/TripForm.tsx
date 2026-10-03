import { useState, type FormEvent } from 'react'
import { searchPlaces } from '../api'
import type { Place, TripInput } from '../types'
import { Icon } from './Icon'
import { PlaceInput, type PlaceField } from './PlaceInput'

export interface TripFormState {
  current: PlaceField
  pickup: PlaceField
  dropoff: PlaceField
  cycle: string
  start: string
}

const STOPS = [
  ['current', 'Current location'],
  ['pickup', 'Pickup'],
  ['dropoff', 'Drop-off'],
] as const

type StopKey = (typeof STOPS)[number][0]
type Errors = Partial<Record<StopKey | 'cycle' | 'start', string>>

async function resolvePlace(field: PlaceField): Promise<Place> {
  if (field.place) return field.place
  const text = field.text.trim()
  if (!text) throw new Error('Enter a city or address.')
  const matches = await searchPlaces(text).catch(() => {
    throw new Error('Place search is unavailable. Try again.')
  })
  if (!matches.length) throw new Error(`No US place matches "${text}".`)
  const { name, lat, lng } = matches[0]
  return { name, lat, lng }
}

interface Props {
  initial: TripFormState
  busy: boolean
  error: string
  onPlan: (input: TripInput, form: TripFormState) => void
}

export function TripForm({ initial, busy, error, onPlan }: Props) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [resolving, setResolving] = useState(false)
  const used = Number(form.cycle)
  const usedValid = form.cycle.trim() !== '' && used >= 0 && used <= 70
  const available = Math.round((70 - used) * 100) / 100
  const working = busy || resolving

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found: Errors = {}
    if (!usedValid) found.cycle = 'Enter between 0 and 70 hours.'
    if (!form.start) found.start = 'Pick a start date and time.'

    setResolving(true)
    const results = await Promise.allSettled(STOPS.map(([key]) => resolvePlace(form[key])))
    setResolving(false)

    // The planner counts in quarter hours and never rounds hours already worked down.
    const cycle = Math.ceil(used * 4) / 4
    const next = { ...form, cycle: usedValid ? String(cycle) : form.cycle }
    results.forEach((result, i) => {
      const key = STOPS[i][0]
      if (result.status === 'fulfilled') next[key] = { text: result.value.name, place: result.value }
      else found[key] = (result.reason as Error).message
    })
    setForm(next)
    setErrors(found)
    if (Object.keys(found).length) return

    onPlan(
      {
        current: next.current.place!,
        pickup: next.pickup.place!,
        dropoff: next.dropoff.place!,
        cycle_used: cycle,
        start: next.start,
      },
      next,
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[22px] px-7 pt-7 pb-8">
      <h1 className="text-[26px] leading-tight font-bold">Plan a trip</h1>

      <div className="flex flex-col gap-4">
        {STOPS.map(([key, label]) => (
          <PlaceInput
            key={key}
            label={label}
            field={form[key]}
            error={errors[key]}
            onChange={(field) => setForm({ ...form, [key]: field })}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <label htmlFor="cycle" className="text-[15px] font-semibold">
          Hours used in current cycle
        </label>
        <div className="flex items-center gap-2.5">
          <input
            id="cycle"
            type="number"
            inputMode="decimal"
            min={0}
            max={70}
            step={0.25}
            value={form.cycle}
            aria-invalid={!!errors.cycle}
            aria-describedby={errors.cycle ? 'cycle-error' : undefined}
            onChange={(e) => setForm({ ...form, cycle: e.target.value })}
            className={`h-11 w-[88px] rounded-lg border-[1.5px] px-3 text-lg font-bold tabular-nums ${errors.cycle ? 'border-alert' : 'border-[#9EA79F]'}`}
          />
          <span className="text-[15px] text-muted">of 70 h</span>
          {usedValid && (
            <span className={`ml-auto text-[15px] font-semibold tabular-nums ${available < 11 ? 'text-[#8A4B00]' : ''}`}>
              {available} h available
            </span>
          )}
        </div>
        <input
          type="range"
          min={0}
          max={70}
          step={0.25}
          value={usedValid ? used : 0}
          onChange={(e) => setForm({ ...form, cycle: e.target.value })}
          aria-label="Hours used in current cycle"
          className="cycle-range"
        />
        <div className="-mt-1 flex justify-between text-[11px] text-muted tabular-nums" aria-hidden="true">
          {[0, 10, 20, 30, 40, 50, 60, 70].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        {errors.cycle && (
          <p id="cycle-error" className="text-sm text-alert">
            {errors.cycle}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="start" className="text-[15px] font-semibold">
          Trip start, home terminal time
        </label>
        <input
          id="start"
          type="datetime-local"
          step={900}
          value={form.start}
          onChange={(e) => setForm({ ...form, start: e.target.value })}
          className={`h-11 rounded-lg border-[1.5px] px-3 text-base font-medium tabular-nums ${errors.start ? 'border-alert' : 'border-[#9EA79F]'}`}
        />
        {errors.start && <p className="text-sm text-alert">{errors.start}</p>}
      </div>

      <button
        type="submit"
        disabled={working}
        className="relative h-[52px] overflow-hidden rounded-lg bg-guide text-[17px] font-bold text-white transition-colors hover:bg-guide-dark disabled:bg-guide-dark"
      >
        {working ? 'Planning route' : 'Plan trip'}
        {working && <span className="progress-line" />}
      </button>

      {error && !Object.keys(errors).length && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FBEDEC] px-3.5 py-3 text-sm leading-snug text-[#8C1D18]">
          <span className="mt-px">
            <Icon name="alert" size={18} />
          </span>
          <span>{error}</span>
        </div>
      )}

      <p className="text-[13px] leading-normal text-muted">
        Plans follow FMCSA hours of service for a property-carrying driver: 11 hours driving in a 14-hour window, a
        30-minute break after 8 hours of driving, 10 hours off between shifts and a 70-hour / 8-day cycle. Fuel at least
        every 1,000 miles, 1 hour for pickup and for drop-off, 30-minute pre-trip inspection each shift.
      </p>
    </form>
  )
}
