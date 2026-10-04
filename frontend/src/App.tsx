import { useCallback, useMemo, useState } from 'react'
import { planTrip } from './api'
import { DailyLogs } from './components/DailyLogs'
import { Itinerary } from './components/Itinerary'
import { GuideSign, Legend, ReplayControl } from './components/MapOverlays'
import { RouteMap } from './components/RouteMap'
import { TripForm, type TripFormState } from './components/TripForm'
import { TripSummary } from './components/TripSummary'
import { miles, minutesBetween, nextQuarterHour } from './format'
import { tripTimeline, useReplay } from './replay'
import type { Plan, SheetHeader, TripInput } from './types'

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

export default function App() {
  const [form, setForm] = useState<TripFormState>(() => ({
    current: emptyStop,
    pickup: emptyStop,
    dropoff: emptyStop,
    cycle: '0',
    start: nextQuarterHour(),
  }))
  const [input, setInput] = useState<TripInput | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [editing, setEditing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [header, setHeader] = useState(loadHeader)
  const [focus, setFocus] = useState<{ point: [number, number]; key: number } | null>(null)

  const timeline = useMemo(() => (plan ? tripTimeline(plan) : null), [plan])
  const replay = useReplay(timeline?.total ?? 0)
  const position = timeline && replay.minute !== null ? timeline.at(replay.minute) : null

  async function handlePlan(next: TripInput, nextForm: TripFormState) {
    setForm(nextForm)
    setBusy(true)
    setError('')
    try {
      const result = await planTrip(next)
      replay.reset()
      setPlan(result)
      setInput(next)
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
              {showResults ? (
                <TripSummary plan={plan} input={input} onEdit={() => setEditing(true)} />
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

        {plan && <DailyLogs logs={plan.logs} header={header} onHeaderChange={changeHeader} />}
      </main>
    </div>
  )
}
