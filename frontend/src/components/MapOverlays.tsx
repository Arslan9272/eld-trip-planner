import { LEGEND_ORDER, STATUS } from '../duty'
import { addMinutes, clock, dayLabel, miles } from '../format'
import type { Plan } from '../types'
import { Icon } from './Icon'

const town = (name: string) => name.split(',')[0]

export function GuideSign({ plan }: { plan: Plan }) {
  const [toPickup, toDropoff] = plan.legs
  const rows = [
    [town(toPickup.to), toPickup.miles],
    [town(toDropoff.to), toPickup.miles + toDropoff.miles],
  ].filter(([, distance]) => Number(distance) >= 0.1) as [string, number][]
  if (!rows.length) return null
  return (
    <div className="absolute top-5 left-5 hidden rounded-[10px] bg-guide p-[5px] shadow-[0_2px_6px_rgba(31,36,39,0.3)] sm:block">
      <div className="grid grid-cols-[auto_auto] gap-x-11 rounded-[7px] border-2 border-white px-[18px] pt-2.5 pb-1.5 text-[23px] font-bold text-white tabular-nums">
        {rows.map(([name, distance]) => (
          <div key={name} className="contents">
            <span className="max-w-[16ch] truncate">{name}</span>
            <span className="text-right">{miles(distance)}</span>
          </div>
        ))}
      </div>
      <span className="sr-only">miles from the start</span>
    </div>
  )
}

export function Legend() {
  return (
    <div className="absolute right-3 bottom-9 hidden grid-cols-[14px_auto] items-center gap-x-2.5 gap-y-[7px] rounded-[10px] bg-white px-3.5 py-3 text-[13px] shadow-[0_1px_4px_rgba(31,36,39,0.25)] sm:grid">
      {LEGEND_ORDER.map((status) => (
        <div key={status} className="contents">
          <span className="size-3.5 rounded" style={{ background: STATUS[status].color }} />
          <span>{STATUS[status].label}</span>
        </div>
      ))}
    </div>
  )
}

interface ReplayProps {
  plan: Plan
  minute: number | null
  total: number
  travelled: number
  playing: boolean
  onToggle: () => void
  onSeek: (minute: number) => void
}

export function ReplayControl({ plan, minute, total, travelled, playing, onToggle, onSeek }: ReplayProps) {
  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? 'Pause replay' : 'Play replay'}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-asphalt text-white"
    >
      <Icon name={playing ? 'pause' : 'play'} />
    </button>
  )

  if (minute === null) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="absolute bottom-10 left-3 flex h-10 items-center gap-2 rounded-full bg-white pr-4 pl-3 text-sm font-semibold shadow-[0_1px_4px_rgba(31,36,39,0.3)] sm:bottom-5 sm:left-5"
      >
        <Icon name="play" />
        Replay trip
      </button>
    )
  }

  const at = addMinutes(plan.summary.start, minute)
  return (
    <div className="absolute right-3 bottom-10 left-3 flex items-center gap-3.5 rounded-[10px] bg-white py-2.5 pr-4 pl-2.5 shadow-[0_1px_4px_rgba(31,36,39,0.25)] sm:right-auto sm:bottom-5 sm:left-5 sm:w-[340px]">
      {button}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex justify-between gap-2 text-[13px] tabular-nums">
          <span className="font-bold">
            {dayLabel(at)}, {clock(at)}
          </span>
          <span className="text-muted">
            {miles(travelled)} of {miles(plan.summary.miles)} mi
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={total}
          step={15}
          value={minute}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Trip time"
          aria-valuetext={`${dayLabel(at)} ${clock(at)}`}
          className="replay-range"
        />
      </div>
    </div>
  )
}
