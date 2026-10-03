import { ICON_PATHS, STATUS, type IconName } from '../duty'
import type { Kind, Status } from '../types'

export function Icon({ name, size = 16, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  const filled = name === 'play' || name === 'pause'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

export function StatusGlyph({ kind, status, size = 24 }: { kind: Kind; status: Status; size?: number }) {
  const { color, ink } = STATUS[status]
  return (
    <span className="grid shrink-0 place-items-center rounded-md" style={{ width: size, height: size, background: color }}>
      <Icon name={kind} size={size * 0.62} color={ink} />
    </span>
  )
}
