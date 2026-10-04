import type { Plan, SheetHeader, TripInput } from './types'

const KEY = 'eld-saved-trips'
const LIMIT = 25

export interface SavedTrip {
  id: string
  savedAt: string
  input: TripInput
  plan: Plan
  header: SheetHeader
}

export function loadSavedTrips(): SavedTrip[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

// Newest first. Past the limit the oldest trips drop off, so the list stays inside browser storage.
// Throws when storage is full or blocked; callers tell the user.
export function storeSavedTrips(trips: SavedTrip[]) {
  const kept = trips.slice(0, LIMIT)
  localStorage.setItem(KEY, JSON.stringify(kept))
  return kept
}
