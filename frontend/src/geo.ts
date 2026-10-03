import type { Leg } from './types'

type LngLat = [number, number]

function haversineMiles([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]) {
  const rad = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return 7917.6 * Math.asin(Math.sqrt(a))
}

// Maps a trip mileage to a point on the drawn route. Each leg's geometry is stretched to the
// routing engine's own distance so positions agree with the planner's mileage.
export function routeLocator(legs: Leg[]) {
  const points: LngLat[] = []
  const at: number[] = []
  let offset = 0
  for (const leg of legs) {
    const geometry = leg.geometry
    const steps = geometry.slice(1).map((p, i) => haversineMiles(geometry[i], p))
    const drawn = steps.reduce((a, b) => a + b, 0) || 1
    let run = 0
    geometry.forEach(([lat, lng], i) => {
      if (i) run += steps[i - 1]
      points.push([lng, lat])
      at.push(offset + (run / drawn) * leg.miles)
    })
    offset += leg.miles
  }

  return (mile: number): LngLat => {
    const i = at.findIndex((m) => m >= mile)
    if (i === -1) return points[points.length - 1]
    if (i === 0) return points[0]
    const span = at[i] - at[i - 1] || 1
    const t = (mile - at[i - 1]) / span
    const [a, b] = [points[i - 1], points[i]]
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  }
}
