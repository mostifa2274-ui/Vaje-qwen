import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export function SpeakerIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M11 5 6.7 8.5H3.5v7h3.2L11 19V5Z" />
      <path d="M14.5 9.1a4 4 0 0 1 0 5.8" />
      <path d="M17.3 6.4a7.6 7.6 0 0 1 0 11.2" />
    </svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8.4 5.7a1 1 0 0 1 1.5-.84l9 6.3a1 1 0 0 1 0 1.68l-9 6.3a1 1 0 0 1-1.5-.84V5.7Z" />
    </svg>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="6.2" y="5" width="4" height="14" rx="1" />
      <rect x="13.8" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

export function BackIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}
