import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { KIND } from '../duty'
import { hours, longDayLabel, miles } from '../format'
import type { DayLog, SheetHeader, Status } from '../types'

// Sheet geometry in viewBox units (1000 x 1000), traced from the blank FMCSA paper log.
const X0 = 140
const X1 = 860
const HOUR = (X1 - X0) / 24
const GRID_TOP = 360
const ROW = 32
const GRID_BOTTOM = GRID_TOP + 4 * ROW
const ROWS: Status[] = ['off', 'sleeper', 'driving', 'on']
const ROW_LABELS = [['1. Off Duty'], ['2. Sleeper', 'Berth'], ['3. Driving'], ['4. On Duty', '(not driving)']]
const rowY = (status: Status) => GRID_TOP + ROWS.indexOf(status) * ROW + ROW / 2
const xAt = (minute: number) => X0 + (minute / 60) * HOUR

// Quarter-hour ticks hang from the top of rows 1-2 and stand on the bottom of rows 3-4, as on the paper form.
const TICKS = ROWS.flatMap((_, row) => {
  const top = GRID_TOP + row * ROW
  return Array.from({ length: 24 * 4 }, (_, i) => i)
    .filter((i) => i % 4)
    .map((i) => {
      const x = X0 + (i * HOUR) / 4
      const length = i % 4 === 2 ? 13 : 7
      return row < 2 ? `M${x} ${top}v${length}` : `M${x} ${top + ROW}v${-length}`
    })
}).join('')

const HOUR_LINES = Array.from({ length: 23 }, (_, i) => `M${X0 + (i + 1) * HOUR} ${GRID_TOP}V${GRID_BOTTOM}`).join('')
const HOUR_LABELS = Array.from({ length: 23 }, (_, i) => (i + 1 === 12 ? 'Noon' : String(((i + 1) % 12) || 12)))

function dutyLine(segments: DayLog['segments']) {
  let d = ''
  let length = 0
  let lastY: number | null = null
  for (const { status, start, end } of segments) {
    const y = rowY(status)
    d += lastY === null ? `M${xAt(start)} ${y}` : `V${y}`
    length += (lastY === null ? 0 : Math.abs(y - lastY)) + xAt(end) - xAt(start)
    d += `H${xAt(end)}`
    lastY = y
  }
  return { d, length }
}

const RECAP_LABELS: [number, string[]][] = [
  [152, ['On duty', 'hours', 'today,', 'Total lines', '3 & 4']],
  [312, ['A. Total', 'hours on', 'duty last 7', 'days', 'including', 'today.']],
  [392, ['B. Total', 'hours', 'available', 'tomorrow', '70 hr.', 'minus A*']],
  [472, ['C. Total', 'hours on', 'duty last 8', 'days', 'including', 'today.']],
  [636, ['A. Total', 'hours on', 'duty last 6', 'days', 'including', 'today.']],
  [716, ['B. Total', 'hours', 'available', 'tomorrow', '60 hr.', 'minus A*']],
  [796, ['C. Total', 'hours on', 'duty last 7', 'days', 'including', 'today.']],
]

const BLANKS: { field: keyof SheetHeader; label: string; x: number; y: number; w: number; size: number }[] = [
  { field: 'carrier', label: 'Name of carrier', x: 450, y: 150, w: 470, size: 17 },
  { field: 'office', label: 'Main office address', x: 450, y: 198, w: 470, size: 16 },
  { field: 'terminal', label: 'Home terminal address', x: 450, y: 244, w: 470, size: 16 },
  { field: 'vehicles', label: 'Truck and trailer numbers', x: 104, y: 233, w: 312, size: 17 },
  { field: 'manifest', label: 'Manifest number', x: 172, y: 706, w: 168, size: 15 },
  { field: 'shipper', label: 'Shipper and commodity', x: 180, y: 752, w: 160, size: 15 },
]

interface Props {
  log: DayLog
  header: SheetHeader
  onHeaderChange: (header: SheetHeader) => void
}

export function LogSheet({ log, header, onHeaderChange }: Props) {
  const sheet = useRef<HTMLDivElement>(null)
  const [drawn, setDrawn] = useState(false)
  const line = dutyLine(log.segments)
  const [year, month, day] = log.date.split('-')
  const recap = [
    [188, log.recap.on_duty_today],
    [346, log.recap.last_7_days],
    [426, log.recap.available_tomorrow],
    [506, log.recap.last_8_days],
  ]

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(sheet.current!)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={sheet} className={`sheet relative ${drawn ? 'drawn' : ''}`}>
      <div className="sheet-duplicate" aria-hidden="true" />
      <div className="sheet-paper relative">
        <svg viewBox="0 0 1000 1000" className="block w-full" role="img" aria-labelledby={`log-${log.date}`}>
          <title id={`log-${log.date}`}>
            {`Driver's daily log for ${longDayLabel(log.date)}: ${hours(log.totals.off)} hours off duty, ${hours(log.totals.sleeper)} sleeper berth, ${hours(log.totals.driving)} driving, ${hours(log.totals.on)} on duty not driving, ${miles(log.miles)} miles.`}
          </title>
          <g fill="#000" fontFamily="Overpass, sans-serif">
            <text x="40" y="58" fontSize="30" fontWeight="800">Drivers Daily Log</text>
            <text x="118" y="78" fontSize="11">(24 hours)</text>
            <path d="M330 56H400M412 56H482M494 56H580" stroke="#000" strokeWidth="1.2" />
            <text x="403" y="58" fontSize="22">/</text>
            <text x="485" y="58" fontSize="22">/</text>
            <g fontSize="10.5" textAnchor="middle">
              <text x="365" y="72">(month)</text>
              <text x="447" y="72">(day)</text>
              <text x="537" y="72">(year)</text>
            </g>
            <g fontSize="11" fontWeight="600">
              <text x="608" y="46">Original - File at home terminal.</text>
              <text x="608" y="63">Duplicate - Driver retains in his/her possession for 8 days.</text>
            </g>
            <text x="118" y="112" fontSize="13" fontWeight="700">From:</text>
            <text x="518" y="112" fontSize="13" fontWeight="700">To:</text>
            <path d="M162 116H480M546 116H880M450 176H920M450 222H920M450 268H920" stroke="#000" strokeWidth="1.2" />
            <g fill="none" stroke="#000" strokeWidth="1.2">
              <rect x="100" y="150" width="160" height="46" />
              <rect x="272" y="150" width="148" height="46" />
              <rect x="100" y="226" width="320" height="46" />
            </g>
            <g fontSize="10.5" fontWeight="700" textAnchor="middle">
              <text x="180" y="211">Total Miles Driving Today</text>
              <text x="346" y="211">Total Mileage Today</text>
              <text x="260" y="287">Truck/Tractor and Trailer Numbers or</text>
              <text x="260" y="300">License Plate(s)/State (show each unit)</text>
              <text x="685" y="191">Name of Carrier or Carriers</text>
              <text x="685" y="237">Main Office Address</text>
              <text x="685" y="283">Home Terminal Address</text>
            </g>

            <rect x="112" y="318" width="850" height="42" />
            <g fill="#FFF" fontSize="10.5" fontWeight="700" textAnchor="middle">
              <text x={X0} y="333">Mid-</text>
              <text x={X0} y="350">night</text>
              {HOUR_LABELS.map((label, i) => (
                <text key={i} x={X0 + (i + 1) * HOUR} y="350">
                  {label}
                </text>
              ))}
              <text x={X1} y="333">Mid-</text>
              <text x={X1} y="350">night</text>
              <text x="915" y="333" fontWeight="600">Total</text>
              <text x="915" y="350" fontWeight="600">Hours</text>
            </g>
            <g fontSize="11" fontWeight="700">
              {ROW_LABELS.map(([first, second], row) => (
                <text key={row} x="24" y={GRID_TOP + row * ROW + (second ? 13 : 20)}>
                  {first}
                  {second && (
                    <tspan x="38" dy="13">
                      {second}
                    </tspan>
                  )}
                </text>
              ))}
            </g>
            <rect x={X0} y={GRID_TOP} width={X1 - X0} height={GRID_BOTTOM - GRID_TOP} fill="none" stroke="#000" strokeWidth="1.4" />
            <path d={`M${X0} 392H${X1}M${X0} 424H${X1}M${X0} 456H${X1}`} stroke="#000" strokeWidth="1.1" />
            <path d={HOUR_LINES} stroke="#000" strokeWidth="1" />
            <path d={TICKS} stroke="#000" strokeWidth="0.7" />
            <path d="M878 388H952M878 420H952M878 452H952M878 484H952M878 496H952M878 500H952" stroke="#000" strokeWidth="1.1" />

            <text x="40" y="530" fontSize="16" fontWeight="800">Remarks</text>
            <path d="M40 544V826H360M640 826H960M40 988H960" fill="none" stroke="#000" strokeWidth="3.2" />
            <g fontSize="13" fontWeight="700">
              <text x="52" y="676">Shipping</text>
              <text x="52" y="692">Documents:</text>
            </g>
            <g fontSize="11" fontWeight="700">
              <text x="52" y="724">DVL or Manifest No.</text>
              <text x="52" y="742">or</text>
              <text x="52" y="770">Shipper &amp; Commodity</text>
            </g>
            <path d="M52 730H340M52 776H340" stroke="#000" strokeWidth="1.1" />
            <g fontSize="10.5" fontWeight="700" textAnchor="middle">
              <text x="500" y="800">
                Enter name of place you reported and where released from work and when and where each change of duty occurred.
              </text>
              <text x="500" y="816">Use time standard of home terminal.</text>
            </g>

            <g fontSize="9.5" fontWeight="700">
              <text x="40" y="852">Recap:</text>
              <text x="40" y="865">Complete at</text>
              <text x="40" y="878">end of day</text>
              <text x="246" y="852">70 Hour/</text>
              <text x="246" y="865">8 Day</text>
              <text x="246" y="878">Drivers</text>
              <text x="548" y="865">60 Hour/ 7</text>
              <text x="548" y="878">Day Drivers</text>
              {['*If you took', '34', 'consecutive', 'hours off', 'duty you', 'have 60/70', 'hours', 'available'].map((text, i) => (
                <text key={i} x="884" y={852 + i * 13}>
                  {text}
                </text>
              ))}
            </g>
            <g fontSize="14" fontWeight="600">
              {[312, 392, 472, 636, 716, 796].map((x, i) => (
                <text key={x} x={x} y="879">
                  {'ABC'[i % 3]}.
                </text>
              ))}
            </g>
            <path d="M150 886H226M312 886H380M392 886H460M472 886H540M636 886H704M716 886H784M796 886H864" stroke="#000" strokeWidth="1.1" />
            <g fontSize="9.5" fontWeight="600">
              {RECAP_LABELS.map(([x, lines]) =>
                lines.map((text, i) => (
                  <text key={`${x}-${i}`} x={x} y={900 + i * 13}>
                    {text}
                  </text>
                )),
              )}
            </g>
          </g>

          <g className="ink" fill="#1B3A8C" fontFamily="Kalam, cursive">
            <g className="ink-fade" fontSize="22" textAnchor="middle">
              <text x="365" y="50">{month}</text>
              <text x="447" y="50">{day}</text>
              <text x="537" y="50">{year}</text>
            </g>
            <g className="ink-fade" fontSize="18">
              <text x="172" y="111">{log.from}</text>
              <text x="556" y="111">{log.to}</text>
            </g>
            <g className="ink-fade" fontSize="24" textAnchor="middle">
              <text x="180" y="182">{miles(log.miles)}</text>
              <text x="346" y="182">{miles(log.miles)}</text>
            </g>
            <path
              className="ink-line"
              d={line.d}
              fill="none"
              stroke="#1B3A8C"
              strokeWidth="2.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ '--len': line.length } as CSSProperties}
            />
            {log.segments
              .filter((s) => s.status === 'on')
              .map((s) => (
                <path
                  key={s.start}
                  className="ink-fade"
                  d={`M${xAt(s.start)} 492V502H${xAt(s.end)}V492`}
                  fill="none"
                  stroke="#1B3A8C"
                  strokeWidth="1.6"
                  style={{ '--at': s.start / 1440 } as CSSProperties}
                />
              ))}
            {log.remarks.map((remark) => {
              const x = xAt(remark.minute)
              return (
                <g key={`${remark.minute}-${remark.kind}`} className="ink-fade" style={{ '--at': remark.minute / 1440 } as CSSProperties}>
                  <path d={`M${x} ${GRID_BOTTOM}V514`} stroke="#1B3A8C" strokeWidth="1.4" />
                  <text transform={`translate(${x - 2} 520) rotate(-45)`} textAnchor="end" fontSize="13">
                    {remark.place} ({KIND[remark.kind].remark})
                  </text>
                </g>
              )
            })}
            <g className="ink-fade" fontSize="20" textAnchor="middle" style={{ '--at': 1 } as CSSProperties}>
              {ROWS.map((status, row) => (
                <text key={status} x="915" y={GRID_TOP + row * ROW + 24}>
                  {hours(log.totals[status])}
                </text>
              ))}
              <text x="915" y="522">24</text>
              {recap.map(([x, minutes]) => (
                <text key={x} x={x} y="880">
                  {hours(minutes)}
                </text>
              ))}
            </g>
          </g>
        </svg>
        {BLANKS.map(({ field, label, x, y, w, size }) => (
          <input
            key={field}
            aria-label={label}
            placeholder={label}
            value={header[field]}
            onChange={(e) => onHeaderChange({ ...header, [field]: e.target.value })}
            className="sheet-blank"
            style={{ left: `${x / 10}%`, top: `${y / 10}%`, width: `${w / 10}%`, fontSize: `${size / 10}cqw` }}
          />
        ))}
      </div>
    </div>
  )
}
