import type { ReactNode } from 'react'
import { CHAPTER_ART, type ChapterMotif } from '../data/chapterArt'

interface Props {
  chapterId: string
  titleFa: string
  tint: string
}

interface MotifProps {
  kind: ChapterMotif
  x: number
  y: number
  scale?: number
  accent: string
  secondary: string
  ink: string
  paper: string
}

function Motif({ kind, x, y, scale = 1, accent, secondary, ink, paper }: MotifProps) {
  const common = { stroke: ink, strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const g = (children: ReactNode) => <g transform={`translate(${x} ${y}) scale(${scale})`}>{children}</g>

  switch (kind) {
    case 'cat':
      return g(<>
        <ellipse cx="4" cy="18" rx="44" ry="25" fill={accent} {...common} />
        <circle cx="-28" cy="-14" r="24" fill={accent} {...common} />
        <path d="M-47-29 -39-55 -24-35M-9-31 -4-54 9-31" fill={accent} {...common} />
        <path d="M47 10 C80-4 82-38 58-46" fill="none" {...common} />
        <circle cx="-36" cy="-18" r="3.4" fill={paper} stroke="none" />
        <circle cx="-20" cy="-18" r="3.4" fill={paper} stroke="none" />
      </>)
    case 'bird':
      return g(<>
        <ellipse cx="0" cy="0" rx="34" ry="22" fill={secondary} {...common} />
        <circle cx="27" cy="-15" r="16" fill={secondary} {...common} />
        <path d="M43-16 61-10 43-5Z" fill={accent} {...common} />
        <path d="M-12-2 C2-25 24-22 29-6 C12 3 0 10-12-2Z" fill={paper} {...common} />
        <path d="M-8 20 -14 38M9 20 5 38" fill="none" {...common} />
      </>)
    case 'search':
      return g(<>
        <circle cx="-10" cy="-12" r="38" fill={paper} {...common} />
        <path d="M17 15 55 53" fill="none" {...common} />
        <circle cx="-10" cy="-12" r="20" fill="none" stroke={accent} strokeWidth="5" />
      </>)
    case 'window':
      return g(<>
        <rect x="-52" y="-55" width="104" height="110" rx="5" fill={paper} {...common} />
        <path d="M0-53V53M-50 0H50" fill="none" {...common} />
        <circle cx="25" cy="-28" r="13" fill={accent} stroke="none" />
      </>)
    case 'garden':
      return g(<>
        <path d="M-55 42 C-38 8-10 12 0 42 C8 4 42 8 55 42" fill={secondary} {...common} />
        <path d="M-30 36V-14M15 36V-22M42 38V2" fill="none" {...common} />
        <circle cx="-30" cy="-24" r="12" fill={accent} {...common} />
        <circle cx="15" cy="-32" r="12" fill={accent} {...common} />
        <circle cx="42" cy="-8" r="10" fill={accent} {...common} />
      </>)
    case 'moon':
      return g(<>
        <path d="M18-48 C-20-42-36-7-21 22 C-7 49 28 53 50 32 C22 33 2 15-1-8 C-4-26 3-39 18-48Z" fill={accent} {...common} />
        <circle cx="-42" cy="-28" r="4" fill={paper} stroke="none" />
        <circle cx="50" cy="-35" r="5" fill={paper} stroke="none" />
      </>)
    case 'street':
      return g(<>
        <path d="M-64 52 -24-52 24-52 64 52Z" fill={secondary} {...common} />
        <path d="M0-42V-18M0-2V20M0 34V48" fill="none" stroke={paper} strokeWidth="5" />
        <rect x="-60" y="-48" width="25" height="40" fill={accent} {...common} />
        <rect x="36" y="-40" width="24" height="34" fill={paper} {...common} />
      </>)
    case 'people':
      return g(<>
        <circle cx="-30" cy="-28" r="15" fill={accent} {...common} />
        <circle cx="28" cy="-22" r="14" fill={secondary} {...common} />
        <path d="M-52 46 C-50 10-12 4-8 46M6 46 C8 14 47 10 50 46" fill={paper} {...common} />
      </>)
    case 'ball':
      return g(<>
        <circle cx="0" cy="0" r="47" fill={paper} {...common} />
        <path d="M0-46 24-15 14 22-20 25-31-10Z" fill={accent} {...common} />
        <path d="M24-15 45-5M14 22 30 40M-20 25-34 39M-31-10-45-20M0-46-4-27" fill="none" {...common} />
      </>)
    case 'music':
      return g(<>
        <path d="M-14-48V26M-14-48 42-60V14" fill="none" {...common} />
        <ellipse cx="-30" cy="33" rx="20" ry="14" fill={accent} {...common} />
        <ellipse cx="26" cy="20" rx="20" ry="14" fill={secondary} {...common} />
        <path d="M-14-30 42-42" fill="none" {...common} />
      </>)
    case 'city':
      return g(<>
        <rect x="-62" y="-24" width="34" height="72" fill={secondary} {...common} />
        <rect x="-20" y="-54" width="40" height="102" fill={paper} {...common} />
        <rect x="28" y="-10" width="35" height="58" fill={accent} {...common} />
        <path d="M-52-8h12M-52 10h12M-10-36h20M-10-16h20M39 6h12M39 23h12" fill="none" {...common} />
      </>)
    case 'calendar':
      return g(<>
        <rect x="-55" y="-42" width="110" height="88" rx="8" fill={paper} {...common} />
        <path d="M-55-18H55M-25-55V-32M25-55V-32" fill="none" {...common} />
        {[[-28,2],[0,2],[28,2],[-28,25],[0,25],[28,25]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="6" fill={i===4?accent:secondary} stroke="none" />)}
      </>)
    case 'count':
      return g(<>
        {[-42,-14,14,42].map((cx,i)=><circle key={i} cx={cx} cy={i%2?-4:12} r="14" fill={i===2?accent:secondary} {...common} />)}
        <path d="M-55 44H55" fill="none" {...common} />
      </>)
    case 'clock':
      return g(<>
        <circle cx="0" cy="0" r="48" fill={paper} {...common} />
        <path d="M0-30V2L25 17" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" />
        <circle cx="0" cy="0" r="4" fill={ink} stroke="none" />
      </>)
    case 'cake':
      return g(<>
        <path d="M-52 42H52L43-5H-43Z" fill={accent} {...common} />
        <path d="M-38-5 C-24-22-10-5 0-18 C12-3 24-21 39-5" fill={paper} {...common} />
        <path d="M0-18V-52" fill="none" {...common} />
        <path d="M0-62 C-10-48 10-46 0-62Z" fill={secondary} {...common} />
      </>)
    case 'cats':
      return g(<>
        {[-38,0,38].map((cx,i)=><g key={i} transform={`translate(${cx} ${i===1?-8:8}) scale(.55)`}><ellipse cx="0" cy="20" rx="36" ry="24" fill={i===1?accent:secondary} {...common}/><circle cx="-20" cy="-16" r="22" fill={i===1?accent:secondary} {...common}/><path d="M-38-30 -30-50 -18-32M-5-31 2-50 12-28" fill={i===1?accent:secondary} {...common}/></g>)}
      </>)
    case 'market':
      return g(<>
        <path d="M-60-24H60L48-52H-48Z" fill={accent} {...common} />
        <path d="M-48-52V48M48-52V48M-60-24H60" fill="none" {...common} />
        <rect x="-38" y="2" width="76" height="38" rx="5" fill={paper} {...common} />
        <circle cx="-20" cy="18" r="8" fill={secondary} stroke="none" /><circle cx="0" cy="18" r="8" fill={accent} stroke="none" /><circle cx="20" cy="18" r="8" fill={secondary} stroke="none" />
      </>)
    case 'bread':
      return g(<>
        <path d="M-54 20 C-52-28-24-46 3-45 C36-44 56-22 54 20 C34 38-31 40-54 20Z" fill={accent} {...common} />
        <path d="M-24-26 -6-5M2-34 19-12M27-28 40-8" fill="none" stroke={paper} strokeWidth="5" />
      </>)
    case 'cafe':
      return g(<>
        <path d="M-40-10H25V26C25 43-40 43-40 26Z" fill={paper} {...common} />
        <path d="M25-3H46C61-2 61 24 44 25H25" fill="none" {...common} />
        <path d="M-22-20C-34-35-16-40-24-54M0-20C-12-34 4-41-4-55" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
        <path d="M-56 47H58" fill="none" {...common} />
      </>)
    case 'money':
      return g(<>
        <circle cx="-26" cy="12" r="27" fill={accent} {...common} />
        <circle cx="10" cy="-4" r="27" fill={secondary} {...common} />
        <circle cx="35" cy="20" r="24" fill={paper} {...common} />
        <path d="M-34 12h16M2-4h16M28 20h14" fill="none" {...common} />
      </>)
    case 'speech':
      return g(<>
        <path d="M-58-42H24C47-42 57-28 57-8V8C57 31 42 42 20 42H-6L-30 57-26 42H-58Z" fill={paper} {...common} />
        <circle cx="-28" cy="0" r="5" fill={accent} stroke="none"/><circle cx="-5" cy="0" r="5" fill={accent} stroke="none"/><circle cx="18" cy="0" r="5" fill={accent} stroke="none"/>
      </>)
    case 'note':
      return g(<>
        <rect x="-48" y="-55" width="96" height="110" rx="7" fill={paper} {...common} />
        <path d="M-29-25H28M-29-5H20M-29 15H30M-29 35H12" fill="none" stroke={secondary} strokeWidth="5" />
        <path d="M34 38 57-48" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round" />
      </>)
    case 'phone':
      return g(<>
        <rect x="-38" y="-58" width="76" height="116" rx="13" fill={paper} {...common} />
        <rect x="-25" y="-40" width="50" height="74" rx="5" fill={secondary} stroke="none" />
        <circle cx="0" cy="46" r="6" fill={accent} stroke="none" />
      </>)
    case 'heart':
      return g(<>
        <path d="M0 47 C-58 10-62-23-35-38 C-17-48-4-37 0-24 C5-38 18-48 36-38 C63-23 58 11 0 47Z" fill={accent} {...common} />
      </>)
    case 'school':
      return g(<>
        <path d="M-58-18 0-56 58-18V50H-58Z" fill={paper} {...common} />
        <rect x="-16" y="12" width="32" height="38" fill={secondary} {...common} />
        <path d="M-40 2h18M22 2h18" fill="none" {...common} />
        <path d="M0-56V-76" fill="none" {...common} /><path d="M0-76 27-67 0-58Z" fill={accent} {...common} />
      </>)
    case 'plan':
      return g(<>
        <path d="M-58-42H58V42H-58Z" fill={paper} {...common} />
        <path d="M-42-20 -8-2 13-24 42 7 20 28-10 18-37 31Z" fill="none" stroke={accent} strokeWidth="5" />
        <circle cx="-42" cy="-20" r="6" fill={secondary} /><circle cx="42" cy="7" r="6" fill={secondary} />
      </>)
    case 'office':
      return g(<>
        <rect x="-60" y="-46" width="120" height="92" rx="6" fill={paper} {...common} />
        <rect x="-44" y="-29" width="52" height="38" rx="4" fill={secondary} {...common} />
        <path d="M-24 10V31M-42 31H-6M22-28H43M22-9H43M22 10H43" fill="none" {...common} />
      </>)
    case 'suitcase':
      return g(<>
        <rect x="-50" y="-34" width="100" height="82" rx="10" fill={accent} {...common} />
        <path d="M-20-34V-52H20V-34M-22-18V31M22-18V31" fill="none" {...common} />
        <circle cx="-28" cy="53" r="6" fill={ink}/><circle cx="28" cy="53" r="6" fill={ink}/>
      </>)
    case 'train':
      return g(<>
        <rect x="-58" y="-42" width="116" height="74" rx="15" fill={accent} {...common} />
        <rect x="-40" y="-26" width="30" height="25" rx="3" fill={paper} {...common} />
        <rect x="8" y="-26" width="30" height="25" rx="3" fill={paper} {...common} />
        <circle cx="-32" cy="39" r="12" fill={ink}/><circle cx="32" cy="39" r="12" fill={ink}/>
        <path d="M-66 55H66" fill="none" {...common}/>
      </>)
    case 'compass':
      return g(<>
        <circle cx="0" cy="0" r="50" fill={paper} {...common} />
        <path d="M-14 16 8-38 18-10 -8 40Z" fill={accent} {...common} />
        <circle cx="0" cy="0" r="5" fill={ink} />
      </>)
    case 'farm':
      return g(<>
        <path d="M-58-7 0-52 58-7V50H-58Z" fill={accent} {...common} />
        <rect x="-17" y="12" width="34" height="38" fill={paper} {...common} />
        <path d="M-45 50V10M45 50V10" fill="none" {...common}/>
        <circle cx="47" cy="-25" r="17" fill={secondary} {...common}/>
      </>)
    case 'ocean':
      return g(<>
        <path d="M-66 24 C-45 4-25 42-4 23 C17 5 36 42 63 18" fill="none" stroke={secondary} strokeWidth="8" strokeLinecap="round"/>
        <path d="M-37 8H30L14-18H-22Z" fill={paper} {...common}/>
        <path d="M-4-18V-49L31-20H-4" fill={accent} {...common}/>
      </>)
    case 'mountain':
      return g(<>
        <path d="M-68 48 -18-50 6-13 27-46 68 48Z" fill={secondary} {...common} />
        <path d="M-18-50 -5-24 6-13M27-46 18-22" fill="none" stroke={paper} strokeWidth="6"/>
        <rect x="22" y="10" width="31" height="27" fill={accent} {...common}/>
        <path d="M18 10 37-6 57 10" fill={accent} {...common}/>
      </>)
    case 'hands':
      return g(<>
        <path d="M-54 28 C-36-5-19-20-6-12 C4-6-4 8-10 18 C2 6 15-2 23 5 C31 13 20 25 10 35 C-8 51-34 50-54 28Z" fill={paper} {...common}/>
        <path d="M52 28 C34-5 18-20 5-12 C-5-6 3 8 9 18 C-3 6-16-2-24 5 C-32 13-20 25-10 35 C8 51 33 50 52 28Z" fill={secondary} {...common}/>
      </>)
    case 'doctor':
      return g(<>
        <circle cx="0" cy="-26" r="21" fill={paper} {...common}/>
        <path d="M-42 50 C-40 8 40 8 42 50" fill={paper} {...common}/>
        <path d="M0 12V44M-16 28H16" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round"/>
        <path d="M-28 6 C-36 22-28 32-16 34M28 6 C36 22 28 32 16 34" fill="none" {...common}/>
      </>)
    case 'grandmother':
      return g(<>
        <circle cx="0" cy="-28" r="24" fill={paper} {...common}/>
        <path d="M-38 50 C-35 5 35 5 38 50" fill={secondary} {...common}/>
        <path d="M-18-43 C-6-56 14-54 23-38" fill="none" stroke={accent} strokeWidth="6"/>
        <path d="M-14-26h9M5-26h9" fill="none" {...common}/>
        <path d="M-6-10 C0-4 7-5 12-10" fill="none" {...common}/>
      </>)
    case 'stars':
      return g(<>
        {[[-42,-26],[5,-43],[40,-15],[-5,15],[31,33]].map(([cx,cy],i)=><path key={i} d={`M${cx} ${cy-10} ${cx+3} ${cy-3} ${cx+11} ${cy-2} ${cx+5} ${cy+3} ${cx+7} ${cy+11} ${cx} ${cy+6} ${cx-7} ${cy+11} ${cx-5} ${cy+3} ${cx-11} ${cy-2} ${cx-3} ${cy-3}Z`} fill={i===1?accent:secondary} stroke={paper} strokeWidth="2"/>)}
      </>)
    case 'door':
      return g(<>
        <rect x="-43" y="-58" width="86" height="116" rx="5" fill={paper} {...common}/>
        <rect x="-27" y="-42" width="54" height="100" rx="3" fill={secondary} {...common}/>
        <circle cx="15" cy="8" r="5" fill={accent} stroke={ink} strokeWidth="3"/>
      </>)
  }
}

export default function ChapterIllustration({ chapterId, titleFa, tint }: Props) {
  const scene = CHAPTER_ART[chapterId]
  if (!scene) {
    return (
      <div className="lesson-cover-fallback" role="img" aria-label={`تصویر داستان: ${titleFa}`}>
        <span aria-hidden="true">🐈‍⬛</span>
      </div>
    )
  }

  const ink = scene.night ? '#f5ecdc' : '#2b2a26'
  const paper = scene.night ? '#3f465b' : '#fbf5ec'

  return (
    <svg
      className="lesson-chapter-art"
      viewBox="0 0 800 420"
      role="img"
      aria-label={`تصویر داستان: ${titleFa}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="800" height="420" fill={scene.sky} />
      <circle cx="665" cy="78" r="42" fill={scene.night ? '#e5cd78' : '#f0c66c'} opacity=".9" />
      <path d="M0 250 C120 210 225 245 330 220 C470 187 592 235 800 192 V420 H0Z" fill={scene.ground} />
      <path d="M0 302 C160 250 330 326 485 275 C620 232 709 275 800 258 V420 H0Z" fill={tint} opacity=".72" />
      <path d="M45 350 C175 318 268 356 380 335 C505 311 625 345 760 315" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity=".22" />

      <g opacity=".98">
        <Motif kind={scene.primary} x={262} y={215} scale={1.28} accent={scene.accent} secondary={scene.secondary} ink={ink} paper={paper} />
        <Motif kind={scene.detail} x={558} y={232} scale={.82} accent={scene.secondary} secondary={scene.accent} ink={ink} paper={paper} />
      </g>

      <path d="M75 93 C120 63 167 69 204 98" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity=".18" />
      <path d="M596 128 C640 112 693 120 725 151" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity=".16" />
    </svg>
  )
}
