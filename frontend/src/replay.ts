import { useEffect, useRef, useState } from 'react'
import { minutesBetween } from './format'
import { routeLocator } from './geo'
import type { Plan } from './types'

const PLAY_MS = 14000

export function tripTimeline(plan: Plan) {
  const locate = routeLocator(plan.legs)
  let mile = 0
  const spans = plan.events.map((event) => {
    const span = { from: minutesBetween(plan.summary.start, event.start), mile, event }
    mile += event.miles
    return span
  })

  function at(minute: number) {
    const index = Math.max(0, spans.findLastIndex((s) => s.from <= minute))
    const { from, mile, event } = spans[index]
    const progress = event.minutes ? Math.min(1, (minute - from) / event.minutes) : 0
    const travelled = mile + event.miles * progress
    const point = event.status === 'driving' ? locate(travelled) : ([event.lng, event.lat] as [number, number])
    return { index, travelled, point }
  }

  return { spans, total: minutesBetween(plan.summary.start, plan.summary.end), at }
}

export function useReplay(total: number) {
  const [minute, setMinute] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const current = useRef(0)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      current.current = Math.min(total, current.current + ((now - last) / PLAY_MS) * total)
      last = now
      setMinute(current.current)
      if (current.current < total) frame = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, total])

  function seek(value: number) {
    current.current = value
    setMinute(value)
  }

  function toggle() {
    if (!playing && current.current >= total) seek(0)
    setPlaying(!playing)
  }

  function reset() {
    setPlaying(false)
    current.current = 0
    setMinute(null)
  }

  return { minute, playing, toggle, seek, reset, pause: () => setPlaying(false) }
}
