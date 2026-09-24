import type { ReactNode } from 'react'
import { Glow, Shadow } from './kit'
import { CRIMSON, GOLD, INK, PAPER, outline, useArtUrl } from './tokens'

export function House({ x, y, w = 200, h = 150, wall = '#e8d3b5', roof = '#b8574a', door = '#6f8a8a', lit = false, windows = 2, chimney = false }: {
  x: number; y: number; w?: number; h?: number; wall?: string; roof?: string; door?: string; lit?: boolean; windows?: number; chimney?: boolean
}) {
  const windowFill = lit ? '#f6d68d' : '#bcd6df'
  return (
    <g>
      {chimney && <rect x={x + w * .66} y={y - h - 58} width="22" height="46" fill="#9c6f58" {...outline(2)} />}
      <path d={`M${x - 14} ${y - h} L${x + w / 2} ${y - h - 62} L${x + w + 14} ${y - h}Z`} fill={roof} {...outline(2.4)} />
      <rect x={x} y={y - h} width={w} height={h} fill={wall} {...outline(2.4)} />
      {Array.from({ length: windows }, (_, index) => {
        const wx = x + (index + .5) * (w / (windows + 1)) + (index >= windows / 2 ? w / (windows + 1) : 0) - 22
        return (
          <g key={index}>
            {lit && <Glow x={wx + 22} y={y - h * .62} r={60} kind="lamp" />}
            <rect x={wx} y={y - h * .78} width="44" height="42" rx="3" fill={windowFill} {...outline(2)} />
            <path d={`M${wx + 22} ${y - h * .78} V${y - h * .78 + 42} M${wx} ${y - h * .78 + 21} H${wx + 44}`} stroke="#efe2cc" strokeWidth="4" />
          </g>
        )
      })}
      <rect x={x + w / 2 - 22} y={y - 70} width="44" height="70" rx="4" fill={door} {...outline(2.2)} />
      <circle cx={x + w / 2 + 12} cy={y - 34} r="3" fill={GOLD} />
    </g>
  )
}

export function Building({ x, y, w = 140, h = 260, color = '#c9b7a4', rows = 6, cols = 3, lit = 0, roof, windowColor = '#cfe0e6' }: {
  x: number; y: number; w?: number; h?: number; color?: string; rows?: number; cols?: number; lit?: number; roof?: string; windowColor?: string
}) {
  const cw = (w - 20) / cols
  const rh = (h - 40) / rows
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} fill={color} {...outline(2.2)} />
      {roof && <rect x={x - 6} y={y - h - 10} width={w + 12} height="12" fill={roof} {...outline(2)} />}
      {Array.from({ length: rows * cols }, (_, index) => {
        const col = index % cols
        const row = Math.floor(index / cols)
        const on = (index * 7 + 3) % 5 < lit
        return <rect key={index} x={x + 10 + col * cw + 4} y={y - h + 16 + row * rh} width={cw - 8} height={rh - 10} rx="2" fill={on ? '#f6d68d' : windowColor} stroke={INK} strokeOpacity=".5" strokeWidth="1.4" />
      })}
    </g>
  )
}

/** A shopfront with a striped awning. */
export function Shop({ x, y, w = 190, h = 170, wall = '#e7d2b4', awning = [CRIMSON, PAPER], display, doorColor = '#6f8a8a', sign }: {
  x: number; y: number; w?: number; h?: number; wall?: string; awning?: [string, string]; display?: ReactNode; doorColor?: string; sign?: string
}) {
  const stripes = 7
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} fill={wall} {...outline(2.4)} />
      {sign && <rect x={x + w * .18} y={y - h + 10} width={w * .64} height="22" rx="4" fill={sign} {...outline(2)} />}
      <rect x={x + 12} y={y - h * .52} width={w * .56} height={h * .44} rx="3" fill="#d7e6ea" {...outline(2)} />
      <svg x={x + 12} y={y - h * .52} width={w * .56} height={h * .44} viewBox={`0 0 ${w * .56} ${h * .44}`}>{display}</svg>
      <rect x={x + w * .72} y={y - h * .6} width={w * .2} height={h * .6} fill={doorColor} {...outline(2)} />
      {Array.from({ length: stripes }, (_, index) => (
        <path
          key={index}
          d={`M${x - 8 + index * (w + 16) / stripes} ${y - h * .72} h${(w + 16) / stripes} l-4 26 q-${(w + 16) / stripes / 2 - 4} 10 -${(w + 16) / stripes - 8} 0Z`}
          fill={index % 2 ? awning[1] : awning[0]}
          {...outline(1.8)}
        />
      ))}
    </g>
  )
}

export function StreetLamp({ x, y, h = 190, on = false }: { x: number; y: number; h?: number; on?: boolean }) {
  return (
    <g>
      {on && <Glow x={x} y={y - h + 8} r={120} kind="lamp" />}
      <path d={`M${x} ${y} V${y - h + 20}`} stroke="#3e4450" strokeWidth="6" strokeLinecap="round" />
      <path d={`M${x - 14} ${y - h + 22} L${x - 9} ${y - h - 6} H${x + 9} L${x + 14} ${y - h + 22}Z`} fill={on ? '#f8dd8f' : '#dfe4e6'} {...outline(2)} />
      <rect x={x - 10} y={y - 8} width="20" height="8" fill="#3e4450" />
    </g>
  )
}

export function Bench({ x, y, w = 130, color = '#9a6b47' }: { x: number; y: number; w?: number; color?: string }) {
  return (
    <g>
      <path d={`M${x + 10} ${y} V${y - 30} M${x + w - 10} ${y} V${y - 30}`} stroke="#3e4450" strokeWidth="5" strokeLinecap="round" />
      <rect x={x} y={y - 36} width={w} height="10" rx="3" fill={color} {...outline(2)} />
      <rect x={x} y={y - 66} width={w} height="10" rx="3" fill={color} {...outline(2)} />
      <rect x={x} y={y - 52} width={w} height="10" rx="3" fill={color} {...outline(2)} />
    </g>
  )
}

export function Fountain({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Shadow x={x} y={y + 2} rx={90} />
      <path d={`M${x - 86} ${y} V${y - 26} H${x + 86} V${y}Z`} fill="#c9c2b6" {...outline(2.2)} />
      <ellipse cx={x} cy={y - 26} rx="86" ry="14" fill="#8fb8c8" {...outline(2.2)} />
      <path d={`M${x - 8} ${y - 26} V${y - 70} H${x + 8} V${y - 26}`} fill="#c9c2b6" {...outline(2)} />
      <ellipse cx={x} cy={y - 72} rx="32" ry="7" fill="#c9c2b6" {...outline(2)} />
      <path d={`M${x} ${y - 78} C${x - 10} ${y - 110} ${x - 40} ${y - 100} ${x - 48} ${y - 34} M${x} ${y - 78} C${x + 10} ${y - 110} ${x + 40} ${y - 100} ${x + 48} ${y - 34}`} fill="none" stroke="#dcecf2" strokeWidth="4" strokeLinecap="round" />
    </g>
  )
}

export function Fence({ x, y, w = 240, color = '#e9dcc2', h = 60 }: { x: number; y: number; w?: number; color?: string; h?: number }) {
  const count = Math.floor(w / 22)
  return (
    <g>
      <rect x={x} y={y - h * .7} width={w} height="8" fill={color} {...outline(1.8)} />
      <rect x={x} y={y - h * .3} width={w} height="8" fill={color} {...outline(1.8)} />
      {Array.from({ length: count }, (_, index) => (
        <path key={index} d={`M${x + 4 + index * 22} ${y} V${y - h + 8} L${x + 11 + index * 22} ${y - h} L${x + 18 + index * 22} ${y - h + 8} V${y}Z`} fill={color} {...outline(1.8)} />
      ))}
    </g>
  )
}

export function BrickWall({ x, y, w = 300, h = 90, color = '#c98d6c' }: { x: number; y: number; w?: number; h?: number; color?: string }) {
  const rows = Math.floor(h / 18)
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} fill={color} {...outline(2.2)} />
      {Array.from({ length: rows }, (_, row) => (
        <g key={row} stroke="#8e5d48" strokeWidth="1.6" opacity=".55">
          <path d={`M${x} ${y - h + (row + 1) * 18} H${x + w}`} />
          {Array.from({ length: Math.floor(w / 36) }, (_, col) => (
            <path key={col} d={`M${x + col * 36 + (row % 2) * 18} ${y - h + row * 18} v18`} />
          ))}
        </g>
      ))}
      <rect x={x - 4} y={y - h - 8} width={w + 8} height="10" rx="2" fill="#b67c5e" {...outline(2)} />
    </g>
  )
}

export function Pot({ x, y, s = 1, color = '#c46b4f', children }: { x: number; y: number; s?: number; color?: string; children?: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {children}
      <path d="M-26 -40 H26 L20 0 H-20Z" fill={color} {...outline(2.2)} />
      <rect x="-30" y="-46" width="60" height="10" rx="3" fill={color} {...outline(2.2)} />
    </g>
  )
}

export function Road({ y, h = 70, color = '#8d8f93', width = 800, dashes = true }: { y: number; h?: number; color?: string; width?: number; dashes?: boolean }) {
  return (
    <g>
      <rect x="0" y={y} width={width} height={h} fill={color} />
      <rect x="0" y={y - 10} width={width} height="10" fill="#cfc8bb" {...outline(1.6)} />
      {dashes && Array.from({ length: Math.ceil(width / 70) }, (_, index) => (
        <rect key={index} x={index * 70 + 10} y={y + h / 2 - 3} width="36" height="6" rx="3" fill="#f3efe4" />
      ))}
    </g>
  )
}

export function Car({ x, y, color = '#5f7891', s = 1, flip = false, taxi = false }: { x: number; y: number; color?: string; s?: number; flip?: boolean; taxi?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <Shadow x={0} y={0} rx={70} />
      <path d="M-70 -14 C-72 -34 -58 -38 -40 -40 L-26 -62 H26 L44 -40 C62 -38 72 -30 70 -14Z" fill={color} {...outline(2.2)} />
      <path d="M-20 -56 H-2 V-40 H-32Z M4 -56 H22 L34 -40 H4Z" fill="#cfe0e6" {...outline(1.8)} />
      {taxi && <rect x="-12" y="-72" width="24" height="10" rx="3" fill="#fbf1c4" {...outline(1.6)} />}
      <circle cx="-42" cy="-12" r="13" fill="#2e2d2b" /><circle cx="-42" cy="-12" r="5" fill="#b9b3a8" />
      <circle cx="42" cy="-12" r="13" fill="#2e2d2b" /><circle cx="42" cy="-12" r="5" fill="#b9b3a8" />
      <circle cx="66" cy="-26" r="4" fill="#f7d47a" />
    </g>
  )
}

export function Bus({ x, y, color = '#d9a441', s = 1 }: { x: number; y: number; color?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow x={0} y={0} rx={120} />
      <rect x="-120" y="-110" width="240" height="96" rx="14" fill={color} {...outline(2.4)} />
      {[-100, -58, -16, 26].map(wx => <rect key={wx} x={wx} y="-96" width="34" height="34" rx="4" fill="#cfe0e6" {...outline(1.8)} />)}
      <rect x="72" y="-96" width="34" height="80" rx="4" fill="#cfe0e6" {...outline(1.8)} />
      <path d="M-120 -44 H66" stroke={PAPER} strokeWidth="6" />
      <circle cx="-72" cy="-12" r="15" fill="#2e2d2b" /><circle cx="-72" cy="-12" r="6" fill="#b9b3a8" />
      <circle cx="72" cy="-12" r="15" fill="#2e2d2b" /><circle cx="72" cy="-12" r="6" fill="#b9b3a8" />
    </g>
  )
}

export function Bicycle({ x, y, color = CRIMSON, s = 1 }: { x: number; y: number; color?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none">
      <circle cx="-30" cy="-22" r="22" {...outline(3)} />
      <circle cx="32" cy="-22" r="22" {...outline(3)} />
      <path d="M-30 -22 L-6 -22 L14 -56 L-14 -56 Z M-6 -22 L-14 -64 M32 -22 L14 -56 L10 -70 H22 M-20 -66 H-6" stroke={color} strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
    </g>
  )
}

export function Swing({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 70} ${y} L${x - 50} ${y - 150} H${x + 50} L${x + 70} ${y}`} fill="none" stroke="#5f7891" strokeWidth="7" strokeLinejoin="round" />
      <path d={`M${x - 24} ${y - 150} V${y - 50} M${x + 14} ${y - 150} V${y - 50}`} stroke="#6d6a66" strokeWidth="2.2" />
      <rect x={x - 32} y={y - 52} width="54" height="8" rx="3" fill={GOLD} {...outline(1.8)} />
    </g>
  )
}

export function Goal({ x, y, w = 140, h = 80 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <path d={`M${x} ${y} V${y - h} H${x + w} V${y}`} fill="none" stroke="#fbfaf5" strokeWidth="6" strokeLinejoin="round" />
      {Array.from({ length: 6 }, (_, index) => <path key={index} d={`M${x + 8 + index * (w - 16) / 5} ${y - h + 4} V${y}`} stroke="#fff" strokeWidth="1.2" opacity=".6" />)}
      {Array.from({ length: 4 }, (_, index) => <path key={`h${index}`} d={`M${x + 4} ${y - h + 16 + index * 16} H${x + w - 4}`} stroke="#fff" strokeWidth="1.2" opacity=".6" />)}
    </g>
  )
}

export function Hoop({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x} ${y} V${y - 170}`} stroke="#5d6470" strokeWidth="7" />
      <rect x={x - 36} y={y - 210} width="72" height="50" rx="4" fill="#fbfaf5" {...outline(2)} />
      <rect x={x - 14} y={y - 196} width="28" height="22" fill="none" stroke={CRIMSON} strokeWidth="2.6" />
      <ellipse cx={x} cy={y - 162} rx="20" ry="5" fill="none" stroke="#e0703f" strokeWidth="3.4" />
      <path d={`M${x - 18} ${y - 160} L${x - 10} ${y - 138} M${x} ${y - 157} V${y - 136} M${x + 18} ${y - 160} L${x + 10} ${y - 138}`} stroke="#fff" strokeWidth="1.6" />
    </g>
  )
}

export function Pool({ x, y, w = 240, h = 46 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} rx="8" fill="#e6e1d4" {...outline(2)} />
      <rect x={x + 10} y={y - h + 8} width={w - 20} height={h - 16} rx="5" fill="#7fbfd0" />
      {[0, 1, 2].map(index => <path key={index} d={`M${x + 20 + index * 70} ${y - h / 2} q10 -6 20 0 t20 0`} fill="none" stroke="#fff" strokeWidth="2" opacity=".7" />)}
      <path d={`M${x + w - 30} ${y - h} V${y - h - 40} M${x + w - 16} ${y - h} V${y - h - 40} M${x + w - 30} ${y - h - 20} H${x + w - 16}`} stroke="#b9c0c6" strokeWidth="3.4" strokeLinecap="round" />
    </g>
  )
}

export type Goods = 'apples' | 'oranges' | 'bananas' | 'carrots' | 'bread' | 'fish' | 'greens'

function GoodsPile({ goods, x, y, w }: { goods: Goods; x: number; y: number; w: number }) {
  const count = Math.max(3, Math.floor(w / 18))
  switch (goods) {
    case 'bananas':
      return <g>{Array.from({ length: Math.ceil(count / 2) }, (_, index) => <path key={index} d={`M${x + 6 + index * 34} ${y - 8} C${x + 12 + index * 34} ${y - 26} ${x + 34 + index * 34} ${y - 24} ${x + 38 + index * 34} ${y - 14} C${x + 30 + index * 34} ${y - 18} ${x + 16 + index * 34} ${y - 16} ${x + 6 + index * 34} ${y - 8}Z`} fill="#f2cb4c" {...outline(1.6)} />)}</g>
    case 'carrots':
      return <g>{Array.from({ length: count }, (_, index) => <g key={index}><path d={`M${x + 8 + index * 18} ${y - 4} L${x + 2 + index * 18} ${y - 28} L${x + 14 + index * 18} ${y - 28}Z`} fill="#e57e36" {...outline(1.4)} /><path d={`M${x + 8 + index * 18} ${y - 28} l-4 -8 M${x + 8 + index * 18} ${y - 28} l4 -8`} stroke="#5f8a57" strokeWidth="2" strokeLinecap="round" /></g>)}</g>
    case 'bread':
      return <g>{Array.from({ length: Math.ceil(count / 1.6) }, (_, index) => <g key={index}><path d={`M${x + 4 + index * 28} ${y - 4} C${x + 2 + index * 28} ${y - 26} ${x + 30 + index * 28} ${y - 26} ${x + 28 + index * 28} ${y - 4}Z`} fill="#d49a55" {...outline(1.6)} /><path d={`M${x + 10 + index * 28} ${y - 14} l4 -4 M${x + 18 + index * 28} ${y - 14} l4 -4`} stroke="#a86d33" strokeWidth="1.6" strokeLinecap="round" /></g>)}</g>
    case 'fish':
      return <g>{Array.from({ length: Math.ceil(count / 2) }, (_, index) => <path key={index} d={`M${x + 4 + index * 34} ${y - 12} C${x + 12 + index * 34} ${y - 24} ${x + 26 + index * 34} ${y - 22} ${x + 30 + index * 34} ${y - 12} L${x + 38 + index * 34} ${y - 20} V${y - 4} L${x + 30 + index * 34} ${y - 12} C${x + 26 + index * 34} ${y - 2} ${x + 12 + index * 34} ${y} ${x + 4 + index * 34} ${y - 12}Z`} fill="#9fb3bd" {...outline(1.4)} />)}</g>
    case 'greens':
      return <g>{Array.from({ length: count }, (_, index) => <circle key={index} cx={x + 9 + index * 18} cy={y - 12 - (index % 2) * 6} r="11" fill={index % 2 ? '#7aa26e' : '#5f8a57'} {...outline(1.4)} />)}</g>
    default: {
      const color = goods === 'apples' ? '#c9413f' : '#ea9a3a'
      return (
        <g>
          {Array.from({ length: count }, (_, index) => <circle key={index} cx={x + 9 + index * 18} cy={y - 10} r="9" fill={color} {...outline(1.4)} />)}
          {Array.from({ length: count - 1 }, (_, index) => <circle key={`t${index}`} cx={x + 18 + index * 18} cy={y - 24} r="9" fill={color} {...outline(1.4)} />)}
        </g>
      )
    }
  }
}

export function Crate({ x, y, w = 110, goods = 'apples', color = '#b98a5e' }: { x: number; y: number; w?: number; goods?: Goods; color?: string }) {
  return (
    <g>
      <GoodsPile goods={goods} x={x} y={y - 30} w={w} />
      <rect x={x} y={y - 34} width={w} height="34" fill={color} {...outline(2)} />
      <path d={`M${x} ${y - 17} H${x + w}`} stroke="#8a5a3b" strokeWidth="2" />
    </g>
  )
}

export function Stall({ x, y, w = 230, awning = [CRIMSON, PAPER], goods = ['apples', 'oranges'] as Goods[] }: { x: number; y: number; w?: number; awning?: [string, string]; goods?: Goods[] }) {
  const stripes = 8
  return (
    <g>
      <path d={`M${x + 8} ${y} V${y - 170} M${x + w - 8} ${y} V${y - 170}`} stroke="#8a5a3b" strokeWidth="7" strokeLinecap="round" />
      {Array.from({ length: stripes }, (_, index) => (
        <path key={index} d={`M${x - 10 + index * (w + 20) / stripes} ${y - 196} h${(w + 20) / stripes} v34 q-${(w + 20) / stripes / 2} 12 -${(w + 20) / stripes} 0Z`} fill={index % 2 ? awning[1] : awning[0]} {...outline(1.8)} />
      ))}
      <rect x={x} y={y - 72} width={w} height="72" fill="#c79a6a" {...outline(2.2)} />
      {goods.map((kind, index) => (
        <Crate key={index} x={x + 8 + index * (w - 16) / goods.length} y={y - 72} w={(w - 16) / goods.length - 8} goods={kind} />
      ))}
      <path d={`M${x} ${y - 40} H${x + w}`} stroke="#9a6b47" strokeWidth="2" />
    </g>
  )
}

export function Rails({ y, width = 800 }: { y: number; width?: number }) {
  return (
    <g>
      <rect x="0" y={y} width={width} height="18" fill="#b3a996" />
      {Array.from({ length: Math.ceil(width / 26) }, (_, index) => <rect key={index} x={index * 26} y={y + 2} width="14" height="14" fill="#7d6655" />)}
      <path d={`M0 ${y + 4} H${width} M0 ${y + 13} H${width}`} stroke="#5b5f66" strokeWidth="3" />
    </g>
  )
}

export function Train({ x, y, cars = 3, color = '#5f7891', trim = CRIMSON, s = 1, windowLit = false, faces }: {
  x: number; y: number; cars?: number; color?: string; trim?: string; s?: number; windowLit?: boolean; faces?: ReactNode
}) {
  const carW = 210
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {Array.from({ length: cars }, (_, index) => {
        const cx = index * (carW + 10)
        const front = index === 0
        return (
          <g key={index}>
            <path d={front ? `M${cx} -24 V-110 C${cx} -128 ${cx + 20} -134 ${cx + 44} -134 H${cx + carW} V-24Z` : `M${cx} -24 V-134 H${cx + carW} V-24Z`} fill={color} {...outline(2.4)} />
            <rect x={cx} y="-52" width={carW} height="10" fill={trim} />
            {Array.from({ length: front ? 3 : 4 }, (_, w) => (
              <rect key={w} x={cx + (front ? 60 : 16) + w * 48} y="-116" width="38" height="44" rx="5" fill={windowLit ? '#f6d68d' : '#cfe0e6'} {...outline(1.8)} />
            ))}
            {front && <path d={`M${cx + 8} -112 C${cx + 10} -122 ${cx + 22} -126 ${cx + 44} -126 V-78 H${cx + 8}Z`} fill="#cfe0e6" {...outline(1.8)} />}
            {front && <circle cx={cx + 12} cy="-36" r="6" fill="#fbe6a0" {...outline(1.6)} />}
            {[40, carW - 40].map(wx => <circle key={wx} cx={cx + wx} cy="-22" r="14" fill="#3a3a3a" {...outline(2)} />)}
            {index > 0 && <rect x={cx - 10} y="-70" width="10" height="30" fill="#4a4f5a" />}
          </g>
        )
      })}
      {faces}
    </g>
  )
}

export function Barn({ x, y, w = 190, h = 150 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <path d={`M${x} ${y} V${y - h} L${x + w * .18} ${y - h - 50} H${x + w * .82} L${x + w} ${y - h} V${y}Z`} fill="#b24a3c" {...outline(2.4)} />
      <path d={`M${x - 8} ${y - h + 4} L${x + w * .18} ${y - h - 54} H${x + w * .82} L${x + w + 8} ${y - h + 4}`} fill="none" stroke={PAPER} strokeWidth="7" strokeLinejoin="round" />
      <rect x={x + w * .3} y={y - h * .62} width={w * .4} height={h * .62} fill="#8d3a30" {...outline(2)} />
      <path d={`M${x + w * .3} ${y - h * .62} L${x + w * .7} ${y} M${x + w * .7} ${y - h * .62} L${x + w * .3} ${y}`} stroke={PAPER} strokeWidth="5" />
      <rect x={x + w * .4} y={y - h - 28} width={w * .2} height="26" fill="#f1d68f" {...outline(2)} />
    </g>
  )
}

export function Cow({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <Shadow x={0} y={0} rx={50} />
      <path d="M-36 -2 V-26 M-20 -2 V-26 M22 -2 V-26 M36 -2 V-26" stroke="#f5efe6" strokeWidth="8" strokeLinecap="round" />
      <rect x="-46" y="-66" width="92" height="46" rx="20" fill="#f5efe6" {...outline(2)} />
      <path d="M-20 -66 C-10 -50 6 -56 4 -66Z M16 -40 C24 -30 36 -36 34 -48 C28 -52 20 -50 16 -40Z" fill="#3a3533" />
      <rect x="-70" y="-84" width="32" height="34" rx="12" fill="#f5efe6" {...outline(2)} />
      <rect x="-72" y="-62" width="30" height="14" rx="7" fill="#eab3aa" {...outline(1.6)} />
      <circle cx="-60" cy="-74" r="2.4" fill={INK} />
      <path d="M-66 -84 l-6 -10 M-44 -84 l6 -10" {...outline(2)} />
      <path d="M46 -54 C56 -44 54 -30 58 -24" fill="none" {...outline(2)} />
    </g>
  )
}

export function FieldRows({ y, color = '#6f9a6b', soil = '#b08a62', width = 800, rows = 5 }: { y: number; color?: string; soil?: string; width?: number; rows?: number }) {
  return (
    <g>
      <rect x="0" y={y} width={width} height={rows * 22} fill={soil} />
      {Array.from({ length: rows }, (_, row) => (
        <g key={row}>
          {Array.from({ length: Math.ceil(width / 26) }, (_, col) => (
            <path key={col} d={`M${col * 26 + (row % 2) * 13} ${y + 16 + row * 22} q4 -12 8 0 q4 -10 8 0`} fill={color} />
          ))}
        </g>
      ))}
    </g>
  )
}

export function Sea({ y, width = 800, height = 420 }: { y: number; width?: number; height?: number }) {
  const url = useArtUrl()
  return (
    <g>
      <rect x="0" y={y} width={width} height={height - y} fill={url('sea')} />
      {Array.from({ length: 12 }, (_, index) => (
        <path key={index} d={`M${(index * 97) % width} ${y + 14 + (index % 4) * 18} q10 -5 20 0 t20 0`} fill="none" stroke="#e7f3f6" strokeWidth="2" opacity=".6" />
      ))}
    </g>
  )
}

export function Boat({ x, y, s = 1, color = CRIMSON, sail = PAPER }: { x: number; y: number; s?: number; color?: string; sail?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-60 -18 H60 L44 6 H-44Z" fill={color} {...outline(2.2)} />
      <path d="M-60 -18 H60" stroke={PAPER} strokeWidth="4" />
      <path d="M-4 -18 V-120" {...outline(3)} />
      <path d="M0 -114 L52 -30 H0Z" fill={sail} {...outline(2)} />
      <path d="M-8 -104 L-44 -30 H-8Z" fill={GOLD} {...outline(2)} />
      <path d="M-70 10 q10 -6 20 0 t20 0 M40 10 q10 -6 20 0 t20 0" fill="none" stroke="#e7f3f6" strokeWidth="2.4" />
    </g>
  )
}

export function Lighthouse({ x, y, s = 1, on = false }: { x: number; y: number; s?: number; on?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {on && <path d="M0 -150 L-160 -190 V-110Z M0 -150 L160 -190 V-110Z" fill="#fff4c4" opacity=".35" />}
      <path d="M-22 0 L-14 -130 H14 L22 0Z" fill={PAPER} {...outline(2.2)} />
      <path d="M-20 -30 H20 M-17 -70 H17 M-15 -104 H15" stroke={CRIMSON} strokeWidth="12" />
      <rect x="-16" y="-156" width="32" height="26" rx="3" fill={on ? '#f8dd8f' : '#cfe0e6'} {...outline(2)} />
      <path d="M-20 -156 L0 -176 L20 -156Z" fill={CRIMSON} {...outline(2)} />
    </g>
  )
}

export function Mountains({ y, colors = ['#9ea9b8', '#7d8a9c'], snow = true, width = 800, peaks = [[120, 150], [330, 210], [560, 170], [740, 130]] as Array<[number, number]> }: {
  y: number; colors?: [string, string]; snow?: boolean; width?: number; peaks?: Array<[number, number]>
}) {
  return (
    <g>
      {peaks.map(([px, ph], index) => (
        <g key={index}>
          <path d={`M${px - ph * 1.2} ${y} L${px} ${y - ph} L${px + ph * 1.2} ${y}Z`} fill={index % 2 ? colors[1] : colors[0]} />
          <path d={`M${px} ${y - ph} L${px + ph * 1.2} ${y} H${px}Z`} fill="#000" opacity=".08" />
          {snow && <path d={`M${px - ph * .26} ${y - ph * .78} L${px} ${y - ph} L${px + ph * .26} ${y - ph * .78} L${px + ph * .12} ${y - ph * .72} L${px} ${y - ph * .8} L${px - ph * .12} ${y - ph * .7}Z`} fill="#f7f3ea" />}
        </g>
      ))}
      <rect x="0" y={y - 1} width={width} height="2" fill="none" />
    </g>
  )
}

export function StoneHouse({ x, y, w = 200, h = 130, lit = false, smoke = true }: { x: number; y: number; w?: number; h?: number; lit?: boolean; smoke?: boolean }) {
  const url = useArtUrl()
  return (
    <g>
      {smoke && <path d={`M${x + w * .74} ${y - h - 70} C${x + w * .7} ${y - h - 100} ${x + w * .86} ${y - h - 110} ${x + w * .8} ${y - h - 140} C${x + w * .76} ${y - h - 160} ${x + w * .9} ${y - h - 170} ${x + w * .88} ${y - h - 190}`} fill="none" stroke="#eef0f2" strokeWidth="12" strokeLinecap="round" opacity=".7" />}
      <rect x={x + w * .66} y={y - h - 76} width="26" height="60" fill="#8f877c" {...outline(2)} />
      <path d={`M${x - 16} ${y - h} L${x + w * .5} ${y - h - 70} L${x + w + 16} ${y - h}Z`} fill="#6f5a4e" {...outline(2.4)} />
      <rect x={x} y={y - h} width={w} height={h} fill={url('stone')} {...outline(2.4)} />
      {Array.from({ length: 10 }, (_, index) => (
        <rect key={index} x={x + 10 + (index * 37) % (w - 40)} y={y - h + 14 + Math.floor(index / 3) * 30} width="26" height="14" rx="5" fill="#fff" opacity=".18" />
      ))}
      {[.2, .7].map(fx => (
        <g key={fx}>
          {lit && <Glow x={x + w * fx} y={y - h * .55} r={60} kind="lamp" />}
          <rect x={x + w * fx - 18} y={y - h * .72} width="36" height="36" rx="3" fill={lit ? '#f6d68d' : '#bcd6df'} {...outline(2)} />
        </g>
      ))}
      <path d={`M${x + w * .44} ${y} V${y - 58} C${x + w * .44} ${y - 76} ${x + w * .56} ${y - 76} ${x + w * .56} ${y - 58} V${y}Z`} fill="#6b4a33" {...outline(2)} />
    </g>
  )
}

export function Blackboard({ x, y, w = 260, h = 140, children }: { x: number; y: number; w?: number; h?: number; children?: ReactNode }) {
  return (
    <g>
      <rect x={x - 10} y={y - 10} width={w + 20} height={h + 20} rx="6" fill="#a87a50" {...outline(2.2)} />
      <rect x={x} y={y} width={w} height={h} fill="#3f5a4f" {...outline(1.6)} />
      <g transform={`translate(${x} ${y})`} stroke="#f3f1e8" strokeWidth="3" strokeLinecap="round" fill="none">{children}</g>
      <rect x={x + 20} y={y + h + 8} width={w - 40} height="8" rx="2" fill="#8a5a3b" />
    </g>
  )
}

export function SchoolDesk({ x, y, color = '#c9a57c' }: { x: number; y: number; color?: string }) {
  return (
    <g>
      <path d={`M${x - 44} ${y} V${y - 50} M${x + 44} ${y} V${y - 50}`} stroke="#6d7580" strokeWidth="5" strokeLinecap="round" />
      <rect x={x - 54} y={y - 60} width="108" height="12" rx="3" fill={color} {...outline(2)} />
    </g>
  )
}

export function Globe({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-14 0 H14 M0 0 V-12" {...outline(3)} />
      <circle cx="0" cy="-36" r="24" fill="#7fb4c8" {...outline(2)} />
      <path d="M-14 -50 C-4 -46 -8 -36 -16 -30 C-10 -24 -2 -28 2 -20 M6 -56 C14 -50 20 -44 14 -36 C20 -30 22 -24 18 -18" fill="#8fb08a" {...outline(1.4)} />
      <path d="M-28 -52 A30 30 0 0 1 22 -12" fill="none" stroke="#b58a3a" strokeWidth="3" />
    </g>
  )
}

export function Flask({ x, y, color = '#7fbfd0', s = 1 }: { x: number; y: number; color?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-6 -46 V-26 L-22 -2 C-26 4 -22 8 -16 8 H16 C22 8 26 4 22 -2 L6 -26 V-46Z" fill="#eef5f6" fillOpacity=".6" {...outline(2)} />
      <path d="M-15 -8 L-19 -2 C-21 2 -19 4 -15 4 H15 C19 4 21 2 19 -2 L15 -8Z" fill={color} />
      <rect x="-9" y="-50" width="18" height="6" rx="2" fill="#c9c1b4" {...outline(1.6)} />
    </g>
  )
}

export function Guitar({ x, y, s = 1, rotate = -30 }: { x: number; y: number; s?: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <path d="M0 -20 V-70" stroke="#6b4a33" strokeWidth="6" strokeLinecap="round" />
      <rect x="-5" y="-84" width="10" height="16" rx="3" fill="#4a3328" />
      <path d="M0 -24 C-18 -26 -20 -8 -12 -2 C-24 6 -20 28 0 28 C20 28 24 6 12 -2 C20 -8 18 -26 0 -24Z" fill="#d18a4a" {...outline(2)} />
      <circle cx="0" cy="4" r="6" fill="#4a3328" />
    </g>
  )
}

export function Piano({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-70 0 V-26 M66 0 V-26" stroke="#1d1c1b" strokeWidth="6" strokeLinecap="round" />
      <rect x="-80" y="-110" width="160" height="80" rx="6" fill="#1f1e1d" {...outline(2)} />
      <rect x="-76" y="-44" width="152" height="18" fill="#fbfaf5" {...outline(1.6)} />
      {Array.from({ length: 11 }, (_, index) => <rect key={index} x={-70 + index * 14} y="-44" width="7" height="10" fill="#1f1e1d" />)}
      <rect x="-60" y="-100" width="46" height="30" fill="#f3ead8" {...outline(1.4)} />
      <path d="M-54 -92 H-22 M-54 -84 H-26 M-54 -76 H-30" stroke="#8a8378" strokeWidth="1.4" />
    </g>
  )
}

export function Easel({ x, y, children }: { x: number; y: number; children?: ReactNode }) {
  return (
    <g>
      <path d={`M${x - 40} ${y} L${x - 8} ${y - 150} M${x + 40} ${y} L${x + 8} ${y - 150} M${x} ${y - 150} V${y - 10}`} stroke="#8a5a3b" strokeWidth="5" strokeLinecap="round" />
      <rect x={x - 46} y={y - 138} width="92" height="72" rx="2" fill="#fbfaf5" {...outline(2)} />
      <svg x={x - 42} y={y - 134} width="84" height="64" viewBox="0 0 84 64">{children}</svg>
      <rect x={x - 50} y={y - 66} width="100" height="8" rx="2" fill="#8a5a3b" {...outline(1.6)} />
    </g>
  )
}

export function Boxes({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y - 54} width="70" height="54" fill="#caa06d" {...outline(2)} />
      <rect x={x + 60} y={y - 44} width="58" height="44" fill="#d8b17e" {...outline(2)} />
      <rect x={x + 14} y={y - 96} width="54" height="42" fill="#d8b17e" {...outline(2)} />
      <path d={`M${x + 35} ${y - 54} V${y - 40} M${x + 89} ${y - 44} V${y - 32} M${x + 41} ${y - 96} V${y - 84}`} stroke="#8a6a44" strokeWidth="4" />
    </g>
  )
}

/** A pin board with photos or notes. */
export function Board({ x, y, w = 260, h = 170, children, color = '#c9a57c' }: { x: number; y: number; w?: number; h?: number; children?: ReactNode; color?: string }) {
  return (
    <g>
      <rect x={x - 10} y={y - 10} width={w + 20} height={h + 20} rx="5" fill="#8a5a3b" {...outline(2.2)} />
      <rect x={x} y={y} width={w} height={h} fill={color} />
      {Array.from({ length: 40 }, (_, index) => <circle key={index} cx={x + ((index * 53) % w)} cy={y + ((index * 37) % h)} r="1.4" fill="#8a6a44" opacity=".5" />)}
      <svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>{children}</svg>
    </g>
  )
}

/** A small printed photo of a black cat, pinned to a board. */
export function CatPhoto({ x, y, rotate = 0, eyes = '#8fd16f', s = 1 }: { x: number; y: number; rotate?: number; eyes?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <rect x="-18" y="-22" width="36" height="42" fill={PAPER} {...outline(1.6)} />
      <rect x="-14" y="-18" width="28" height="26" fill="#cfd9d4" />
      <circle cx="0" cy="-2" r="8" fill="#242321" />
      <path d="M-7 -6 l1 -8 5 5 M7 -6 l-1 -8 -5 5" fill="#242321" />
      <circle cx="-3" cy="-3" r="1.4" fill={eyes} /><circle cx="3" cy="-3" r="1.4" fill={eyes} />
      <path d="M-14 8 q14 -10 28 0 V8Z" fill="#242321" />
      <circle cx="0" cy="-20" r="3" fill={CRIMSON} {...outline(1)} />
    </g>
  )
}

export function Oven({ x, y, w = 180, h = 170 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <Glow x={x + w / 2} y={y - h * .45} r={140} kind="fire" />
      <path d={`M${x} ${y} V${y - h * .7} C${x} ${y - h * 1.1} ${x + w} ${y - h * 1.1} ${x + w} ${y - h * .7} V${y}Z`} fill="#c98d6c" {...outline(2.4)} />
      <path d={`M${x + w * .2} ${y - h * .2} V${y - h * .5} C${x + w * .2} ${y - h * .76} ${x + w * .8} ${y - h * .76} ${x + w * .8} ${y - h * .5} V${y - h * .2}Z`} fill="#3a2522" {...outline(2)} />
      <path d={`M${x + w * .26} ${y - h * .22} C${x + w * .3} ${y - h * .5} ${x + w * .42} ${y - h * .36} ${x + w * .5} ${y - h * .56} C${x + w * .56} ${y - h * .38} ${x + w * .7} ${y - h * .5} ${x + w * .74} ${y - h * .22}Z`} fill="#f39a52" />
      <path d={`M${x + w * .34} ${y - h * .22} C${x + w * .4} ${y - h * .4} ${x + w * .5} ${y - h * .3} ${x + w * .52} ${y - h * .42} C${x + w * .58} ${y - h * .3} ${x + w * .64} ${y - h * .36} ${x + w * .66} ${y - h * .22}Z`} fill="#f9d06a" />
      {Array.from({ length: 6 }, (_, index) => <path key={index} d={`M${x + 8} ${y - 20 - index * 22} H${x + w - 8}`} stroke="#9e6a52" strokeWidth="1.6" opacity=".5" />)}
    </g>
  )
}

export function CompassRose({ x, y, r = 40 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={PAPER} opacity=".9" {...outline(2)} />
      <path d={`M0 ${-r * .9} L${r * .16} 0 L0 ${r * .9} L${-r * .16} 0Z`} fill={INK} />
      <path d={`M0 ${-r * .9} L${r * .16} 0 H${-r * .16}Z`} fill={CRIMSON} />
      <path d={`M${-r * .9} 0 L0 ${r * .16} L${r * .9} 0 L0 ${-r * .16}Z`} fill="#8a8378" />
      <circle r={r * .1} fill={GOLD} />
    </g>
  )
}

export function Hotel({ x, y, w = 200, h = 160 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} fill="#f1e6d2" {...outline(2.2)} />
      <rect x={x - 8} y={y - h - 12} width={w + 16} height="14" fill="#6f9ab0" {...outline(2)} />
      {Array.from({ length: 8 }, (_, index) => (
        <g key={index}>
          <rect x={x + 16 + (index % 4) * (w - 32) / 4} y={y - h + 20 + Math.floor(index / 4) * 46} width={(w - 32) / 4 - 12} height="30" rx="3" fill="#bcd6df" {...outline(1.6)} />
          <rect x={x + 12 + (index % 4) * (w - 32) / 4} y={y - h + 52 + Math.floor(index / 4) * 46} width={(w - 32) / 4 - 4} height="5" fill="#6f9ab0" />
        </g>
      ))}
      <rect x={x + w / 2 - 22} y={y - 50} width="44" height="50" fill="#6f9ab0" {...outline(2)} />
      {Array.from({ length: 6 }, (_, index) => (
        <path key={index} d={`M${x + 20 + index * (w - 40) / 5} ${y - 56} h${(w - 40) / 5} l-3 14 h-${(w - 40) / 5 - 6}Z`} fill={index % 2 ? PAPER : '#6f9ab0'} {...outline(1.4)} />
      ))}
    </g>
  )
}
