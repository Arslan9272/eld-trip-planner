import { memo } from 'react'
import { dayLabel } from '../format'
import type { DayLog, SheetHeader } from '../types'
import { Icon } from './Icon'
import { LogSheet } from './LogSheet'

interface Props {
  logs: DayLog[]
  header: SheetHeader
  onHeaderChange: (header: SheetHeader) => void
}

export const DailyLogs = memo(function DailyLogs({ logs, header, onHeaderChange }: Props) {
  const range = logs.length > 1 ? `, ${dayLabel(logs[0].date)} to ${dayLabel(logs[logs.length - 1].date)}` : ''
  return (
    <section aria-labelledby="logs-title" className="logs px-4 pt-12 pb-16 sm:px-6">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-[640px]">
            <h2 id="logs-title" className="text-[28px] font-bold">
              Daily logs
            </h2>
            <p className="mt-1.5 text-[15px] text-muted">
              {logs.length} {logs.length === 1 ? 'sheet' : 'sheets'}
              {range}. Click a blank on a sheet to fill it in; carrier, addresses, truck and shipping details carry over
              to every day.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print flex h-11 items-center gap-2 rounded-lg border-[1.5px] border-asphalt bg-white px-[18px] text-[15px] font-semibold hover:bg-concrete"
          >
            <Icon name="print" size={18} />
            Print logs
          </button>
        </div>
        {logs.length > 1 && (
          <nav aria-label="Log days" className="no-print flex flex-wrap gap-2">
            {logs.map((log, i) => (
              <a
                key={log.date}
                href={`#sheet-${i + 1}`}
                className="rounded-lg border border-rule bg-white px-3.5 pt-2 pb-1.5 text-sm font-semibold hover:border-asphalt"
              >
                {dayLabel(log.date)}
              </a>
            ))}
          </nav>
        )}
        {logs.map((log, i) => (
          <article key={log.date} id={`sheet-${i + 1}`} className="sheet-page scroll-mt-6">
            <h3 className="mb-2.5 text-sm font-semibold text-muted">
              Day {i + 1} of {logs.length}, {dayLabel(log.date)}
            </h3>
            <LogSheet log={log} header={header} onHeaderChange={onHeaderChange} />
          </article>
        ))}
        <p className="no-print mt-7 text-xs text-muted">
          Routes from OSRM or OpenRouteService. Map tiles by OpenFreeMap, map data © OpenStreetMap contributors. Place search
          by Photon, town names from GeoNames.
        </p>
      </div>
    </section>
  )
})
