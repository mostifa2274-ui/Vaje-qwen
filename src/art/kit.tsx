import type { ReactNode } from 'react'
import { ArtPrefix, CRIMSON, INK, PAPER, outline, useArtId, useArtUrl } from './tokens'

// Scenery and finishing layers for the storybook illustrations. Every scene
// is plain SVG so it stays crisp at any size and works offline.

export function ArtIds({ prefix, children }: { prefix: string; children: ReactNode }) {
  return <ArtPrefix.Provider value={prefix}>{children}</ArtPrefix.Provider>
}

export type SkyTime = 'morning' | 'day' | 'dusk' | 'night' | 'rain' | 'evening'

const SKIES: Record<SkyTime, string[]> = {
  morning: ['#c9e2ea', '#f3e6cc', '#fbe7c4'],
  day: ['#aed3e3', '#d9ebe6', '#f1f0df'],
  evening: ['#8b8fb8', '#e7b08c', '#f6dcae'],
  dusk: ['#57608f', '#c98a86', '#f3c48f'],
  night: ['#121a31', '#26324f', '#3e4566'],
  rain: ['#8f9ea8', '#b8c3c3', '#d9ddd4'],
}

export function Defs({ extra }: { extra?: ReactNode }) {
  const id = useArtId()
  return (
    <defs>
      {(Object.keys(SKIES) as SkyTime[]).map(time => (
        <linearGradient key={time} id={id(`sky-${time}`)} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SKIES[time][0]} />
          <stop offset=".62" stopColor={SKIES[time][1]} />
          <stop offset="1" stopColor={SKIES[time][2]} />
        </linearGradient>
      ))}
      <radialGradient id={id('sun')}>
        <stop offset="0" stopColor="#fff4c7" stopOpacity="1" />
        <stop offset=".35" stopColor="#ffe19a" stopOpacity=".75" />
        <stop offset="1" stopColor="#ffe19a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id('lamp')}>
        <stop offset="0" stopColor="#ffe3a3" stopOpacity=".95" />
        <stop offset=".4" stopColor="#ffd07a" stopOpacity=".45" />
        <stop offset="1" stopColor="#ffd07a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id('fire')}>
        <stop offset="0" stopColor="#ffcf7a" stopOpacity=".95" />
        <stop offset=".45" stopColor="#f39a52" stopOpacity=".4" />
        <stop offset="1" stopColor="#f39a52" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id('moon')}>
        <stop offset="0" stopColor="#fff6d8" stopOpacity=".7" />
        <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={id('beam')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff7de" stopOpacity=".7" />
        <stop offset="1" stopColor="#fff7de" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={id('wall-warm')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4e4cb" />
        <stop offset="1" stopColor="#e8d0ae" />
      </linearGradient>
      <linearGradient id={id('wall-night')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3b3f5a" />
        <stop offset="1" stopColor="#4f4d62" />
      </linearGradient>
      <linearGradient id={id('floor')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c19466" />
        <stop offset="1" stopColor="#9a6c45" />
      </linearGradient>
      <linearGradient id={id('grass')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a9c58c" />
        <stop offset="1" stopColor="#7c9f68" />
      </linearGradient>
      <linearGradient id={id('sea')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6fa6b8" />
        <stop offset="1" stopColor="#2f6a86" />
      </linearGradient>
      <linearGradient id={id('sand')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#efdcae" />
        <stop offset="1" stopColor="#d9bd88" />
      </linearGradient>
      <linearGradient id={id('stone')} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#c9c2b6" />
        <stop offset="1" stopColor="#9f978b" />
      </linearGradient>
      <radialGradient id={id('vignette')} cx=".5" cy=".45" r=".75">
        <stop offset=".62" stopColor={INK} stopOpacity="0" />
        <stop offset="1" stopColor={INK} stopOpacity=".2" />
      </radialGradient>
      <filter id={id('grain')} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 .17 0 0 0 0 .16 0 0 0 0 .15 0 0 0 .07 0" />
      </filter>
      {extra}
    </defs>
  )
}

/** Soft vignette and paper grain; drawn last so every scene shares one finish. */
export function Finish({ width, height }: { width: number; height: number }) {
  const url = useArtUrl()
  return (
    <g pointerEvents="none">
      <rect width={width} height={height} fill={url('vignette')} />
      <rect width={width} height={height} filter={url('grain')} />
    </g>
  )
}

export function Sky({ time, width = 800, height = 420 }: { time: SkyTime; width?: number; height?: number }) {
  const url = useArtUrl()
  return <rect width={width} height={height} fill={url(`sky-${time}`)} />
}

export function Glow({ x, y, r, kind = 'sun' }: { x: number; y: number; r: number; kind?: 'sun' | 'lamp' | 'fire' | 'moon' }) {
  const url = useArtUrl()
  return <circle cx={x} cy={y} r={r} fill={url(kind)} />
}

export function Sun({ x, y, r = 34 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <Glow x={x} y={y} r={r * 3.2} />
      <circle cx={x} cy={y} r={r} fill="#f7cf6a" />
      <circle cx={x - r * .28} cy={y - r * .28} r={r * .55} fill="#fbe29a" opacity=".7" />
    </g>
  )
}

export function Moon({ x, y, r = 26 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <Glow x={x} y={y} r={r * 3.4} kind="moon" />
      <path d={`M${x} ${y - r} A${r} ${r} 0 1 0 ${x} ${y + r} A${r * .62} ${r} 0 1 1 ${x} ${y - r}Z`} fill="#f6e7b8" />
    </g>
  )
}

function rand(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function Stars({ count = 40, seed = 7, top = 0, bottom = 220, width = 800 }: {
  count?: number; seed?: number; top?: number; bottom?: number; width?: number
}) {
  const next = rand(seed)
  return (
    <g>
      {Array.from({ length: count }, (_, index) => {
        const x = next() * width
        const y = top + next() * (bottom - top)
        const r = .8 + next() * 1.8
        return <circle key={index} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(2)} fill="#fff6dc" opacity={(.45 + next() * .55).toFixed(2)} />
      })}
    </g>
  )
}

export function Sparkle({ x, y, r = 9, fill = '#fff3c4' }: { x: number; y: number; r?: number; fill?: string }) {
  return <path d={`M${x} ${y - r} Q${x + r * .18} ${y - r * .18} ${x + r} ${y} Q${x + r * .18} ${y + r * .18} ${x} ${y + r} Q${x - r * .18} ${y + r * .18} ${x - r} ${y} Q${x - r * .18} ${y - r * .18} ${x} ${y - r}Z`} fill={fill} />
}

export function Cloud({ x, y, s = 1, fill = '#fffaf0', opacity = .92 }: { x: number; y: number; s?: number; fill?: string; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <path d="M-62 14 C-70 -6 -48 -22 -30 -12 C-24 -34 8 -40 20 -18 C34 -30 60 -20 58 0 C74 2 76 20 58 22 L-54 22 C-66 22 -70 18 -62 14Z" fill={fill} />
    </g>
  )
}

export function Rain({ width = 800, height = 420, seed = 3, count = 70, color = '#eef3f5' }: {
  width?: number; height?: number; seed?: number; count?: number; color?: string
}) {
  const next = rand(seed)
  return (
    <g stroke={color} strokeWidth="2" strokeLinecap="round" opacity=".55">
      {Array.from({ length: count }, (_, index) => {
        const x = next() * width
        const y = next() * height
        return <path key={index} d={`M${x.toFixed(1)} ${y.toFixed(1)} l-6 18`} />
      })}
    </g>
  )
}

export function Hills({ y, color, amplitude = 30, width = 800, seed = 1, far = false }: {
  y: number; color: string; amplitude?: number; width?: number; seed?: number; far?: boolean
}) {
  const next = rand(seed)
  const points = 6
  let d = `M0 ${y}`
  for (let index = 0; index < points; index++) {
    const x1 = (width / points) * (index + .5)
    const x2 = (width / points) * (index + 1)
    const peak = y - amplitude * (.4 + next() * .8)
    d += ` Q${x1.toFixed(0)} ${peak.toFixed(0)} ${x2.toFixed(0)} ${(y - amplitude * .2 + next() * amplitude * .4).toFixed(0)}`
  }
  d += ` V${y + 400} H0Z`
  return <path d={d} fill={color} opacity={far ? .75 : 1} />
}

export function Ground({ y, fill, width = 800, height = 420 }: { y: number; fill: string; width?: number; height?: number }) {
  return <rect x="0" y={y} width={width} height={height - y} fill={fill} />
}

export function Shadow({ x, y, rx, ry = rx * .18, opacity = .16 }: { x: number; y: number; rx: number; ry?: number; opacity?: number }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={INK} opacity={opacity} />
}

export function Tree({ x, y, s = 1, leaf = '#6f9a6b', dark = '#557d56', trunk = '#7a5a40', blossom }: {
  x: number; y: number; s?: number; leaf?: string; dark?: string; trunk?: string; blossom?: string
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow x={0} y={0} rx={46} />
      <path d="M-7 0 C-5 -30 -8 -56 -4 -80 L6 -80 C8 -54 5 -28 8 0Z" fill={trunk} />
      <path d="M-2 -60 C-16 -70 -22 -76 -26 -86M4 -68 C16 -76 22 -84 24 -94" fill="none" stroke={trunk} strokeWidth="5" strokeLinecap="round" />
      <circle cx="-30" cy="-102" r="34" fill={dark} />
      <circle cx="28" cy="-108" r="36" fill={dark} />
      <circle cx="0" cy="-132" r="40" fill={leaf} />
      <circle cx="-26" cy="-110" r="28" fill={leaf} />
      <circle cx="24" cy="-116" r="30" fill={leaf} />
      <circle cx="-8" cy="-146" r="18" fill="#fff" opacity=".12" />
      {blossom && [[-30, -120], [10, -150], [30, -110], [-6, -104], [-20, -140], [34, -134]].map(([cx, cy], index) => (
        <circle key={index} cx={cx} cy={cy} r="4.5" fill={blossom} />
      ))}
    </g>
  )
}

export function Pine({ x, y, s = 1, fill = '#4f7458', snow = false }: { x: number; y: number; s?: number; fill?: string; snow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-4" y="-18" width="8" height="18" fill="#6c4f39" />
      <path d="M0 -118 L-26 -70 H-14 L-36 -34 H-20 L-44 -14 H44 L20 -34 H36 L14 -70 H26Z" fill={fill} />
      {snow && <path d="M0 -118 L-10 -98 L0 -102 L10 -98Z" fill="#f7f3ea" />}
    </g>
  )
}

export function Bush({ x, y, s = 1, fill = '#76a06d', dark = '#5b8458' }: { x: number; y: number; s?: number; fill?: string; dark?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-44 0 C-52 -22 -34 -40 -16 -32 C-10 -52 18 -54 26 -34 C44 -40 56 -20 46 0Z" fill={dark} />
      <path d="M-34 -4 C-38 -20 -24 -30 -12 -24 C-6 -40 14 -40 20 -26 C34 -30 42 -16 36 -4Z" fill={fill} />
    </g>
  )
}

export function Flower({ x, y, color = '#d9546a', s = 1, stem = '#5f8a57' }: { x: number; y: number; color?: string; s?: number; stem?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 C1 -10 -1 -18 0 -26" fill="none" stroke={stem} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M0 -12 C6 -16 10 -14 12 -10 C6 -8 2 -9 0 -12Z" fill={stem} />
      {[0, 72, 144, 216, 288].map(angle => (
        <ellipse key={angle} cx="0" cy="-33" rx="4" ry="6.5" fill={color} transform={`rotate(${angle} 0 -27)`} />
      ))}
      <circle cx="0" cy="-27" r="3.2" fill="#f6d27a" />
    </g>
  )
}

export function Grass({ x, y, s = 1, color = '#6e9460' }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-10 0 Q-12 -10 -16 -16 M-4 0 Q-4 -14 -6 -22 M2 0 Q4 -12 8 -20 M8 0 Q12 -8 16 -12"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  )
}

export function Puddle({ x, y, w = 60 }: { x: number; y: number; w?: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={w} ry={w * .16} fill="#9fb8c4" opacity=".75" />
      <ellipse cx={x - w * .3} cy={y - 1} rx={w * .3} ry={w * .05} fill="#fff" opacity=".45" />
    </g>
  )
}

/** Musical notes, hearts or speech bubbles floating in a scene. */
export function Notes({ x, y, color = INK, s = 1 }: { x: number; y: number; color?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={color}>
      <path d="M0 0 V-26 L16 -30 V-6" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="-4" cy="0" rx="6" ry="4.5" transform="rotate(-18 -4 0)" />
      <ellipse cx="12" cy="-5" rx="6" ry="4.5" transform="rotate(-18 12 -5)" />
      <path d="M34 -20 V-44" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="30" cy="-20" rx="6" ry="4.5" transform="rotate(-18 30 -20)" />
      <path d="M34 -44 C42 -40 44 -34 40 -28" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

export function Heart({ x, y, s = 1, fill = CRIMSON }: { x: number; y: number; s?: number; fill?: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 8 C-14 -2 -14 -14 -6 -16 C-2 -17 0 -14 0 -12 C0 -14 2 -17 6 -16 C14 -14 14 -2 0 8Z" fill={fill} />
}

export function SpeechBubble({ x, y, w = 70, h = 40, flip = false, fill = PAPER, children }: {
  x: number; y: number; w?: number; h?: number; flip?: boolean; fill?: string; children?: ReactNode
}) {
  const tail = flip ? `M${w * .72} ${h - 2} L${w * .86} ${h + 16} L${w * .58} ${h - 2}` : `M${w * .28} ${h - 2} L${w * .14} ${h + 16} L${w * .42} ${h - 2}`
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={h / 2} fill={fill} {...outline(2.4)} />
      <path d={tail} fill={fill} {...outline(2.4)} />
      <rect x={w * .2} y={h - 6} width={w * .6} height="6" fill={fill} />
      {children}
    </g>
  )
}

/** Clips children to an arbitrary path (e.g. a day/night split). */
export function Clip({ name, path, children }: { name: string; path: string; children: ReactNode }) {
  const id = useArtId()
  return (
    <g>
      <defs><clipPath id={id(`clip-${name}`)}><path d={path} /></clipPath></defs>
      <g clipPath={`url(#${id(`clip-${name}`)})`}>{children}</g>
    </g>
  )
}

export function ThoughtBubble({ x, y, r = 46, children }: { x: number; y: number; r?: number; children?: ReactNode }) {
  return (
    <g>
      <circle cx={x - r * .9} cy={y + r * 1.35} r={r * .12} fill={PAPER} {...outline(2)} />
      <circle cx={x - r * .6} cy={y + r * 1.05} r={r * .2} fill={PAPER} {...outline(2)} />
      <circle cx={x} cy={y} r={r} fill={PAPER} {...outline(2.4)} />
      {children}
    </g>
  )
}

export function StringLights({ x1, x2, y, sag = 26, colors = ['#f6d68d', '#e98f84', '#9fd0c0'] }: { x1: number; x2: number; y: number; sag?: number; colors?: string[] }) {
  const count = Math.max(4, Math.round((x2 - x1) / 40))
  return (
    <g>
      <path d={`M${x1} ${y} Q${(x1 + x2) / 2} ${y + sag * 2} ${x2} ${y}`} fill="none" stroke={INK} strokeWidth="1.6" opacity=".6" />
      {Array.from({ length: count + 1 }, (_, index) => {
        const t = index / count
        const bx = x1 + (x2 - x1) * t
        const by = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + sag * 2) + t * t * y
        const color = colors[index % colors.length]
        return (
          <g key={index}>
            <circle cx={bx} cy={by + 6} r="11" fill={color} opacity=".3" />
            <ellipse cx={bx} cy={by + 6} rx="4.5" ry="6" fill={color} />
          </g>
        )
      })}
    </g>
  )
}

/** A sandy beach curving toward the viewer. */
export function Sand({ y }: { y: number }) {
  const url = useArtUrl()
  return <path d={`M0 ${y} C200 ${y - 14} 520 ${y + 16} 800 ${y - 6} V420 H0Z`} fill={url('sand')} />
}
