import {
  LngLatBounds,
  MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef, useState } from 'react'
import { ICON_PATHS, KIND, STATUS } from '../duty'
import { clock, dayLabel, duration } from '../format'
import type { Kind, Plan } from '../types'

// MapLibre looks for its worker beside its own file, which bundling moves; point it at Vite's copy.
setWorkerUrl(workerUrl)

const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const TINT = [
  ['background', 'background-color', '#E8EBE5'],
  ['park', 'fill-color', '#DEE4DA'],
  ['water', 'fill-color', '#C3D1D6'],
  ['landcover_wood', 'fill-color', '#DCE2D8'],
  ['landuse_residential', 'fill-color', '#E2E5DF'],
] as const
const MAP_STOPS: Kind[] = ['fuel', 'break', 'rest', 'restart']
const DRAW_MS = 1400
const LINE = STATUS.driving.color

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const reveal = (color: string, progress: number): ExpressionSpecification =>
  ['step', ['line-progress'], color, Math.max(progress, 0.0001), 'rgba(0,0,0,0)']

function icon(name: keyof typeof ICON_PATHS, color: string) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name]}"/></svg>`
}

function markerElement(className: string, html: string, delay: number) {
  const el = document.createElement('div')
  el.className = className
  el.innerHTML = html
  el.style.setProperty('--delay', `${Math.round(delay)}ms`)
  return el
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
  truck: [number, number] | null
  focus: { point: [number, number]; key: number } | null
}

export function RouteMap({ plan, truck, focus }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const truckRef = useRef<Marker | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const map = new MapLibreMap({
      container: container.current!,
      style: STYLE,
      center: [-96.5, 38.5],
      zoom: 3.4,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.on('style.load', () => {
      for (const [layer, property, color] of TINT) if (map.getLayer(layer)) map.setPaintProperty(layer, property, color)
    })
    map.once('load', () => setReady(true))
    mapRef.current = map
    return () => map.remove()
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !plan) return

    const coordinates = plan.legs.flatMap((leg, i) => leg.geometry.slice(i ? 1 : 0)).map(([lat, lng]) => [lng, lat])
    const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } }
    const source = map.getSource<GeoJSONSource>('route')
    if (source) source.setData(data)
    else {
      map.addSource('route', { type: 'geojson', data, lineMetrics: true })
      const beforeId = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id
      const layout = { 'line-join': 'round', 'line-cap': 'round' } as const
      const paint = (width: number, color: string) => ({ 'line-width': width, 'line-gradient': reveal(color, 0) })
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout, paint: paint(9, '#FFFFFF') }, beforeId)
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout, paint: paint(4.5, LINE) }, beforeId)
    }

    const bounds = coordinates.reduce((b, c) => b.extend(c as [number, number]), new LngLatBounds())
    const small = map.getContainer().clientWidth < 640
    map.fitBounds(bounds, {
      // Desktop leaves room for the distance sign (top left), replay control and legend.
      padding: small ? { top: 50, bottom: 90, left: 30, right: 30 } : { top: 200, bottom: 110, left: 80, right: 100 },
      duration: reducedMotion() ? 0 : 900,
      maxZoom: 11,
    })

    const total = plan.summary.miles || 1
    const drawMs = reducedMotion() ? 0 : DRAW_MS
    const markers: Marker[] = []
    for (const point of waypoints(plan)) {
      const el = markerElement('waypoint', `<span>${point.label}</span>`, (point.mile / total) * drawMs)
      markers.push(new Marker({ element: el }).setLngLat([point.at[1], point.at[0]]).addTo(map))
    }
    let mile = 0
    for (const event of plan.events) {
      if (MAP_STOPS.includes(event.kind)) {
        const { color, ink } = STATUS[event.status]
        const el = markerElement('stop', icon(event.kind, ink), (mile / total) * drawMs)
        el.style.background = color
        el.setAttribute('aria-label', `${KIND[event.kind].label}, ${event.place}`)
        const popup = new Popup({ offset: 18, closeButton: false }).setText(
          `${KIND[event.kind].label}, ${event.place}. ${dayLabel(event.start)} ${clock(event.start)}, ${duration(event.minutes)}`,
        )
        markers.push(new Marker({ element: el }).setLngLat([event.lng, event.lat]).setPopup(popup).addTo(map))
      }
      mile += event.miles
    }

    let frame = 0
    const started = performance.now()
    const draw = (now: number) => {
      const progress = drawMs ? Math.min(1, (now - started) / drawMs) : 1
      map.setPaintProperty('route-casing', 'line-gradient', reveal('#FFFFFF', progress))
      map.setPaintProperty('route-line', 'line-gradient', reveal(LINE, progress))
      if (progress < 1) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      markers.forEach((marker) => marker.remove())
    }
  }, [plan, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !truck) {
      truckRef.current?.remove()
      truckRef.current = null
      return
    }
    if (!truckRef.current) {
      const el = markerElement('truck', icon('drive', '#FFFFFF'), 0)
      truckRef.current = new Marker({ element: el }).setLngLat(truck).addTo(map)
    } else truckRef.current.setLngLat(truck)
  }, [truck])

  useEffect(() => {
    const map = mapRef.current
    if (focus && map) map.easeTo({ center: focus.point, zoom: Math.max(map.getZoom(), 7), duration: reducedMotion() ? 0 : 700 })
  }, [focus])

  // maplibre-gl.css makes the container position: relative, so size it rather than pin it.
  return <div ref={container} className="h-full w-full" role="region" aria-label="Route map" />
}
