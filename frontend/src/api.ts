import type { Place, Plan, TripInput } from './types'

export async function planTrip(input: TripInput): Promise<Plan> {
  let res: Response
  try {
    res = await fetch('/api/plan/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error('Could not reach the planner. Check your connection and try again.')
  }
  const data = await res.json().catch(() => null)
  if (res.ok) return data
  if (res.status === 429) throw new Error('Too many plans in a minute. Wait a moment and try again.')
  if (data?.detail) throw new Error(data.detail)
  if (data && typeof data === 'object') {
    const [field, messages] = Object.entries(data)[0] as [string, string[]]
    throw new Error(`${field.replace('_', ' ')}: ${[messages].flat().join(' ')}`)
  }
  throw new Error('The planner is unavailable right now. Try again shortly.')
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    housenumber?: string
    street?: string
    city?: string
    state?: string
    countrycode?: string
    osm_key?: string
  }
}

export interface Suggestion extends Place {
  title: string
  area: string
}

// Photon (OpenStreetMap geocoder) answers from the browser, so lookups don't queue behind our API.
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const params = new URLSearchParams({ q: query, limit: '12', lang: 'en', bbox: '-170,18,-65,72' })
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal })
  if (!res.ok) throw new Error('Place search is unavailable.')
  const { features } = (await res.json()) as { features: PhotonFeature[] }
  const suggestions = features
    .filter((f) => f.properties.countrycode === 'US')
    // Towns and cities first: they are what a dispatcher usually means.
    .sort((a, b) => Number(b.properties.osm_key === 'place') - Number(a.properties.osm_key === 'place'))
    .map(({ geometry, properties: p }) => {
      const title = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || p.state || query
      const street = p.street && !title.includes(p.street) ? p.street : ''
      const area = [street, p.city, p.state].filter((part) => part && part !== title).join(', ')
      const [lng, lat] = geometry.coordinates
      return { name: area ? `${title}, ${area}` : title, title, area, lat, lng }
    })
  return suggestions.filter((s, i) => suggestions.findIndex((other) => other.name === s.name) === i).slice(0, 5)
}
