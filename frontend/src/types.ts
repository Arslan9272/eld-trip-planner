export type Status = 'off' | 'sleeper' | 'driving' | 'on'

export type Kind = 'pretrip' | 'drive' | 'pickup' | 'dropoff' | 'fuel' | 'break' | 'rest' | 'restart' | 'off'

export interface Place {
  name: string
  lat: number
  lng: number
}

export interface TripInput {
  current: Place
  pickup: Place
  dropoff: Place
  cycle_used: number
  start: string
}

export interface TripEvent {
  kind: Kind
  status: Status
  start: string
  end: string
  minutes: number
  miles: number
  lat: number
  lng: number
  place: string
}

export interface Leg {
  from: string
  to: string
  miles: number
  minutes: number
  geometry: [number, number][]
}

export interface DayLog {
  date: string
  from: string
  to: string
  miles: number
  segments: { status: Status; start: number; end: number }[]
  totals: Record<Status, number>
  remarks: { minute: number; place: string; kind: Kind }[]
  recap: { on_duty_today: number; last_7_days: number; available_tomorrow: number; last_8_days: number }
}

export interface Plan {
  summary: {
    miles: number
    driving_minutes: number
    on_duty_minutes: number
    start: string
    end: string
    avg_mph: number
    cycle_used_end: number
    days: number
  }
  legs: Leg[]
  events: TripEvent[]
  logs: DayLog[]
}

export interface SheetHeader {
  carrier: string
  office: string
  terminal: string
  vehicles: string
  manifest: string
  shipper: string
}
