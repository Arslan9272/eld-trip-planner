import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { planTrip } from './api'
import { DailyLogs } from './components/DailyLogs'
import { Icon } from './components/Icon'
import { Itinerary } from './components/Itinerary'
import { GuideSign, Legend, ReplayControl } from './components/MapOverlays'
import { RouteMap } from './components/RouteMap'
import { SavedTrips } from './components/SavedTrips'
import { TripForm, type TripFormState } from './components/TripForm'
import { TripSummary } from './components/TripSummary'
import { miles, minutesBetween, nextQuarterHour, town } from './format'
import { tripTimeline, useReplay } from './replay'
import { loadSavedTrips, storeSavedTrips, type SavedTrip } from './savedTrips'
import type { Place, Plan, SheetHeader, TripInput } from './types'

const HEADER_KEY = 'eld-sheet-header'
const EMPTY_HEADER: SheetHeader = { carrier: '', office: '', terminal: '', vehicles: '', manifest: '', shipper: '' }
const emptyStop = { text: '', place: null }

function loadHeader(): SheetHeader {
  try {
    return { ...EMPTY_HEADER, ...JSON.parse(localStorage.getItem(HEADER_KEY) ?? '{}') }
  } catch {
    return EMPTY_HEADER
  }
}

const blankForm = (): TripFormState => ({
  current: emptyStop,
  pickup: emptyStop,
  dropoff: emptyStop,
  cycle: '0',
  start: nextQuarterHour(),
})

function formFor(input: TripInput): TripFormState {
  const field = (place: Place) => ({ text: place.name, place })
  return {
    current: field(input.current),
    pickup: field(input.pickup),
    dropoff: field(input.dropoff),
    cycle: String(input.cycle_used),
    start: input.start,
  }
}

export default function App() {
  const [form, setForm] = useState(blankForm)
  const [input, setInput] = useState<TripInput | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [editing, setEditing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [header, setHeader] = useState(loadHeader)
  const [focus, setFocus] = useState<{ point: [number, number]; key: number } | null>(null)
  const [saved, setSaved] = useState(loadSavedTrips)
  const [openId, setOpenId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const timeline = useMemo(() => (plan ? tripTimeline(plan) : null), [plan])
  const replay = useReplay(timeline?.total ?? 0)
  const position = timeline && replay.minute !== null ? timeline.at(replay.minute) : null

  async function handlePlan(next: TripInput, nextForm: TripFormState) {
    setForm(nextForm)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await planTrip(next)
      replay.reset()
      setPlan(result)
      setInput(next)
      setOpenId(null)
      setEditing(false)
      requestAnimationFrame(() => document.getElementById('trip-title')?.focus())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function selectEvent(index: number) {
    if (!plan) return
    const event = plan.events[index]
    replay.pause()
    replay.seek(minutesBetween(plan.summary.start, event.start))
    setFocus({ point: [event.lat, event.lng], key: Date.now() })
  }

  const changeHeader = useCallback((next: SheetHeader) => {
    setHeader(next)
    try {
      localStorage.setItem(HEADER_KEY, JSON.stringify(next))
    } catch {
      // Private browsing can refuse storage; the sheet still works for this visit.
    }
  }, [])

  function show(trip: { plan: Plan | null; input: TripInput | null }) {
    replay.reset()
    setPlan(trip.plan)
    setInput(trip.input)
    setFocus(null)
    setError('')
    setEditing(!trip.plan)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function saveTrip() {
    if (!plan || !input) return
    const trip: SavedTrip = { id: openId ?? crypto.randomUUID(), savedAt: new Date().toISOString(), input, plan, header }
    try {
      setSaved(storeSavedTrips([trip, ...saved.filter((t) => t.id !== trip.id)]))
    } catch {
      setNotice('This browser has no room left to save trips. Delete an older trip and try again.')
      return
    }
    show({ plan: null, input: null })
    setForm(blankForm())
    setOpenId(null)
    setFlashId(trip.id)
    // Carrier and truck usually stay the same for the next trip; the load's paperwork does not.
    changeHeader({ ...header, manifest: '', shipper: '' })
    setNotice(`Saved ${town(input.current.name)} to ${town(input.dropoff.name)}. The planner is ready for the next trip.`)
  }

  function openTrip(trip: SavedTrip) {
    show(trip)
    setForm(formFor(trip.input))
    setOpenId(trip.id)
    setNotice('')
    changeHeader(trip.header)
  }

  function deleteTrip(id: string) {
    try {
      setSaved(storeSavedTrips(saved.filter((t) => t.id !== id)))
    } catch {
      return
    }
    if (id === openId) setOpenId(null)
  }

  // Printing files the trip away too: once the dialog closes, save it and clear the planner.
  // The ref keeps onPrint stable, so the memoised log sheets don't redraw on every replay frame.
  const saveLatest = useRef(saveTrip)
  useEffect(() => {
    saveLatest.current = saveTrip
  })
  const printAndSave = useCallback(() => {
    window.addEventListener('afterprint', () => saveLatest.current(), { once: true })
    window.print()
  }, [])

  const showResults = plan && input && !editing

  return (
    <div className="min-h-screen bg-concrete">
      <header className="no-print flex h-14 items-center justify-between gap-4 bg-asphalt px-4 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="text-lg font-bold tracking-[0.01em]">ELD Trip Planner</span>
        </div>
        <span className="hidden text-sm text-[#C5CCC6] sm:inline">Property carrier, 70-hour / 8-day</span>
      </header>

      <main>
        <div className="workspace no-print">
          <div className="workspace-side bg-white lg:border-r lg:border-rule">
            <div className="workspace-panel bg-white">
              <div aria-live="polite">
                {notice && (
                  <p className="mx-7 mt-6 -mb-2 flex items-start gap-2.5 rounded-lg bg-[#E3EFE8] px-3.5 py-3 text-sm leading-snug text-[#0D4A35]">
                    <span className="mt-px">
                      <Icon name="pretrip" size={18} />
                    </span>
                    <span>
                      {notice}{' '}
                      {saved.length > 0 && (
                        <a href="#saved-trips" className="font-semibold underline">
                          See saved trips
                        </a>
                      )}
                    </span>
                  </p>
                )}
              </div>
              {showResults ? (
                <TripSummary plan={plan} input={input} onEdit={() => setEditing(true)} onSave={saveTrip} />
              ) : (
                <TripForm initial={form} busy={busy} error={error} onPlan={handlePlan} />
              )}
            </div>
            {showResults && (
              <div className="workspace-list bg-white">
                <Itinerary plan={plan} active={position?.index ?? null} onSelect={selectEvent} />
              </div>
            )}
          </div>

          <div className="workspace-map relative h-[360px] overflow-hidden sm:h-[460px] lg:h-auto">
            <RouteMap plan={plan} truck={position?.point ?? null} focus={focus} />
            {plan && timeline ? (
              <>
                <GuideSign plan={plan} />
                <Legend />
                <ReplayControl
                  plan={plan}
                  minute={replay.minute}
                  total={timeline.total}
                  travelled={position?.travelled ?? 0}
                  playing={replay.playing}
                  onToggle={replay.toggle}
                  onSeek={(minute) => {
                    replay.pause()
                    replay.seek(minute)
                  }}
                />
              </>
            ) : (
              <p className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] rounded-lg bg-white px-3.5 pt-2.5 pb-2 text-[15px] shadow-[0_1px_3px_rgba(31,36,39,0.2)] sm:bottom-6 sm:left-6">
                Enter a trip to draw the route, stops and daily log sheets.
              </p>
            )}
            <div
              className={`pointer-events-none absolute inset-0 bg-white/45 transition-opacity duration-300 ${busy ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden="true"
            />
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {plan ? `Trip planned: ${miles(plan.summary.miles)} miles, ${plan.logs.length} log ${plan.logs.length === 1 ? 'sheet' : 'sheets'}.` : ''}
        </p>

        {plan && <DailyLogs logs={plan.logs} header={header} onHeaderChange={changeHeader} onPrint={printAndSave} />}
        <SavedTrips trips={saved} openId={openId} flashId={flashId} onOpen={openTrip} onDelete={deleteTrip} />
      </main>
    </div>
  )
}
