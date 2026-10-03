import type { Kind, Status } from './types'

// Colours borrow from US road signs: guide green, services blue, warning yellow, recreation brown.
export const STATUS: Record<Status, { label: string; color: string; ink: string }> = {
  driving: { label: 'Driving', color: '#00664A', ink: '#FFFFFF' },
  on: { label: 'On duty, not driving', color: '#F2B705', ink: '#1F2427' },
  sleeper: { label: 'Sleeper berth', color: '#173F75', ink: '#FFFFFF' },
  off: { label: 'Off duty', color: '#A07A55', ink: '#FFFFFF' },
}

export const LEGEND_ORDER: Status[] = ['driving', 'on', 'sleeper', 'off']

export const KIND: Record<Kind, { label: string; remark: string }> = {
  pretrip: { label: 'Pre-trip inspection', remark: 'pre-trip' },
  drive: { label: 'Drive', remark: 'driving' },
  pickup: { label: 'Pickup', remark: 'pickup' },
  dropoff: { label: 'Drop-off', remark: 'drop-off' },
  fuel: { label: 'Fuel', remark: 'fuel' },
  break: { label: '30-minute break', remark: '30-min break' },
  rest: { label: '10-hour rest', remark: '10-hr rest' },
  restart: { label: '34-hour restart', remark: '34-hr restart' },
  off: { label: 'Off duty', remark: 'off duty' },
}

export const ICON_PATHS = {
  pretrip: 'M9 3h6v3H9zM8 4.5H6v16h12v-16h-2M9 13l2 2 4-4',
  pickup: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  dropoff: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  fuel: 'M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M3.5 20h12M5 10h9M14 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-3-3',
  break: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12.5 3.5v2.5',
  rest: 'M3 6v13M3 15h18v4M21 15v-2.5A2.5 2.5 0 0 0 18.5 10H11v5M7 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  restart: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  off: 'M5 21V4h11l-2 4 2 4H5',
  drive: 'M2 16V6h11v10M13 9h4.5l3.5 3.5V16h-8M6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5v5.5M12 16.5v.01',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
}

export type IconName = keyof typeof ICON_PATHS
