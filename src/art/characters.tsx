import type { ReactNode } from 'react'
import { Shadow } from './kit'
import { CRIMSON, INK, PAPER, outline } from './tokens'
import type { Person } from './cast'

// Storybook cast. People are simple posable figures that face the reader;
// Nino is always the same small black cat with green eyes and a white mark
// near his ear, exactly as the story describes him.

export type ArmPose = 'down' | 'hip' | 'out' | 'up' | 'wave' | 'point' | 'hold' | 'chest' | 'mouth' | 'reach'
export type LegPose = 'stand' | 'walk' | 'kneel' | 'sit'
export type HairStyle = 'ponytail' | 'bun' | 'short' | 'long' | 'curly' | 'bald' | 'scarf' | 'cap' | 'bob'
export type Expression = 'smile' | 'happy' | 'worried' | 'sad' | 'calm' | 'sleep' | 'surprised' | 'talk'
export type Item = 'book' | 'photo' | 'flashlight' | 'basket' | 'umbrella' | 'phone' | 'pen' | 'bag' | 'paper' | 'cup' | 'bread' | 'ball' | 'map' | 'toy' | 'key' | 'suitcase' | 'stethoscope'
export type Build = 'child' | 'teen' | 'adult' | 'elder'

export interface FigureProps {
  x: number
  y: number
  s?: number
  flip?: boolean
  build?: Build
  skin?: string
  hair?: string
  hairStyle?: HairStyle
  top?: string
  bottom?: string
  outfit?: 'dress' | 'skirt' | 'pants' | 'shorts' | 'coat'
  legs?: string
  shoes?: string
  arms?: [ArmPose, ArmPose]
  pose?: LegPose
  expression?: Expression
  holding?: { item: Item; hand?: 'left' | 'right' }
  glasses?: boolean
  beard?: boolean
  apron?: string
  collar?: string
  coat?: string
  hat?: string
  accent?: string
  shadow?: boolean
}

const GEOMETRY: Record<Build, { headR: number; head: number; shoulder: number; waist: number; hem: number; hip: number; sw: number; arm: number; limb: number }> = {
  child: { headR: 17, head: -124, shoulder: -101, waist: -68, hem: -42, hip: 7, sw: 15, arm: 36, limb: 8 },
  teen: { headR: 17.5, head: -148, shoulder: -125, waist: -84, hem: -56, hip: 8, sw: 17, arm: 44, limb: 8.5 },
  adult: { headR: 19.5, head: -168, shoulder: -143, waist: -92, hem: -46, hip: 10, sw: 22, arm: 50, limb: 10.5 },
  elder: { headR: 19.5, head: -160, shoulder: -136, waist: -88, hem: -34, hip: 10, sw: 22, arm: 46, limb: 10.5 },
}

// Elbow and hand as fractions of arm length, x measured outward from the body.
const ARM_POSES: Record<ArmPose, [number, number, number, number]> = {
  down: [.16, .5, .2, 1],
  hip: [.5, .42, .12, .78],
  out: [.45, .3, .92, .42],
  up: [.22, -.48, .3, -.98],
  wave: [.5, -.08, .6, -.62],
  point: [.5, .12, 1.02, .02],
  hold: [.24, .56, -.3, .62],
  chest: [.22, .48, -.42, .3],
  mouth: [.56, -.02, .12, -.46],
  reach: [.42, -.06, .96, -.22],
}

function armPoints(side: -1 | 1, pose: ArmPose, shoulderX: number, shoulderY: number, length: number) {
  const [ex, ey, hx, hy] = ARM_POSES[pose]
  return {
    elbow: [shoulderX + side * ex * length, shoulderY + ey * length] as const,
    hand: [shoulderX + side * hx * length, shoulderY + hy * length] as const,
  }
}

function Face({ r, expression, glasses, beard, hair }: { r: number; expression: Expression; glasses?: boolean; beard?: boolean; hair: string }) {
  const eyeY = -r * .08
  const eyeX = r * .38
  const eyes = expression === 'sleep'
    ? <path d={`M${-eyeX - 4} ${eyeY} q4 3 8 0 M${eyeX - 4} ${eyeY} q4 3 8 0`} fill="none" {...outline(1.8)} />
    : (
      <g fill={INK}>
        <ellipse cx={-eyeX} cy={eyeY} rx="2.2" ry={expression === 'surprised' ? 3.4 : 2.7} />
        <ellipse cx={eyeX} cy={eyeY} rx="2.2" ry={expression === 'surprised' ? 3.4 : 2.7} />
        <circle cx={-eyeX + .8} cy={eyeY - 1} r=".7" fill="#fff" />
        <circle cx={eyeX + .8} cy={eyeY - 1} r=".7" fill="#fff" />
      </g>
    )
  const brows = expression === 'worried' || expression === 'sad'
    ? <path d={`M${-eyeX - 5} ${eyeY - 5} L${-eyeX + 4} ${eyeY - 8} M${eyeX + 5} ${eyeY - 5} L${eyeX - 4} ${eyeY - 8}`} fill="none" {...outline(1.6, hair)} />
    : expression === 'surprised'
      ? <path d={`M${-eyeX - 4} ${eyeY - 8} q4 -3 8 0 M${eyeX - 4} ${eyeY - 8} q4 -3 8 0`} fill="none" {...outline(1.6, hair)} />
      : null
  const mouthY = r * .42
  const mouth = {
    smile: `M-4 ${mouthY} q4 3.5 8 0`,
    happy: `M-5.5 ${mouthY - 1} q5.5 7 11 0 z`,
    worried: `M-3.5 ${mouthY + 1.5} q3.5 -2.5 7 0`,
    sad: `M-4 ${mouthY + 2} q4 -4 8 0`,
    calm: `M-3 ${mouthY + .5} h6`,
    sleep: `M-2.5 ${mouthY + .5} q2.5 1.6 5 0`,
    surprised: '',
    talk: `M-4 ${mouthY - .5} q4 5 8 0 z`,
  }[expression]
  return (
    <g>
      {eyes}
      {brows}
      {expression === 'surprised'
        ? <ellipse cx="0" cy={mouthY + 1} rx="2.6" ry="3.4" fill="#7a2f33" />
        : <path d={mouth} fill={expression === 'happy' || expression === 'talk' ? '#8e3a3d' : 'none'} {...outline(1.7)} />}
      <circle cx={-r * .58} cy={r * .28} r={r * .2} fill="#e98f84" opacity=".35" />
      <circle cx={r * .58} cy={r * .28} r={r * .2} fill="#e98f84" opacity=".35" />
      {beard && <path d={`M${-r * .82} ${-r * .05} C${-r * .8} ${r * 1.02} ${r * .8} ${r * 1.02} ${r * .82} ${-r * .05} C${r * .5} ${r * .5} ${-r * .5} ${r * .5} ${-r * .82} ${-r * .05}Z`} fill={hair} opacity=".9" />}
      {beard && <path d={`M-4 ${mouthY - 1} q4 2.5 8 0`} fill="none" {...outline(1.5, '#f3e1cf')} />}
      {glasses && (
        <g fill="none" {...outline(1.6)}>
          <circle cx={-eyeX} cy={eyeY} r="5.6" />
          <circle cx={eyeX} cy={eyeY} r="5.6" />
          <path d={`M${-eyeX + 5.6} ${eyeY} H${eyeX - 5.6}`} />
        </g>
      )}
    </g>
  )
}

function HairBack({ style, r, color }: { style: HairStyle; r: number; color: string }) {
  switch (style) {
    case 'long':
      return <path d={`M${-r * 1.05} ${-r * .2} C${-r * 1.2} ${r * 1.3} ${-r * .9} ${r * 2.1} ${-r * .5} ${r * 2.2} L${r * .5} ${r * 2.2} C${r * .9} ${r * 2.1} ${r * 1.2} ${r * 1.3} ${r * 1.05} ${-r * .2}Z`} fill={color} />
    case 'bob':
      return <path d={`M${-r * 1.08} ${-r * .3} C${-r * 1.18} ${r * .7} ${-r * .9} ${r * 1.1} ${-r * .6} ${r * 1.05} L${r * .6} ${r * 1.05} C${r * .9} ${r * 1.1} ${r * 1.18} ${r * .7} ${r * 1.08} ${-r * .3}Z`} fill={color} />
    case 'ponytail':
      return (
        <g>
          <path d={`M${r * .7} ${-r * .55} C${r * 1.9} ${-r * .6} ${r * 2.1} ${r * .6} ${r * 1.55} ${r * 1.5} C${r * 1.4} ${r * .7} ${r * 1.2} ${r * .1} ${r * .7} ${-r * .05}Z`} fill={color} />
          <circle cx={r * .95} cy={-r * .42} r={r * .2} fill={CRIMSON} />
        </g>
      )
    case 'scarf':
      return <path d={`M${-r * 1.28} ${-r * .1} C${-r * 1.35} ${r * 1.4} ${-r * .8} ${r * 1.9} 0 ${r * 1.95} C${r * .8} ${r * 1.9} ${r * 1.35} ${r * 1.4} ${r * 1.28} ${-r * .1}Z`} fill={color} />
    default:
      return null
  }
}

function HairFront({ style, r, color }: { style: HairStyle; r: number; color: string }) {
  switch (style) {
    case 'ponytail':
    case 'long':
    case 'bob':
      return <path d={`M${-r * 1.06} ${-r * .02} C${-r * 1.1} ${-r * 1.2} ${r * 1.1} ${-r * 1.3} ${r * 1.06} ${-r * .06} C${r * .6} ${-r * .5} ${r * .1} ${-r * .72} ${-r * .15} ${-r * .5} C${-r * .45} ${-r * .72} ${-r * .8} ${-r * .5} ${-r * 1.06} ${-r * .02}Z`} fill={color} />
    case 'bun':
      return (
        <g fill={color}>
          <circle cx="0" cy={-r * 1.12} r={r * .5} />
          <path d={`M${-r * 1.04} ${-r * .05} C${-r * 1.05} ${-r * 1.25} ${r * 1.05} ${-r * 1.25} ${r * 1.04} ${-r * .05} C${r * .5} ${-r * .62} ${-r * .5} ${-r * .62} ${-r * 1.04} ${-r * .05}Z`} />
        </g>
      )
    case 'short':
      return <path d={`M${-r * 1.02} ${-r * .12} C${-r * 1.08} ${-r * 1.28} ${r * 1.08} ${-r * 1.28} ${r * 1.02} ${-r * .12} C${r * .7} ${-r * .6} ${-r * .3} ${-r * .78} ${-r * 1.02} ${-r * .12}Z`} fill={color} />
    case 'curly':
      return (
        <g fill={color}>
          {[[-.8, -.5], [-.45, -.9], [0, -1.02], [.45, -.9], [.8, -.5], [-.95, -.05], [.95, -.05]].map(([cx, cy], index) => (
            <circle key={index} cx={cx * r} cy={cy * r} r={r * .36} />
          ))}
        </g>
      )
    case 'bald':
      return <path d={`M${-r * 1.02} ${-r * .05} C${-r * 1.02} ${-r * .5} ${-r * .8} ${-r * .6} ${-r * .66} ${-r * .55} M${r * 1.02} ${-r * .05} C${r * 1.02} ${-r * .5} ${r * .8} ${-r * .6} ${r * .66} ${-r * .55}`} fill="none" stroke={color} strokeWidth={r * .3} strokeLinecap="round" />
    case 'scarf':
      return <path d={`M${-r * 1.16} ${r * .2} C${-r * 1.3} ${-r * 1.5} ${r * 1.3} ${-r * 1.5} ${r * 1.16} ${r * .2} C${r * .9} ${-r * .55} ${-r * .9} ${-r * .55} ${-r * 1.16} ${r * .2}Z`} fill={color} />
    case 'cap':
      return (
        <g>
          <path d={`M${-r * 1.04} ${-r * .2} C${-r * 1.04} ${-r * 1.3} ${r * 1.04} ${-r * 1.3} ${r * 1.04} ${-r * .2}Z`} fill={color} />
          <path d={`M${r * .2} ${-r * .28} H${r * 1.7} C${r * 1.7} ${-r * .08} ${r * .4} ${-r * .06} ${r * .2} ${-r * .28}Z`} fill={color} />
        </g>
      )
  }
}

function HeldItem({ item, x, y, accent }: { item: Item; x: number; y: number; accent: string }) {
  const g = (children: ReactNode) => <g transform={`translate(${x} ${y})`}>{children}</g>
  switch (item) {
    case 'book':
      return g(<>
        <rect x="-11" y="-14" width="22" height="28" rx="2.5" fill={CRIMSON} {...outline(2)} />
        <path d="M-7 -14 V14" stroke="#8d1a36" strokeWidth="2" />
        <rect x="-3" y="-8" width="10" height="3" rx="1" fill="#f4d7a1" opacity=".8" />
      </>)
    case 'photo':
      return g(<>
        <rect x="-13" y="-16" width="26" height="30" rx="2" fill={PAPER} {...outline(2)} />
        <circle cx="0" cy="-4" r="6" fill="#232220" />
        <path d="M-5 -8 l1 -6 3 4M5 -8 l-1 -6 -3 4" fill="#232220" />
        <path d="M-8 8 q8 -8 16 0" fill="#232220" />
        <circle cx="-2" cy="-5" r="1" fill="#9ad36f" /><circle cx="2.4" cy="-5" r="1" fill="#9ad36f" />
      </>)
    case 'paper':
      return g(<>
        <path d="M-12 -16 H10 L14 -12 V16 H-12Z" fill={PAPER} {...outline(2)} />
        <path d="M-7 -8 H8 M-7 -2 H8 M-7 4 H4" stroke="#8a8378" strokeWidth="1.6" strokeLinecap="round" />
      </>)
    case 'map':
      return g(<>
        <path d="M-18 -12 L-6 -16 L6 -12 L18 -16 V12 L6 16 L-6 12 L-18 16Z" fill="#efe1bf" {...outline(2)} />
        <path d="M-6 -16 V12 M6 -12 V16" stroke="#b8a57c" strokeWidth="1.5" />
        <path d="M-12 4 C-4 -6 4 6 12 -6" fill="none" stroke={CRIMSON} strokeWidth="2" strokeDasharray="3 3" />
      </>)
    case 'flashlight':
      return g(<>
        <path d="M4 -4 L60 -26 L60 26 L4 4Z" fill="#fff4c4" opacity=".45" />
        <rect x="-12" y="-5" width="18" height="10" rx="2" fill="#3f4a5a" {...outline(1.8)} />
        <rect x="4" y="-7" width="6" height="14" rx="1.5" fill="#c9cfd6" {...outline(1.8)} />
      </>)
    case 'basket':
      return g(<>
        <path d="M-16 -18 C-16 -34 16 -34 16 -18" fill="none" {...outline(2.2, '#8a5a3b')} />
        <path d="M-20 -18 H20 L15 4 H-15Z" fill="#c9985f" {...outline(2)} />
        <circle cx="-6" cy="-20" r="5" fill="#c4413f" /><circle cx="5" cy="-21" r="5" fill="#e59a3b" />
        <path d="M-14 -10 H14 M-12 -3 H12" stroke="#a87844" strokeWidth="1.6" />
      </>)
    case 'umbrella':
      return g(<>
        <path d="M0 0 V-58" {...outline(2.4)} />
        <path d="M0 22 V0 q0 6 -6 6" fill="none" {...outline(2.4)} />
        <path d="M-44 -54 C-40 -84 40 -84 44 -54 C36 -60 28 -60 22 -54 C14 -60 6 -60 0 -54 C-6 -60 -14 -60 -22 -54 C-28 -60 -36 -60 -44 -54Z" fill={accent} {...outline(2.2)} />
      </>)
    case 'phone':
      return g(<>
        <path d="M-8 -12 C-14 -6 -14 6 -8 12 L-4 8 C-7 4 -7 -4 -4 -8Z" fill="#2c2b29" {...outline(1.6)} />
      </>)
    case 'pen':
      return g(<path d="M-2 10 L8 -14 L12 -12 L2 12Z" fill={CRIMSON} {...outline(1.6)} />)
    case 'bag':
      return g(<>
        <path d="M-8 -14 C-8 -24 8 -24 8 -14" fill="none" {...outline(2)} />
        <path d="M-14 -14 H14 L12 12 H-12Z" fill={accent} {...outline(2)} />
      </>)
    case 'cup':
      return g(<>
        <path d="M-7 -8 H7 L5 8 H-5Z" fill="#fff" {...outline(1.8)} />
        <path d="M7 -4 C12 -4 12 3 6 3" fill="none" {...outline(1.6)} />
      </>)
    case 'bread':
      return g(<>
        <path d="M-16 4 C-18 -10 18 -10 16 4Z" fill="#d49a55" {...outline(1.8)} />
        <path d="M-8 -3 l3 -3 M0 -4 l3 -3 M8 -3 l3 -3" stroke="#a86d33" strokeWidth="1.6" strokeLinecap="round" />
      </>)
    case 'ball':
      return g(<>
        <circle cx="0" cy="0" r="10" fill="#d9453f" {...outline(1.8)} />
        <path d="M-9 -3 C-3 0 3 0 9 -3" fill="none" stroke="#fff" strokeWidth="1.6" />
      </>)
    case 'toy':
      return g(<>
        <ellipse cx="0" cy="2" rx="10" ry="7" fill="#c9c1b4" {...outline(1.6)} />
        <circle cx="-8" cy="-2" r="3" fill="#c9c1b4" {...outline(1.4)} />
        <path d="M10 3 C18 3 18 -6 12 -8" fill="none" {...outline(1.4)} />
      </>)
    case 'key':
      return g(<>
        <circle cx="-6" cy="0" r="5" fill="none" {...outline(2.2, '#b58a3a')} />
        <path d="M-1 0 H12 M8 0 V4 M11 0 V4" fill="none" {...outline(2.2, '#b58a3a')} />
      </>)
    case 'suitcase':
      return g(<>
        <rect x="-18" y="-6" width="36" height="30" rx="4" fill={accent} {...outline(2)} />
        <path d="M-7 -6 V-12 H7 V-6" fill="none" {...outline(2)} />
        <path d="M-18 8 H18" stroke="#00000033" strokeWidth="2" />
      </>)
    case 'stethoscope':
      return null
  }
}

export function Figure({
  x,
  y,
  s = 1,
  flip = false,
  build = 'adult',
  skin = '#eec29d',
  hair = '#3b2a22',
  hairStyle = 'short',
  top = '#6d7f95',
  bottom = '#3f4552',
  outfit = 'pants',
  legs,
  shoes = '#5a3a2c',
  arms = ['down', 'down'],
  pose = 'stand',
  expression = 'smile',
  holding,
  glasses,
  beard,
  apron,
  collar,
  coat,
  hat,
  accent = CRIMSON,
  shadow = true,
}: FigureProps) {
  // Visual policy: every female-coded hairstyle in this storybook is rendered as a contemporary hijab.
  // Male presets use short/curly/bald/cap styles, so this keeps every girl/woman covered even in one-off scenes.
  const coveredHairStyle: HairStyle = ['ponytail', 'bun', 'long', 'bob'].includes(hairStyle) ? 'scarf' : hairStyle
  const geo = GEOMETRY[build]
  const drop = pose === 'kneel' ? -geo.waist * .36 : pose === 'sit' ? -geo.waist * .3 : 0
  const legColor = legs ?? (outfit === 'pants' || outfit === 'coat' ? bottom : skin)
  const hipY = (outfit === 'dress' || outfit === 'skirt' ? geo.hem + 4 : geo.waist + 6) + drop
  const limb = geo.limb

  const legPaths = (() => {
    const h = geo.hip
    if (pose === 'walk') return [`M${-h} ${hipY} L${-h - 9} ${-geo.waist * .02} L${-h - 16} 0`, `M${h} ${hipY} L${h + 6} ${-geo.waist * .08} L${h + 14} -2`]
    if (pose === 'kneel') return [`M${-h} ${hipY} L${-h - 5} -5`, `M${h} ${hipY} L${h + 5} -5`]
    if (pose === 'sit') return [`M${-h} ${hipY} L${-h - 2} ${hipY + 8} L${-h - 3} 0`, `M${h} ${hipY} L${h + 2} ${hipY + 8} L${h + 3} 0`]
    return [`M${-h} ${hipY} L${-h - 1} 0`, `M${h} ${hipY} L${h + 1} 0`]
  })()
  const feet = pose === 'walk'
    ? [[-geo.hip - 18, 0], [geo.hip + 17, -2]]
    : pose === 'kneel'
      ? [[-geo.hip - 7, -1], [geo.hip + 7, -1]]
      : [[-geo.hip - 3, 0], [geo.hip + 3, 0]]

  const shoulderY = geo.shoulder + drop
  const waistY = geo.waist + drop
  const hemY = geo.hem + drop
  const headY = geo.head + drop
  const sw = geo.sw
  const left = armPoints(-1, arms[0], -sw + 3, shoulderY + 4, geo.arm)
  const right = armPoints(1, arms[1], sw - 3, shoulderY + 4, geo.arm)
  const handFor = holding?.hand === 'left' ? left.hand : right.hand
  const garment = coat ?? top

  const torso = outfit === 'dress'
    ? `M${-sw + 2} ${shoulderY} C${-sw - 4} ${shoulderY + 4} ${-sw - 2} ${waistY - 10} ${-sw + 3} ${waistY} L${-sw - 10} ${hemY} L${sw + 10} ${hemY} L${sw - 3} ${waistY} C${sw + 2} ${waistY - 10} ${sw + 4} ${shoulderY + 4} ${sw - 2} ${shoulderY}Z`
    : outfit === 'coat'
      ? `M${-sw + 2} ${shoulderY} C${-sw - 5} ${shoulderY + 4} ${-sw - 4} ${waistY} ${-sw - 3} ${waistY + (hemY - waistY) * .5} L${sw + 3} ${waistY + (hemY - waistY) * .5} C${sw + 4} ${waistY} ${sw + 5} ${shoulderY + 4} ${sw - 2} ${shoulderY}Z`
      : `M${-sw + 2} ${shoulderY} C${-sw - 4} ${shoulderY + 4} ${-sw - 3} ${waistY - 8} ${-sw + 1} ${waistY + 4} L${sw - 1} ${waistY + 4} C${sw + 3} ${waistY - 8} ${sw + 4} ${shoulderY + 4} ${sw - 2} ${shoulderY}Z`

  const armStroke = (points: typeof left) =>
    `M${points === left ? -sw + 3 : sw - 3} ${shoulderY + 4} L${points.elbow[0]} ${points.elbow[1]} L${points.hand[0]} ${points.hand[1]}`

  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {shadow && <Shadow x={0} y={0} rx={geo.sw * 1.9} />}
      {/* umbrella and long hair sit behind the body */}
      {holding?.item === 'umbrella' && <HeldItem item="umbrella" x={handFor[0]} y={handFor[1]} accent={accent} />}
      <g transform={`translate(0 ${headY})`}><HairBack style={coveredHairStyle} r={geo.headR} color={hair} /></g>

      {legPaths.map((d, index) => <path key={index} d={d} fill="none" stroke={legColor} strokeWidth={limb + 1} strokeLinecap="round" strokeLinejoin="round" />)}
      {legPaths.map((d, index) => <path key={`o${index}`} d={d} fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" opacity=".25" />)}
      {feet.map(([fx, fy], index) => <ellipse key={index} cx={fx + (index === 0 ? -2 : 2)} cy={fy - 2} rx={limb * .85} ry={limb * .5} fill={shoes} />)}

      {outfit === 'skirt' && <path d={`M${-sw + 1} ${waistY} L${-sw - 9} ${hemY} L${sw + 9} ${hemY} L${sw - 1} ${waistY}Z`} fill={bottom} {...outline(2)} />}
      {outfit === 'shorts' && <path d={`M${-sw + 1} ${waistY} L${-sw - 2} ${waistY + 22} L-1 ${waistY + 22} L0 ${waistY + 10} L1 ${waistY + 22} L${sw + 2} ${waistY + 22} L${sw - 1} ${waistY}Z`} fill={bottom} {...outline(2)} />}
      {(outfit === 'pants' || outfit === 'coat') && <path d={`M${-sw + 1} ${waistY} L${-geo.hip - limb * .6} ${waistY + 14} L${geo.hip + limb * .6} ${waistY + 14} L${sw - 1} ${waistY}Z`} fill={bottom} />}

      <path d={torso} fill={garment} {...outline(2)} />
      {collar && <path d={`M-9 ${shoulderY - 1} L0 ${shoulderY + 8} L9 ${shoulderY - 1}`} fill={collar} {...outline(1.6)} />}
      {apron && <path d={`M-12 ${shoulderY + 12} H12 L15 ${waistY + 30} H-15Z`} fill={apron} {...outline(1.6)} opacity=".95" />}
      {outfit === 'coat' && <path d={`M0 ${shoulderY + 6} V${waistY + (hemY - waistY) * .5}`} stroke={INK} strokeWidth="1.6" opacity=".45" />}
      {holding?.item === 'stethoscope' && <path d={`M-9 ${shoulderY + 2} C-12 ${shoulderY + 30} 12 ${shoulderY + 30} 9 ${shoulderY + 2} M0 ${shoulderY + 24} V${shoulderY + 36}`} fill="none" {...outline(2.2, '#4a5560')} />}

      {[left, right].map((points, index) => (
        <g key={index}>
          <path d={armStroke(points)} fill="none" stroke={garment} strokeWidth={limb} strokeLinecap="round" strokeLinejoin="round" />
          <path d={armStroke(points)} fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" opacity=".22" />
          <circle cx={points.hand[0]} cy={points.hand[1]} r={limb * .56} fill={skin} />
        </g>
      ))}

      <g transform={`translate(0 ${headY})`}>
        <rect x="-4" y={geo.headR - 4} width="8" height="8" fill={skin} />
        <circle cx={-geo.headR} cy="2" r="3.4" fill={skin} />
        <circle cx={geo.headR} cy="2" r="3.4" fill={skin} />
        <circle cx="0" cy="0" r={geo.headR} fill={skin} {...outline(1.6)} />
        <Face r={geo.headR} expression={expression} glasses={glasses} beard={beard} hair={hair} />
        <HairFront style={coveredHairStyle} r={geo.headR} color={hair} />
        {hat && (
          <g>
            <ellipse cx="0" cy={-geo.headR * .62} rx={geo.headR * 1.45} ry={geo.headR * .3} fill={hat} {...outline(1.6)} />
            <path d={`M${-geo.headR * .8} ${-geo.headR * .7} C${-geo.headR * .8} ${-geo.headR * 1.6} ${geo.headR * .8} ${-geo.headR * 1.6} ${geo.headR * .8} ${-geo.headR * .7}Z`} fill={hat} {...outline(1.6)} />
          </g>
        )}
      </g>

      {holding && holding.item !== 'umbrella' && holding.item !== 'stethoscope' && <HeldItem item={holding.item} x={handFor[0]} y={handFor[1]} accent={accent} />}
    </g>
  )
}

/** Places a person preset from ./cast (Mina, Mom, …) with per-scene overrides. */
export function Cast({ who, x, y, ...overrides }: { who: Person; x: number; y: number } & Partial<FigureProps>) {
  return <Figure {...who} {...overrides} x={x} y={y} />
}

export function Baby({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-20 0 C-22 -22 22 -22 20 0Z" fill="#f1d6c8" {...outline(1.8)} />
      <circle cx="0" cy="-28" r="13" fill="#f0c9a6" {...outline(1.6)} />
      <path d="M-6 -39 q6 -6 12 0" fill="none" {...outline(1.6, '#4a2f25')} />
      <circle cx="-4.5" cy="-29" r="1.8" fill={INK} /><circle cx="4.5" cy="-29" r="1.8" fill={INK} />
      <circle cx="-8" cy="-24" r="2.6" fill="#e98f84" opacity=".4" /><circle cx="8" cy="-24" r="2.6" fill="#e98f84" opacity=".4" />
      <path d="M-2 -22 q2 1.6 4 0" fill="none" {...outline(1.4)} />
    </g>
  )
}

/* ---------- Cats and birds ---------- */

export type CatPose = 'sit' | 'walk' | 'leap' | 'sleep' | 'loaf'

export interface CatProps {
  x: number
  y: number
  s?: number
  flip?: boolean
  pose?: CatPose
  coat?: string
  shade?: string
  eyes?: string
  /** Optional identifying facial mark for ordinary cat illustrations. */
  mark?: boolean
  collar?: string
  rim?: string
  stripes?: string
}

const NINO_COAT = '#242321'
const NINO_SHADE = '#141312'
export const NINO_EYES = '#8fd16f'

function CatHead({ coat, shade, eyes, mark, rim, closed }: { coat: string; shade: string; eyes: string; mark?: boolean; rim?: string; closed?: boolean }) {
  return (
    <g>
      <path d="M-22 -8 L-20 -34 L-4 -20Z" fill={coat} stroke={rim} strokeWidth={rim ? 2 : 0} strokeLinejoin="round" />
      <path d="M22 -8 L20 -34 L4 -20Z" fill={coat} stroke={rim} strokeWidth={rim ? 2 : 0} strokeLinejoin="round" />
      <path d="M-18 -12 L-17 -27 L-8 -19Z" fill="#5c3e45" />
      <path d="M18 -12 L17 -27 L8 -19Z" fill="#5c3e45" />
      <ellipse cx="0" cy="-4" rx="24" ry="21" fill={coat} stroke={rim} strokeWidth={rim ? 2 : 0} />
      {mark && <path d="M9 -22 C15 -26 21 -22 21 -16 C17 -19 13 -19 9 -22Z" fill="#f4eee4" />}
      {closed ? (
        <path d="M-15 -4 q5 4 10 0 M5 -4 q5 4 10 0" fill="none" stroke={eyes} strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <g>
          <ellipse cx="-9.5" cy="-5" rx="5.6" ry="6.4" fill={eyes} />
          <ellipse cx="9.5" cy="-5" rx="5.6" ry="6.4" fill={eyes} />
          <ellipse cx="-9.5" cy="-5" rx="1.7" ry="5" fill={shade} />
          <ellipse cx="9.5" cy="-5" rx="1.7" ry="5" fill={shade} />
          <circle cx="-8" cy="-8" r="1.5" fill="#fff" />
          <circle cx="11" cy="-8" r="1.5" fill="#fff" />
        </g>
      )}
      <path d="M-3 4 H3 L0 7.5Z" fill="#e39aa2" />
      <path d="M-6 9 q3 2 6 0 q3 2 6 0" fill="none" stroke="#6a6560" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M-8 6 L-26 3 M-8 8 L-25 10 M8 6 L26 3 M8 8 L25 10" stroke="#8d8880" strokeWidth="1" strokeLinecap="round" opacity=".7" />
    </g>
  )
}

export function Cat({ x, y, s = 1, flip = false, pose = 'sit', coat = NINO_COAT, shade = NINO_SHADE, eyes = NINO_EYES, mark = false, collar, rim, stripes }: CatProps) {
  const rimProps = rim ? { stroke: rim, strokeWidth: 2 } : {}
  const body = (() => {
    switch (pose) {
      case 'sit':
        return (
          <g>
            <Shadow x={0} y={0} rx={34} />
            <path d="M22 -6 C52 -4 60 -34 44 -52 C40 -56 34 -52 38 -48 C48 -34 42 -16 20 -16" fill={coat} {...rimProps} />
            <path d="M-26 0 C-34 -26 -26 -58 0 -62 C26 -58 34 -26 26 0Z" fill={coat} {...rimProps} />
            {stripes && <path d="M-22 -34 q10 4 18 0 M-24 -22 q12 5 22 0 M6 -40 q8 3 16 -2" fill="none" stroke={stripes} strokeWidth="3" strokeLinecap="round" />}
            <path d="M-12 0 C-12 -10 -10 -20 -8 -24 M12 0 C12 -10 10 -20 8 -24" fill="none" stroke={shade} strokeWidth="3" strokeLinecap="round" opacity=".6" />
            <ellipse cx="-10" cy="-2" rx="7" ry="4" fill={coat} />
            <ellipse cx="10" cy="-2" rx="7" ry="4" fill={coat} />
            {collar && <path d="M-16 -56 C-6 -50 6 -50 16 -56" fill="none" stroke={collar} strokeWidth="5" strokeLinecap="round" />}
            {collar && <circle cx="0" cy="-49" r="4" fill="#e9c35a" stroke={INK} strokeWidth="1.2" />}
            <g transform="translate(0 -72)"><CatHead coat={coat} shade={shade} eyes={eyes} mark={mark} rim={rim} /></g>
          </g>
        )
      case 'loaf':
        return (
          <g>
            <Shadow x={0} y={0} rx={40} />
            <path d="M-38 0 C-40 -26 -10 -36 18 -32 C40 -28 44 -8 40 0Z" fill={coat} {...rimProps} />
            <path d="M38 -6 C56 -6 60 -18 52 -24" fill="none" stroke={coat} strokeWidth="8" strokeLinecap="round" />
            <g transform="translate(-26 -34) scale(.92)"><CatHead coat={coat} shade={shade} eyes={eyes} mark={mark} rim={rim} /></g>
          </g>
        )
      case 'sleep':
        return (
          <g>
            <Shadow x={0} y={0} rx={42} />
            <path d="M-40 0 C-44 -30 -10 -40 18 -34 C44 -28 48 -6 40 0Z" fill={coat} {...rimProps} />
            <path d="M40 -2 C48 10 10 12 -20 6" fill="none" stroke={coat} strokeWidth="9" strokeLinecap="round" />
            <g transform="translate(-22 -22) scale(.8) rotate(-12)"><CatHead coat={coat} shade={shade} eyes={eyes} mark={mark} rim={rim} closed /></g>
          </g>
        )
      case 'walk':
      case 'leap': {
        const leap = pose === 'leap'
        return (
          <g transform={leap ? 'rotate(-14)' : undefined}>
            {!leap && <Shadow x={0} y={0} rx={44} />}
            <path d={leap ? 'M40 -40 C66 -52 74 -78 60 -92' : 'M38 -34 C62 -40 68 -66 56 -80'} fill="none" stroke={coat} strokeWidth="9" strokeLinecap="round" />
            <path d="M-34 -30 C-36 -52 30 -56 42 -36 C46 -24 40 -16 30 -16 L-26 -16 C-34 -16 -34 -24 -34 -30Z" fill={coat} {...rimProps} />
            {stripes && <path d="M-10 -48 q4 10 0 20 M4 -50 q4 10 0 22 M18 -48 q4 10 0 20" fill="none" stroke={stripes} strokeWidth="3" strokeLinecap="round" />}
            <path d={leap ? 'M-22 -22 L-40 -6 M-12 -20 L-30 -2 M28 -20 L50 -4 M36 -22 L58 -12' : 'M-22 -20 L-26 0 M-10 -18 L-4 0 M26 -18 L20 0 M36 -20 L42 0'} fill="none" stroke={coat} strokeWidth="7.5" strokeLinecap="round" />
            {collar && <path d="M-30 -48 C-24 -38 -26 -30 -32 -24" fill="none" stroke={collar} strokeWidth="5" strokeLinecap="round" />}
            <g transform="translate(-42 -52) scale(.9)"><CatHead coat={coat} shade={shade} eyes={eyes} mark={mark} rim={rim} /></g>
          </g>
        )
      }
    }
  })()
  return <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>{body}</g>
}

export const NINO_FEATHERS = '#f3c84b'
export const NINO_WING = '#dfad32'
export const NINO_BEAK = '#e8892f'
export const NINO_COMB = '#cf4d4d'
export const NINO_MARK = '#f7f3e8'

export interface ChickenProps {
  x: number
  y: number
  s?: number
  flip?: boolean
  pose?: CatPose
  feathers?: string
  wing?: string
  beak?: string
  comb?: string
  mark?: boolean
  rim?: string
}

export function Chicken({
  x, y, s = 1, flip = false, pose = 'sit',
  feathers = NINO_FEATHERS, wing = NINO_WING, beak = NINO_BEAK, comb = NINO_COMB,
  mark = false, rim,
}: ChickenProps) {
  const leap = pose === 'leap'
  const sleep = pose === 'sleep'
  const squash = pose === 'loaf' ? .9 : 1
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s}) ${leap ? 'rotate(-12)' : ''}`}>
      {!leap && <Shadow x={0} y={0} rx={30} />}
      <path d={leap ? 'M-12 -4 L-22 10 M10 -4 L20 10' : 'M-10 -2 L-10 12 M10 -2 L10 12'} stroke={beak} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M-15 12 H-6 M6 12 H15" stroke={beak} strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="0" cy="-26" rx="29" ry={26 * squash} fill={feathers} stroke={rim ?? INK} strokeWidth={rim ? 2 : 1.8} />
      <path d="M-18 -30 C-30 -30 -32 -12 -16 -8 C-5 -10 0 -20 -2 -28Z" fill={wing} {...outline(1.4)} />
      {mark && <path d="M-22 -28 C-26 -22 -24 -14 -18 -12 C-15 -18 -15 -24 -22 -28Z" fill={NINO_MARK} opacity=".98" />}
      <circle cx="8" cy="-52" r="19" fill={feathers} stroke={rim ?? INK} strokeWidth={rim ? 2 : 1.8} />
      <path d="M8 -72 C4 -79 10 -84 15 -77 C16 -84 23 -84 23 -75 C28 -79 33 -73 27 -67Z" fill={comb} {...outline(1.2)} />
      <path d="M25 -52 L40 -46 L25 -41Z" fill={beak} {...outline(1.2)} />
      {sleep
        ? <path d="M0 -53 q5 4 10 0" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
        : <><circle cx="5" cy="-54" r="3.1" fill={INK} /><circle cx="6" cy="-55" r=".8" fill="#fff" /></>}
      <path d="M24 -37 q5 5 10 0" fill="none" stroke={comb} strokeWidth="2.6" strokeLinecap="round" />
      {leap && <path d="M-22 -34 C-42 -46 -42 -18 -18 -14" fill={wing} {...outline(1.4)} />}
    </g>
  )
}

/** Nino: a tiny yellow chicken with an orange beak and one white feather on his left wing. */
export function Nino(props: Omit<ChickenProps, 'feathers' | 'wing' | 'beak' | 'comb' | 'mark'>) {
  return <Chicken {...props} mark />
}

export function Bird({ x, y, s = 1, flip = false, color = CRIMSON, flying = false }: { x: number; y: number; s?: number; flip?: boolean; color?: string; flying?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {flying ? (
        <g>
          <path d="M-4 -2 C-14 -26 -34 -26 -40 -18 C-26 -16 -16 -8 -8 4Z" fill={color} {...outline(1.6)} />
          <ellipse cx="0" cy="2" rx="16" ry="9" fill={color} {...outline(1.6)} />
          <path d="M2 -2 C10 -24 28 -28 36 -22 C24 -16 16 -6 10 4Z" fill={color} {...outline(1.6)} />
          <circle cx="14" cy="-2" r="7" fill={color} {...outline(1.4)} />
          <path d="M20 -3 L28 -1 L20 1Z" fill={GOLDEN_BEAK} />
          <circle cx="16" cy="-4" r="1.3" fill={INK} />
          <path d="M-16 2 L-26 -2 L-24 8Z" fill={color} {...outline(1.4)} />
        </g>
      ) : (
        <g>
          <path d="M-12 4 L-24 12 L-18 2Z" fill={color} {...outline(1.4)} />
          <ellipse cx="0" cy="0" rx="15" ry="11" fill={color} {...outline(1.6)} />
          <path d="M-8 -2 C0 -12 10 -8 10 2 C2 4 -4 4 -8 -2Z" fill="#fff" opacity=".28" />
          <circle cx="11" cy="-10" r="8" fill={color} {...outline(1.4)} />
          <path d="M18 -11 L27 -9 L18 -6Z" fill={GOLDEN_BEAK} {...outline(1)} />
          <circle cx="13" cy="-12" r="1.4" fill={INK} />
          <path d="M-2 10 L-4 18 M4 10 L4 18" {...outline(1.6)} />
        </g>
      )}
    </g>
  )
}

const GOLDEN_BEAK = '#e9b44c'

/** Distant birds as simple strokes. */
export function Flock({ x, y, count = 5, s = 1, color = INK }: { x: number; y: number; count?: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity=".7">
      {Array.from({ length: count }, (_, index) => {
        const bx = (index % 3) * 34 + index * 9
        const by = (index % 2) * 16 - index * 5
        return <path key={index} d={`M${bx - 9} ${by} q5 -6 9 0 q4 -6 9 0`} />
      })}
    </g>
  )
}

export function Dog({ x, y, s = 1, flip = false, coat = '#d9b98a', ear = '#9a6b47' }: { x: number; y: number; s?: number; flip?: boolean; coat?: string; ear?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <Shadow x={0} y={0} rx={36} />
      <path d="M26 -30 C38 -40 40 -52 34 -58" fill="none" stroke={coat} strokeWidth="7" strokeLinecap="round" />
      <path d="M-24 -2 V-22 M-12 -2 V-22 M14 -2 V-22 M24 -2 V-22" stroke={coat} strokeWidth="8" strokeLinecap="round" />
      <rect x="-32" y="-44" width="64" height="28" rx="14" fill={coat} {...outline(1.8)} />
      <circle cx="-34" cy="-50" r="16" fill={coat} {...outline(1.8)} />
      <ellipse cx="-46" cy="-46" rx="8" ry="6" fill={coat} {...outline(1.6)} />
      <circle cx="-52" cy="-47" r="2.6" fill={INK} />
      <circle cx="-36" cy="-54" r="2.2" fill={INK} />
      <path d="M-26 -62 C-14 -60 -14 -42 -22 -38 C-26 -46 -28 -54 -26 -62Z" fill={ear} {...outline(1.4)} />
      <path d="M-40 -36 C-40 -30 -34 -30 -34 -36" fill={CRIMSON} />
    </g>
  )
}

/** A seated classmate. */
export function Student({ x, y, top, hair = '#2c1d17', style = 'short' as const, skin = '#e9bb95' }: { x: number; y: number; top: string; hair?: string; style?: 'short' | 'bob' | 'curly' | 'ponytail'; skin?: string }) {
  return <Figure build="child" x={x} y={y} skin={skin} hair={hair} hairStyle={style} top={top} bottom="#3d4a5c" pose="sit" arms={['hold', 'hold']} expression="smile" shadow={false} s={.9} />
}
