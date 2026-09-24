import type { ReactNode } from 'react'
import { Glow, Moon, Stars, Sun, Tree, type SkyTime } from './kit'
import { CRIMSON, GOLD, INK, PAPER, outline, useArtUrl } from './tokens'

export function Room({ wall = 'warm', floorY = 330, pattern, width = 800, height = 420, floor }: {
  wall?: 'warm' | 'night' | string
  floorY?: number
  pattern?: string
  width?: number
  height?: number
  floor?: string
}) {
  const url = useArtUrl()
  const wallFill = wall === 'warm' ? url('wall-warm') : wall === 'night' ? url('wall-night') : wall
  return (
    <g>
      <rect width={width} height={floorY} fill={wallFill} />
      {pattern && Array.from({ length: Math.ceil(width / 40) }, (_, index) => (
        <path key={index} d={`M${index * 40 + 20} 0 V${floorY}`} stroke={pattern} strokeWidth="10" opacity=".22" />
      ))}
      <rect y={floorY} width={width} height={height - floorY} fill={floor ?? url('floor')} />
      {Array.from({ length: 6 }, (_, index) => (
        <path key={index} d={`M0 ${floorY + 14 + index * 16} H${width}`} stroke="#000" strokeOpacity=".07" strokeWidth="2" />
      ))}
      <rect y={floorY - 10} width={width} height="10" fill="#fff" opacity=".55" />
      <path d={`M0 ${floorY} H${width}`} {...outline(2.4)} opacity=".45" />
    </g>
  )
}

/** A window framing a small outdoor view. */
export function Window({ x, y, w, h, view = 'day', curtain = '#d98e7a', open = false, tree = true, children }: {
  x: number; y: number; w: number; h: number; view?: SkyTime; curtain?: string | null; open?: boolean; tree?: boolean; children?: ReactNode
}) {
  const url = useArtUrl()
  const night = view === 'night' || view === 'dusk'
  return (
    <g>
      <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx="4" fill="#efe2cc" {...outline(2.4)} />
      <svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden">
        <rect width={w} height={h} fill={url(`sky-${view}`)} />
        {view === 'night' && <Stars count={12} seed={x + y} width={w} bottom={h * .7} />}
        {view === 'night' && <Moon x={w * .72} y={h * .26} r={Math.min(w, h) * .1} />}
        {(view === 'morning' || view === 'day') && <Sun x={w * .78} y={h * .24} r={Math.min(w, h) * .1} />}
        <path d={`M0 ${h * .78} Q${w * .3} ${h * .66} ${w * .6} ${h * .74} T${w} ${h * .7} V${h} H0Z`} fill={night ? '#3d4d4a' : '#a9c58c'} />
        {tree && <Tree x={w * .24} y={h * 1.02} s={Math.min(w, h) / 260} leaf={night ? '#3f5a4b' : '#6f9a6b'} dark={night ? '#2f4639' : '#557d56'} trunk={night ? '#3a3230' : '#7a5a40'} />}
        {children}
      </svg>
      {open ? (
        <g>
          <path d={`M${x} ${y} L${x - w * .22} ${y + 10} V${y + h - 6} L${x} ${y + h}Z`} fill="#dfe9ec" fillOpacity=".7" {...outline(2)} />
          <path d={`M${x + w} ${y} L${x + w * 1.22} ${y + 10} V${y + h - 6} L${x + w} ${y + h}Z`} fill="#dfe9ec" fillOpacity=".7" {...outline(2)} />
        </g>
      ) : (
        <path d={`M${x + w / 2} ${y} V${y + h} M${x} ${y + h * .48} H${x + w}`} stroke="#efe2cc" strokeWidth="7" />
      )}
      <rect x={x} y={y} width={w} height={h} fill="none" {...outline(2.2)} />
      <rect x={x - 16} y={y + h + 6} width={w + 32} height="12" rx="3" fill="#e3d2b6" {...outline(2.2)} />
      {curtain && (
        <g>
          <path d={`M${x - 24} ${y - 18} H${x + w * .12} C${x + w * .02} ${y + h * .4} ${x + w * .16} ${y + h * .7} ${x - 4} ${y + h + 12} H${x - 24}Z`} fill={curtain} {...outline(2)} />
          <path d={`M${x + w + 24} ${y - 18} H${x + w * .88} C${x + w * .98} ${y + h * .4} ${x + w * .84} ${y + h * .7} ${x + w + 4} ${y + h + 12} H${x + w + 24}Z`} fill={curtain} {...outline(2)} />
          <path d={`M${x - 30} ${y - 20} H${x + w + 30}`} {...outline(4)} />
        </g>
      )}
    </g>
  )
}

/** Sunlight falling through a window onto the floor. */
export function LightBeam({ from, to, opacity = 1 }: { from: [number, number, number]; to: [number, number, number]; opacity?: number }) {
  const url = useArtUrl()
  const [x1, x2, y1] = from
  const [x3, x4, y2] = to
  return <path d={`M${x1} ${y1} L${x2} ${y1} L${x4} ${y2} L${x3} ${y2}Z`} fill={url('beam')} opacity={opacity} />
}

export function Bed({ x, y, w = 220, blanket = '#e4b7a0', pattern = '#fff', frame = '#9a6b47', empty = false }: {
  x: number; y: number; w?: number; blanket?: string; pattern?: string; frame?: string; empty?: boolean
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-6" y="-120" width="22" height="120" rx="6" fill={frame} {...outline(2.2)} />
      <rect x={w - 12} y="-78" width="18" height="78" rx="5" fill={frame} {...outline(2.2)} />
      <rect x="4" y="-58" width={w - 12} height="30" rx="8" fill="#f7efe3" {...outline(2.2)} />
      <rect x="10" y="-80" width="64" height="30" rx="12" fill="#fbf7f0" {...outline(2.2)} />
      <path d={`M60 -62 C${w * .5} -74 ${w * .8} -70 ${w - 8} -56 L${w - 8} -22 L60 -22Z`} fill={blanket} {...outline(2.2)} />
      {!empty && Array.from({ length: 4 }, (_, index) => (
        <circle key={index} cx={90 + index * (w - 110) / 3} cy="-40" r="4" fill={pattern} opacity=".6" />
      ))}
      <rect x="-2" y="-26" width={w - 2} height="16" rx="4" fill={frame} {...outline(2.2)} />
    </g>
  )
}

export function Door({ x, y, w = 90, h = 190, color = '#8a5a3b', open = false, glow = '#fff3cf', outside }: {
  x: number; y: number; w?: number; h?: number; color?: string; open?: boolean; glow?: string; outside?: ReactNode
}) {
  return (
    <g>
      <rect x={x - 8} y={y - h - 8} width={w + 16} height={h + 8} rx="4" fill="#e7d6bb" {...outline(2.2)} />
      {open ? (
        <g>
          <svg x={x} y={y - h} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <rect width={w} height={h} fill={glow} />
            {outside}
          </svg>
          <path d={`M${x} ${y - h} L${x - w * .38} ${y - h + 16} V${y + 8} L${x} ${y}Z`} fill={color} {...outline(2.2)} />
          <circle cx={x - w * .28} cy={y - h * .48} r="4" fill="#e9c35a" />
        </g>
      ) : (
        <g>
          <rect x={x} y={y - h} width={w} height={h} fill={color} {...outline(2.2)} />
          <rect x={x + 12} y={y - h + 14} width={w - 24} height={h * .36} rx="3" fill="#000" opacity=".12" />
          <rect x={x + 12} y={y - h * .5} width={w - 24} height={h * .38} rx="3" fill="#000" opacity=".12" />
          <circle cx={x + w - 14} cy={y - h * .48} r="4.5" fill="#e9c35a" stroke={INK} strokeWidth="1.4" />
        </g>
      )}
    </g>
  )
}

export function Table({ x, y, w = 200, h = 70, top = '#b07a4f', cloth, legs = '#8a5a3b' }: {
  x: number; y: number; w?: number; h?: number; top?: string; cloth?: string; legs?: string
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2 + 12} y={-h} width="10" height={h} fill={legs} {...outline(2)} />
      <rect x={w / 2 - 22} y={-h} width="10" height={h} fill={legs} {...outline(2)} />
      <rect x={-w / 2} y={-h - 10} width={w} height="12" rx="3" fill={top} {...outline(2.2)} />
      {cloth && <path d={`M${-w / 2 + 4} ${-h - 8} H${w / 2 - 4} L${w / 2 - 14} ${-h + 22} H${-w / 2 + 14}Z`} fill={cloth} {...outline(2)} />}
    </g>
  )
}

export function Chair({ x, y, color = '#9a6b47', flip = false }: { x: number; y: number; color?: string; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M-18 0 V-44 M16 0 V-44 M-20 -44 H22 M-18 -44 V-100 M-18 -98 H-6 V-50" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <path d="M-18 0 V-44 M16 0 V-44 M-20 -44 H22 M-18 -44 V-100" fill="none" {...outline(1.2)} opacity=".35" />
    </g>
  )
}

export function Rug({ x, y, w = 260, color = '#c9766f', border = '#e8c07a' }: { x: number; y: number; w?: number; color?: string; border?: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={w / 2} ry={w * .09} fill={color} />
      <ellipse cx={x} cy={y} rx={w / 2 - 12} ry={w * .09 - 6} fill="none" stroke={border} strokeWidth="3" strokeDasharray="6 5" />
    </g>
  )
}

export function Frame({ x, y, w = 70, h = 54, children, color = '#b98a5e' }: { x: number; y: number; w?: number; h?: number; children?: ReactNode; color?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={color} {...outline(2)} />
      <svg x={x + 6} y={y + 6} width={w - 12} height={h - 12} viewBox={`0 0 ${w - 12} ${h - 12}`}>
        <rect width={w - 12} height={h - 12} fill="#f3ead8" />
        {children ?? <path d={`M0 ${h - 12} L${(w - 12) * .35} ${(h - 12) * .45} L${(w - 12) * .6} ${(h - 12) * .7} L${(w - 12) * .8} ${(h - 12) * .5} L${w - 12} ${h - 12}Z`} fill="#8fb08a" />}
      </svg>
    </g>
  )
}

export function Shelf({ x, y, w = 150, books = ['#b8574a', '#5f7891', '#d9a441', '#6f9a6b', '#8d5a7a'] }: { x: number; y: number; w?: number; books?: string[] }) {
  return (
    <g>
      {books.map((color, index) => (
        <rect key={index} x={x + 10 + index * 16} y={y - 34 + (index % 2) * 6} width="13" height={34 - (index % 2) * 6} rx="2" fill={color} {...outline(1.6)} />
      ))}
      <rect x={x} y={y} width={w} height="9" rx="2" fill="#a87a50" {...outline(2)} />
      <path d={`M${x + w - 40} ${y} C${x + w - 44} ${y - 30} ${x + w - 14} ${y - 30} ${x + w - 18} ${y}`} fill="#7aa26e" {...outline(1.6)} />
    </g>
  )
}

export function Lamp({ x, y, on = true, h = 120 }: { x: number; y: number; on?: boolean; h?: number }) {
  return (
    <g>
      {on && <Glow x={x} y={y - h + 10} r={110} kind="lamp" />}
      <path d={`M${x} ${y} V${y - h + 20}`} {...outline(3.2)} />
      <ellipse cx={x} cy={y} rx="18" ry="5" fill="#6d5a48" {...outline(2)} />
      <path d={`M${x - 26} ${y - h + 26} L${x - 16} ${y - h - 8} H${x + 16} L${x + 26} ${y - h + 26}Z`} fill={on ? '#f6d68d' : '#e8d8b8'} {...outline(2.2)} />
    </g>
  )
}

export function Counter({ x, y, w = 260, h = 110, color = '#dfe6de', top = '#a87a50' }: { x: number; y: number; w?: number; h?: number; color?: string; top?: string }) {
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} fill={color} {...outline(2.2)} />
      {Array.from({ length: Math.max(1, Math.round(w / 80)) }, (_, index) => {
        const cw = w / Math.max(1, Math.round(w / 80))
        return (
          <g key={index}>
            <rect x={x + index * cw + 8} y={y - h + 22} width={cw - 16} height={h - 34} rx="3" fill="#fff" opacity=".35" {...outline(1.6)} />
            <circle cx={x + index * cw + cw / 2} cy={y - h + 36} r="3" fill={INK} />
          </g>
        )
      })}
      <rect x={x - 6} y={y - h - 10} width={w + 12} height="12" rx="3" fill={top} {...outline(2.2)} />
    </g>
  )
}

export function Fireplace({ x, y, w = 190, h = 170, lit = true }: { x: number; y: number; w?: number; h?: number; lit?: boolean }) {
  return (
    <g>
      {lit && <Glow x={x} y={y - 50} r={190} kind="fire" />}
      <rect x={x - w / 2} y={y - h} width={w} height={h} fill="#b9876a" {...outline(2.4)} />
      {Array.from({ length: 5 }, (_, row) => (
        <path key={row} d={`M${x - w / 2} ${y - h + 28 + row * 28} H${x + w / 2}`} stroke="#8e5f48" strokeWidth="2" opacity=".6" />
      ))}
      <rect x={x - w / 2 - 14} y={y - h - 14} width={w + 28} height="16" rx="3" fill="#8a5a3b" {...outline(2.2)} />
      <path d={`M${x - w * .32} ${y} V${y - h * .5} C${x - w * .32} ${y - h * .78} ${x + w * .32} ${y - h * .78} ${x + w * .32} ${y - h * .5} V${y}Z`} fill="#2d2522" {...outline(2.2)} />
      {lit && (
        <g>
          <path d={`M${x - 34} ${y - 6} C${x - 40} ${y - 40} ${x - 14} ${y - 50} ${x - 10} ${y - 78} C${x + 6} ${y - 52} ${x + 30} ${y - 54} ${x + 20} ${y - 86} C${x + 44} ${y - 60} ${x + 44} ${y - 24} ${x + 34} ${y - 6}Z`} fill="#f08a3c" />
          <path d={`M${x - 18} ${y - 6} C${x - 22} ${y - 30} ${x - 4} ${y - 34} ${x} ${y - 52} C${x + 12} ${y - 32} ${x + 26} ${y - 28} ${x + 18} ${y - 6}Z`} fill="#f9d06a" />
          <path d={`M${x - 40} ${y - 4} H${x + 40}`} stroke="#6b4a33" strokeWidth="8" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

export function Plant({ x, y, s = 1, pot = '#c46b4f', leaf = '#6f9a6b' }: { x: number; y: number; s?: number; pot?: string; leaf?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[-40, -18, 0, 20, 42].map((angle, index) => (
        <path key={index} d="M0 -30 C-8 -60 -4 -86 0 -96 C6 -80 8 -56 0 -30Z" fill={index % 2 ? leaf : '#5b8458'} transform={`rotate(${angle} 0 -30)`} {...outline(1.4)} />
      ))}
      <path d="M-20 -32 H20 L15 0 H-15Z" fill={pot} {...outline(2)} />
    </g>
  )
}

export function Clock({ x, y, r = 26, hour = 8, minute = 0 }: { x: number; y: number; r?: number; hour?: number; minute?: number }) {
  const minuteAngle = (minute / 60) * 360
  const hourAngle = ((hour % 12) / 12) * 360 + minute / 2
  const hand = (angle: number, length: number) => {
    const radians = (angle - 90) * Math.PI / 180
    return `M${x} ${y} L${(x + Math.cos(radians) * length).toFixed(1)} ${(y + Math.sin(radians) * length).toFixed(1)}`
  }
  return (
    <g>
      <circle cx={x} cy={y} r={r + 5} fill="#8a5a3b" {...outline(2)} />
      <circle cx={x} cy={y} r={r} fill={PAPER} {...outline(1.6)} />
      {Array.from({ length: 12 }, (_, index) => {
        const radians = (index * 30) * Math.PI / 180
        return <circle key={index} cx={(x + Math.sin(radians) * r * .8).toFixed(1)} cy={(y - Math.cos(radians) * r * .8).toFixed(1)} r={index % 3 === 0 ? 2 : 1.2} fill={INK} />
      })}
      <path d={hand(hourAngle, r * .5)} {...outline(3)} />
      <path d={hand(minuteAngle, r * .76)} {...outline(2)} />
      <circle cx={x} cy={y} r="2.6" fill={CRIMSON} />
    </g>
  )
}

/** A wall calendar; circled days are marked in crimson. */
export function Calendar({ x, y, w = 90, circled = [], crossed = 0, header = CRIMSON }: { x: number; y: number; w?: number; circled?: number[]; crossed?: number; header?: string }) {
  const cell = w / 7
  return (
    <g>
      <rect x={x} y={y} width={w} height={w * .95} rx="3" fill={PAPER} {...outline(2)} />
      <rect x={x} y={y} width={w} height={w * .2} rx="3" fill={header} {...outline(2)} />
      <circle cx={x + w * .3} cy={y} r="3" fill={INK} /><circle cx={x + w * .7} cy={y} r="3" fill={INK} />
      {Array.from({ length: 28 }, (_, index) => {
        const cx = x + cell * (index % 7) + cell / 2
        const cy = y + w * .3 + Math.floor(index / 7) * cell * 1.05
        return (
          <g key={index}>
            <circle cx={cx} cy={cy} r={cell * .17} fill={INK} opacity=".35" />
            {index < crossed && <path d={`M${cx - 3} ${cy - 3} l6 6 M${cx + 3} ${cy - 3} l-6 6`} stroke={CRIMSON} strokeWidth="1.6" strokeLinecap="round" />}
            {circled.includes(index) && <circle cx={cx} cy={cy} r={cell * .45} fill="none" stroke={CRIMSON} strokeWidth="2" />}
          </g>
        )
      })}
    </g>
  )
}

export function Bowl({ x, y, food = false, color = '#5f7891', s = 1 }: { x: number; y: number; food?: boolean; color?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {food && <ellipse cx="0" cy="-12" rx="17" ry="5" fill="#b9814a" />}
      <path d="M-22 -12 H22 L16 0 H-16Z" fill={color} {...outline(2)} />
      <ellipse cx="0" cy="-12" rx="22" ry="4" fill="none" {...outline(2)} />
      <path d="M-10 -6 q4 3 8 0 M2 -6 q4 3 8 0" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".6" />
    </g>
  )
}

export function Glass({ x, y, milk = true, s = 1, juice }: { x: number; y: number; milk?: boolean; s?: number; juice?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {milk && <path d="M-9 -26 H9 L7 0 H-7Z" fill={juice ?? '#fbfaf5'} />}
      <path d="M-11 -38 H11 L8 0 H-8Z" fill="#dfeef2" fillOpacity=".35" {...outline(2)} />
      <path d="M-6 -32 V-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".8" />
    </g>
  )
}

export function Plate({ x, y, food = 'bread' }: { x: number; y: number; food?: 'bread' | 'egg' | 'cake' | 'soup' | 'none' }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="30" ry="8" fill="#fbfaf5" {...outline(2)} />
      {food === 'bread' && <path d="M-18 -2 C-20 -16 16 -18 18 -2Z" fill="#d49a55" {...outline(1.8)} />}
      {food === 'egg' && <g><ellipse cx="0" cy="-3" rx="15" ry="6" fill="#fff" {...outline(1.6)} /><circle cx="2" cy="-4" r="5" fill="#f2b33d" /></g>}
      {food === 'cake' && <g><path d="M-14 -2 V-16 L14 -12 V-2Z" fill="#6b3e2e" {...outline(1.6)} /><path d="M-14 -16 L14 -12" stroke="#f3d9c6" strokeWidth="3" /></g>}
      {food === 'soup' && <g><path d="M-18 -4 C-18 8 18 8 18 -4Z" fill="#d7863f" {...outline(1.6)} /><path d="M-6 -10 q-4 -8 0 -14 M4 -10 q-4 -8 0 -14" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" /></g>}
    </g>
  )
}

export function Cake({ x, y, candles = 3 }: { x: number; y: number; candles?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="46" ry="9" fill="#fbfaf5" {...outline(2)} />
      <path d="M-36 -4 V-40 H36 V-4Z" fill="#f2c7c5" {...outline(2)} />
      <path d="M-36 -40 C-30 -26 -22 -34 -16 -28 C-10 -22 -4 -34 2 -28 C8 -22 14 -34 20 -28 C26 -22 32 -34 36 -26 V-40Z" fill="#fbf3ea" {...outline(1.8)} />
      <path d="M-36 -18 H36" stroke={CRIMSON} strokeWidth="4" />
      {Array.from({ length: candles }, (_, index) => {
        const cx = -18 + index * (36 / Math.max(1, candles - 1))
        return (
          <g key={index}>
            <rect x={cx - 2.5} y="-60" width="5" height="20" fill={['#5f7891', '#d9a441', '#6f9a6b'][index % 3]} {...outline(1.4)} />
            <path d={`M${cx} -72 C${cx + 5} -66 ${cx + 3} -61 ${cx} -61 C${cx - 3} -61 ${cx - 5} -66 ${cx} -72Z`} fill="#f7b441" />
          </g>
        )
      })}
    </g>
  )
}

export function Balloon({ x, y, color = CRIMSON, s = 1 }: { x: number; y: number; color?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 22 C-4 40 6 56 0 80" fill="none" stroke={INK} strokeWidth="1.4" opacity=".6" />
      <ellipse cx="0" cy="0" rx="18" ry="22" fill={color} {...outline(1.8)} />
      <path d="M-3 22 L3 22 L0 27Z" fill={color} />
      <ellipse cx="-6" cy="-8" rx="4" ry="7" fill="#fff" opacity=".35" />
    </g>
  )
}

export function Telephone({ x, y, ringing = false, handset = true }: { x: number; y: number; ringing?: boolean; handset?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-30 0 L-22 -26 H22 L30 0Z" fill="#2c2b29" {...outline(2)} />
      <circle cx="0" cy="-12" r="9" fill="#e9e1d2" {...outline(1.6)} />
      {handset && <path d="M-34 -30 C-34 -44 34 -44 34 -30 L26 -26 C22 -34 -22 -34 -26 -26Z" fill="#2c2b29" {...outline(2)} />}
      {!handset && <path d="M-26 -26 L-20 -32 M26 -26 L20 -32" {...outline(3)} />}
      {ringing && <path d="M-46 -44 l-10 -8 M-48 -32 l-12 -2 M46 -44 l10 -8 M48 -32 l12 -2" {...outline(2.6, CRIMSON)} />}
    </g>
  )
}

/** A computer or phone screen that shows a small picture. */
export function Screen({ x, y, w = 120, h = 80, children, stand = true, frame = '#3a3f4a' }: { x: number; y: number; w?: number; h?: number; children?: ReactNode; stand?: boolean; frame?: string }) {
  return (
    <g>
      {stand && <path d={`M${x + w / 2 - 12} ${y + h + 6} L${x + w / 2 - 20} ${y + h + 26} H${x + w / 2 + 20} L${x + w / 2 + 12} ${y + h + 6}`} fill="#7c828c" {...outline(2)} />}
      <rect x={x - 7} y={y - 7} width={w + 14} height={h + 14} rx="6" fill={frame} {...outline(2)} />
      <svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect width={w} height={h} fill="#e9f0f2" />
        {children}
      </svg>
    </g>
  )
}

/** The missing-cat note Mina writes: a paper with Nino's sketch and lines. */
export function MissingNote({ x, y, s = 1, rotate = 0 }: { x: number; y: number; s?: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <rect x="-34" y="-44" width="68" height="88" rx="2" fill={PAPER} {...outline(2)} />
      <rect x="-16" y="-50" width="32" height="10" rx="2" fill="#e9d6a0" opacity=".85" />
      <circle cx="0" cy="-16" r="13" fill="#242321" />
      <path d="M-10 -24 L-10 -36 L-2 -28 M10 -24 L10 -36 L2 -28" fill="#242321" />
      <circle cx="-4.5" cy="-17" r="2.3" fill="#8fd16f" /><circle cx="4.5" cy="-17" r="2.3" fill="#8fd16f" />
      <path d="M6 -29 q4 -1 6 2" stroke="#f4eee4" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M-22 6 H22 M-22 16 H14 M-22 26 H18" stroke="#8a8378" strokeWidth="3" strokeLinecap="round" />
      <path d="M-22 -4 H22" stroke={CRIMSON} strokeWidth="4" strokeLinecap="round" />
    </g>
  )
}

export function Cupboard({ x, y, w = 110, h = 170, color = '#c9a57c' }: { x: number; y: number; w?: number; h?: number; color?: string }) {
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} rx="4" fill={color} {...outline(2.2)} />
      <path d={`M${x + w / 2} ${y - h + 8} V${y - 8}`} {...outline(2)} />
      <circle cx={x + w / 2 - 8} cy={y - h / 2} r="3.4" fill={INK} /><circle cx={x + w / 2 + 8} cy={y - h / 2} r="3.4" fill={INK} />
      <rect x={x + 8} y={y - h + 12} width={w / 2 - 14} height={h - 24} rx="3" fill="#fff" opacity=".18" />
    </g>
  )
}

/** The search map, covered with pinned notes and a dotted route. */
export function WallMap({ x, y, w = 250, h = 170, pins = 9 }: { x: number; y: number; w?: number; h?: number; pins?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#efe1bf" {...outline(2.2)} />
      <path d={`M${x} ${y + h * .35} C${x + w * .3} ${y + h * .28} ${x + w * .6} ${y + h * .5} ${x + w} ${y + h * .42}`} fill="none" stroke="#8fb8c8" strokeWidth="9" />
      {[.25, .5, .75].map(f => <path key={f} d={`M${x + w * f} ${y} V${y + h}`} stroke="#d6c39a" strokeWidth="3" />)}
      {[.3, .66].map(f => <path key={f} d={`M${x} ${y + h * f + 20} H${x + w}`} stroke="#d6c39a" strokeWidth="3" />)}
      <rect x={x + w * .08} y={y + h * .56} width={w * .18} height={h * .22} fill="#a9c58c" />
      {Array.from({ length: pins }, (_, index) => {
        const px = x + 18 + ((index * 67) % (w - 36))
        const py = y + 18 + ((index * 41) % (h - 36))
        return (
          <g key={index}>
            <rect x={px - 12} y={py - 4} width="24" height="16" fill={index % 3 ? '#f6e59a' : '#f3c2b8'} transform={`rotate(${(index % 3) * 6 - 6} ${px} ${py})`} {...outline(1.2)} />
            <circle cx={px} cy={py - 4} r="3.4" fill={CRIMSON} />
          </g>
        )
      })}
      <path d={`M${x + 30} ${y + 30} L${x + 120} ${y + 90} L${x + 200} ${y + 50}`} fill="none" stroke={CRIMSON} strokeWidth="2" strokeDasharray="5 4" />
    </g>
  )
}

export function Sofa({ x, y, w = 260, color = '#8fa5b0' }: { x: number; y: number; w?: number; color?: string }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - 120} width={w} height="70" rx="18" fill={color} {...outline(2.2)} />
      <rect x={x - w / 2 - 16} y={y - 86} width="40" height="80" rx="14" fill={color} {...outline(2.2)} />
      <rect x={x + w / 2 - 24} y={y - 86} width="40" height="80" rx="14" fill={color} {...outline(2.2)} />
      <rect x={x - w / 2 + 20} y={y - 62} width={w - 40} height="46" rx="10" fill={color} {...outline(2.2)} />
      <path d={`M${x} ${y - 62} V${y - 16}`} stroke={INK} strokeWidth="1.6" opacity=".3" />
      <path d={`M${x - w / 2 + 8} ${y - 6} V${y} M${x + w / 2 - 8} ${y - 6} V${y}`} stroke="#6b4a33" strokeWidth="6" strokeLinecap="round" />
    </g>
  )
}

export function OpenSuitcase({ x, y, color = '#b8574a' }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-100 0 L-92 -64 H92 L100 0Z" fill={color} {...outline(2.2)} />
      <path d="M-92 -64 L-84 -150 H84 L92 -64Z" fill={color} opacity=".85" {...outline(2.2)} />
      <rect x="-80" y="-140" width="160" height="70" rx="4" fill="#e7d2b4" opacity=".6" />
      <path d="M-86 -6 L-80 -58 H80 L86 -6Z" fill="#efe2c8" {...outline(1.6)} />
      <path d="M-74 -14 L-70 -44 H-18 L-14 -14Z" fill="#5f84b0" {...outline(1.6)} />
      <path d="M-58 -44 V-14 M-44 -44 L-42 -14" stroke="#4a6a92" strokeWidth="2" />
      <path d="M-8 -14 L-6 -50 H34 L36 -14Z" fill="#fbfaf5" {...outline(1.6)} />
      <path d="M8 -50 L14 -40 L20 -50" fill="none" {...outline(1.4)} />
      <path d="M42 -14 L48 -46 H74 L80 -14Z" fill={CRIMSON} {...outline(1.6)} />
      <path d="M-40 -64 C-40 -76 40 -76 40 -64" fill="none" stroke="#e9dcc2" strokeWidth="4" />
    </g>
  )
}

export function Printer({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-50" y="-44" width="100" height="44" rx="6" fill="#d9dde2" {...outline(2)} />
      <rect x="-36" y="-70" width="72" height="30" rx="2" fill={PAPER} {...outline(1.6)} />
      <rect x="-40" y="-10" width="80" height="26" rx="2" fill={PAPER} {...outline(1.6)} transform="rotate(-4)" />
      <circle cx="0" cy="3" r="7" fill="#242321" />
      <circle cx="36" cy="-32" r="3" fill="#6f9a6b" />
    </g>
  )
}

/** A coin on a café table (gold or silver). */
export function Coin({ x, y, r = 9, color = GOLD }: { x: number; y: number; r?: number; color?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color} {...outline(1.6)} />
      <circle cx={x} cy={y} r={r * .62} fill="none" stroke="#fff" strokeWidth="1.4" opacity=".6" />
    </g>
  )
}

export function Blanket({ x, y, w = 150, color = '#c9766f' }: { x: number; y: number; w?: number; color?: string }) {
  return (
    <g>
      <path d={`M${x - w / 2} ${y} C${x - w / 2 + 10} ${y - 60} ${x + w / 2 - 10} ${y - 66} ${x + w / 2} ${y - 4} L${x + w / 2 - 6} ${y + 40} H${x - w / 2 + 6}Z`} fill={color} {...outline(2.2)} />
      {Array.from({ length: 4 }, (_, index) => <path key={index} d={`M${x - w / 2 + 12 + index * (w - 24) / 3} ${y - 30} V${y + 38}`} stroke="#fff" strokeWidth="3" opacity=".3" />)}
    </g>
  )
}

export function Armchair({ x, y, color = '#6f8a8a' }: { x: number; y: number; color?: string }) {
  return (
    <g>
      <rect x={x - 70} y={y - 150} width="140" height="110" rx="30" fill={color} {...outline(2.2)} />
      <rect x={x - 84} y={y - 90} width="34" height="84" rx="14" fill={color} {...outline(2.2)} />
      <rect x={x + 50} y={y - 90} width="34" height="84" rx="14" fill={color} {...outline(2.2)} />
      <rect x={x - 56} y={y - 64} width="112" height="54" rx="12" fill={color} {...outline(2.2)} />
    </g>
  )
}
