import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { searchPlaces, type Suggestion } from '../api'
import type { Place } from '../types'

export interface PlaceField {
  text: string
  place: Place | null
}

interface Props {
  label: string
  field: PlaceField
  error?: string
  onChange: (field: PlaceField) => void
}

export function PlaceInput({ label, field, error, onChange }: Props) {
  const id = useId()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const query = field.place ? '' : field.text.trim()

  useEffect(() => {
    if (query.length < 3) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then((found) => {
          setSuggestions(found)
          setActive(0)
        })
        .catch(() => setSuggestions([]))
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const shown = open && query.length >= 3 ? suggestions : []

  function pick(s: Suggestion) {
    onChange({ text: s.name, place: { name: s.name, lat: s.lat, lng: s.lng } })
    setOpen(false)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!shown.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((active + step + shown.length) % shown.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(shown[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className={`inline-block rounded-t-md px-2.5 pt-1 pb-0.5 text-[13px] font-semibold text-white transition-colors ${field.place ? 'bg-guide' : 'bg-muted'}`}
      >
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={`${id}-list`}
        aria-activedescendant={shown.length ? `${id}-${active}` : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="off"
        placeholder="City or address"
        value={field.text}
        onChange={(e) => {
          onChange({ text: e.target.value, place: null })
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={`block h-12 w-full rounded-tr-lg rounded-b-lg border-[1.5px] bg-white px-3.5 text-base font-medium transition-colors ${
          error ? 'border-alert' : field.place ? 'border-guide' : 'border-[#9EA79F]'
        }`}
      />
      {shown.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1.5 rounded-xl border border-rule bg-white p-1.5 shadow-[0_8px_24px_rgba(31,36,39,0.16)]"
        >
          {shown.map((s, i) => (
            <li
              key={`${s.lat},${s.lng},${i}`}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(s)}
              className={`cursor-pointer rounded-md px-2.5 pt-2 pb-1.5 ${i === active ? 'bg-[#E3EAE1]' : ''}`}
            >
              <span className="block font-semibold">{s.title}</span>
              {s.area && <span className="block text-[13px] text-muted">{s.area}</span>}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-alert">
          {error}
        </p>
      )}
    </div>
  )
}
