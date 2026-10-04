import { clock, dayLabel, duration, miles, town } from '../format'
import type { SavedTrip } from '../savedTrips'

const savedAtFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

interface Props {
  trips: SavedTrip[]
  openId: string | null
  flashId: string | null
  onOpen: (trip: SavedTrip) => void
  onDelete: (id: string) => void
}

export function SavedTrips({ trips, openId, flashId, onOpen, onDelete }: Props) {
  if (!trips.length) return null
  return (
    <section id="saved-trips" aria-labelledby="saved-title" className="no-print scroll-mt-6 px-4 pt-12 pb-16 sm:px-6">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-[18px]">
        <div>
          <h2 id="saved-title" className="text-[28px] font-bold">
            Saved trips
          </h2>
          <p className="mt-1.5 text-[15px] text-muted">Kept in this browser. Open a trip to see its map, schedule and log sheets again.</p>
        </div>
        <div className="overflow-x-auto rounded-xl bg-white shadow-[0_1px_2px_rgba(31,36,39,0.12)]">
          <table className="w-full min-w-[720px] text-left text-[15px]">
            <thead className="border-b border-rule text-[13px] text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Trip</th>
                <th scope="col" className="px-3 py-3 font-semibold">Start</th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">Distance</th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">Driving</th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">Sheets</th>
                <th scope="col" className="px-3 py-3 font-semibold">Saved</th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => {
                const { input, plan } = trip
                const name = `${town(input.current.name)} to ${town(input.dropoff.name)}`
                return (
                  <tr key={trip.id} className={`border-b border-[#DDE2DC] last:border-0 ${trip.id === flashId ? 'row-saved' : ''}`}>
                    <td className="px-5 py-3">
                      <span className="block font-semibold">{name}</span>
                      <span className="block text-[13px] text-muted">
                        Pickup in {town(input.pickup.name)}
                        {trip.id === openId && ', open now'}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {dayLabel(plan.summary.start)}, {clock(plan.summary.start)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{miles(plan.summary.miles)} mi</td>
                    <td className="px-3 py-3 text-right tabular-nums">{duration(plan.summary.driving_minutes)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{plan.logs.length}</td>
                    <td className="px-3 py-3 text-muted tabular-nums">{savedAtFormat.format(new Date(trip.savedAt))}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onOpen(trip)}
                          aria-label={`Open ${name}`}
                          className="h-9 rounded-lg bg-guide px-3.5 text-sm font-semibold text-white hover:bg-guide-dark"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(trip.id)}
                          aria-label={`Delete ${name}`}
                          className="h-9 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-[#FBEDEC] hover:text-[#8C1D18]"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
