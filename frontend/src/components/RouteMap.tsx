import L, { type LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { ICON_PATHS, KIND, STATUS } from '../duty'
import { clock, dayLabel, duration } from '../format'
import type { Kind, Plan } from '../types'

// Raster tiles and SVG lines need no WebGL, so the map draws in every browser.
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const LOWER_48: L.LatLngBoundsExpression = [
  [24.5, -125],
  [49.5, -66.9],
]
const MAP_STOPS: Kind[] = ['fuel', 'break', 'rest', 'restart']
const DRAW_MS = 1400

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function icon(name: keyof typeof ICON_PATHS, color: string) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name]}"/></svg>`
}

function marker(at: LatLngTuple, size: number, html: string, title = '') {
  const markerIcon = L.divIcon({ className: '', html, iconSize: [size, size] })
  return L.marker(at, { icon: markerIcon, title, keyboard: Boolean(title) })
}

function waypoints(plan: Plan) {
  const [toPickup, toDropoff] = plan.legs
  const points = [
    { label: 'Start', at: toPickup.geometry[0], mile: 0 },
    { label: 'Pickup', at: toPickup.geometry[toPickup.geometry.length - 1], mile: toPickup.miles },
    { label: 'Drop-off', at: toDropoff.geometry[toDropoff.geometry.length - 1], mile: toPickup.miles + toDropoff.miles },
  ]
  const merged: typeof points = []
  for (const point of points) {
    const previous = merged[merged.length - 1]
    if (previous && point.mile - previous.mile < 0.1) previous.label += `, ${point.label.toLowerCase()}`
    else merged.push({ ...point })
  }
  return merged
}

interface Props {
  plan: Plan | null
  truck: LatLngTuple | null
  focus: { point: LatLngTuple; key: number } | null
}

export function RouteMap({ plan, truck, focus }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const truckRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    const map = L.map(container.current!, { zoomControl: false, zoomSnap: 0.5 })
    map.attributionControl.setPrefix(false)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.tileLayer(TILES, { maxZoom: 18, attribution: ATTRIBUTION }).addTo(map)
    map.fitBounds(LOWER_48)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!plan) {
      map.fitBounds(LOWER_48)
      return
    }

    const route = plan.legs.flatMap((leg, i) => leg.geometry.slice(i ? 1 : 0))
    const small = map.getContainer().clientWidth < 640
    // Desktop leaves room for the distance sign (top left), replay control and legend.
    map.fitBounds(L.latLngBounds(route), {
      paddingTopLeft: small ? [30, 50] : [80, 200],
      paddingBottomRight: small ? [30, 90] : [100, 110],
      animate: false,
    })

    const drawMs = reducedMotion() ? 0 : DRAW_MS
    const casing = L.polyline([], { color: '#FFFFFF', weight: 9, opacity: 0.95, interactive: false }).addTo(map)
    const line = L.polyline([], { color: STATUS.driving.color, weight: 4.5, interactive: false }).addTo(map)

    const total = plan.summary.miles || 1
    const markers: L.Marker[] = []
    for (const point of waypoints(plan)) {
      const delay = (point.mile / total) * drawMs
      markers.push(marker(point.at, 12, `<div class="waypoint" style="--delay:${delay}ms"><span>${point.label}</span></div>`))
    }
    let mile = 0
    for (const event of plan.events) {
      if (MAP_STOPS.includes(event.kind)) {
        const { color, ink } = STATUS[event.status]
        const delay = (mile / total) * drawMs
        const label = `${KIND[event.kind].label}, ${event.place}`
        const html = `<div class="stop" style="--delay:${delay}ms;background:${color}">${icon(event.kind, ink)}</div>`
        const popup = document.createElement('div')
        popup.textContent = `${label}. ${dayLabel(event.start)} ${clock(event.start)}, ${duration(event.minutes)}`
        markers.push(marker([event.lat, event.lng], 28, html, label).bindPopup(popup, { closeButton: false, offset: [0, -8] }))
      }
      mile += event.miles
    }
    markers.forEach((m) => m.addTo(map))

    // Draw the route in by handing the lines a growing slice of their points.
    let frame = 0
    const started = performance.now()
    const draw = (now: number) => {
      const progress = drawMs ? Math.min(1, (now - started) / drawMs) : 1
      const shown = route.slice(0, Math.max(2, Math.ceil(progress * route.length)))
      casing.setLatLngs(shown)
      line.setLatLngs(shown)
      if (progress < 1) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      ;[casing, line, ...markers].forEach((layer) => layer.remove())
    }
  }, [plan])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !truck) {
      truckRef.current?.remove()
      truckRef.current = null
      return
    }
    if (truckRef.current) truckRef.current.setLatLng(truck)
    else truckRef.current = marker(truck, 32, `<div class="truck">${icon('drive', '#FFFFFF')}</div>`).setZIndexOffset(1000).addTo(map)
  }, [truck])

  useEffect(() => {
    const map = mapRef.current
    if (focus && map) map.flyTo(focus.point, Math.max(map.getZoom(), 7), { duration: reducedMotion() ? 0 : 0.7 })
  }, [focus])

  // isolate keeps Leaflet's pane z-indexes inside the map, under the overlays drawn after it.
  return <div ref={container} className="isolate h-full w-full bg-concrete" role="region" aria-label="Route map" />
}
