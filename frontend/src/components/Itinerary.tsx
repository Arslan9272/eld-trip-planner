import { useEffect, useRef } from 'react'
import { KIND, STATUS } from '../duty'
import { clock, dayLabel, duration, miles } from '../format'
import type { Plan } from '../types'
import { StatusGlyph } from './Icon'

interface Props {
  plan: Plan
  active: number | null
  onSelect: (index: number) => void
}

export function Itinerary({ plan, active, onSelect }: Props) {
  const activeRow = useRef<HTMLLIElement>(null)
  const last = plan.events[plan.events.length - 1]

  useEffect(() => {
    // Follow the replay only where the list scrolls on its own; on phones it would drag the page.
    if (window.matchMedia('(min-width: 1024px)').matches) activeRow.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <div className="pt-1 pb-4">
      {plan.logs.map((log, day) => {
        const rows = plan.events.map((event, index) => ({ event, index })).filter(({ event }) => event.start.startsWith(log.date))
        return (
          <section key={log.date} aria-labelledby={`day-${day}-title`} className={day ? 'mt-1.5 border-t border-[#DDE2DC]' : ''}>
            <div className="flex items-baseline justify-between px-6 pt-3.5 pb-2">
              <h2 id={`day-${day}-title`} className="text-[15px] font-bold">
                {dayLabel(log.date)}
              </h2>
              <span className="text-[13px] text-muted">
                {miles(log.miles)} mi, {duration(log.totals.driving)} driving
              </span>
            </div>
            <ol>
              {rows.map(({ event, index }) => {
                const driving = event.kind === 'drive'
                const current = index === active
                return (
                  <li key={index} ref={current ? activeRow : undefined}>
                    <button
                      type="button"
                      onClick={() => onSelect(index)}
                      aria-current={current || undefined}
                      className={`grid w-full grid-cols-[50px_26px_1fr_auto] items-center gap-x-2.5 px-6 text-left transition-colors hover:bg-[#EEF2EC] ${
                        driving ? 'py-1' : 'py-2'
                      } ${current ? 'bg-[#E3EAE1] hover:bg-[#E3EAE1]' : ''}`}
                    >
                      <span className={`tabular-nums ${driving ? 'text-sm text-muted' : 'font-semibold'}`}>{clock(event.start)}</span>
                      {driving ? (
                        <span className="h-[26px] w-1 justify-self-center rounded-sm" style={{ background: STATUS.driving.color }} />
                      ) : (
                        <StatusGlyph kind={event.kind} status={event.status} />
                      )}
                      {driving ? (
                        <span className={`text-sm ${current ? 'font-semibold' : 'text-muted'}`}>Drive {miles(event.miles)} mi</span>
                      ) : (
                        <span>
                          <span className="block font-semibold">{KIND[event.kind].label}</span>
                          <span className="block text-[13px] text-muted">{event.place}</span>
                        </span>
                      )}
                      <span className="text-sm text-muted tabular-nums">{duration(event.minutes)}</span>
                    </button>
                  </li>
                )
              })}
              {day === plan.logs.length - 1 && (
                <li className="grid grid-cols-[50px_26px_1fr_auto] items-center gap-x-2.5 px-6 py-2">
                  <span className="font-semibold tabular-nums">{clock(last.end)}</span>
                  <StatusGlyph kind="off" status="off" />
                  <span>
                    <span className="block font-semibold">Off duty</span>
                    <span className="block text-[13px] text-muted">{last.place}</span>
                  </span>
                </li>
              )}
              {!rows.length && day !== plan.logs.length - 1 && (
                <li className="px-6 py-2 text-sm text-muted">No duty changes, resting all day.</li>
              )}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
