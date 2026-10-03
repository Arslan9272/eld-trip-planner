import { duration, miles, minutesBetween } from '../format'
import type { Plan, TripInput } from '../types'

const town = (name: string) => name.split(',')[0]

function elapsed(minutes: number) {
  if (minutes < 48 * 60) return duration(minutes)
  return `${Math.floor(minutes / 1440)} d ${Math.round((minutes % 1440) / 60)} h`
}

interface Props {
  plan: Plan
  input: TripInput
  onEdit: () => void
}

export function TripSummary({ plan, input, onEdit }: Props) {
  const { summary } = plan
  const stats = [
    [`${miles(summary.miles)} mi`, 'Distance'],
    [duration(summary.driving_minutes), 'Driving'],
    [elapsed(minutesBetween(summary.start, summary.end)), 'Start to drop-off done'],
    [`${summary.cycle_used_end} / 70 h`, 'Cycle used at the end'],
  ]

  return (
    <div className="flex flex-col gap-3.5 border-b border-[#DDE2DC] px-6 pt-[22px] pb-[18px]">
      <div className="flex items-center justify-between gap-3">
        <h1 tabIndex={-1} id="trip-title" className="text-[22px] leading-tight font-bold outline-none">
          {town(input.current.name)} to {town(input.dropoff.name)}
        </h1>
        <button
          type="button"
          onClick={onEdit}
          className="h-9 shrink-0 rounded-lg border-[1.5px] border-asphalt bg-white px-3.5 text-sm font-semibold hover:bg-concrete"
        >
          Edit trip
        </button>
      </div>
      <dl className="grid grid-cols-[76px_1fr] gap-y-1.5 text-[15px]">
        <dt className="text-muted">Start</dt>
        <dd className="font-semibold">{input.current.name}</dd>
        <dt className="text-muted">Pickup</dt>
        <dd className="font-semibold">{input.pickup.name}</dd>
        <dt className="text-muted">Drop-off</dt>
        <dd className="font-semibold">{input.dropoff.name}</dd>
      </dl>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 pt-1">
        {stats.map(([value, label]) => (
          <div key={label}>
            <div className="text-[26px] leading-tight font-bold tabular-nums">{value}</div>
            <div className="text-[13px] text-muted">{label}</div>
          </div>
        ))}
      </div>
      {summary.cycle_used_end > 70 && (
        <p className="text-[13px] leading-snug text-muted">
          The hours past 70 are loading or unloading after the last drive. The rules allow on-duty work past the limit,
          not driving.
        </p>
      )}
    </div>
  )
}
