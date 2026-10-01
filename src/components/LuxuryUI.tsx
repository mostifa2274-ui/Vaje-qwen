import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react'
import { BackIcon, SpeakerIcon } from './Icons'

function join(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function LuxuryPageHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  backLabel = 'بازگشت',
  trailing,
  sticky = false,
  centered = false,
  headingRef,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  onBack?: () => void
  backLabel?: string
  trailing?: ReactNode
  sticky?: boolean
  centered?: boolean
  headingRef?: Ref<HTMLHeadingElement>
  className?: string
}) {
  return (
    <header className={join('luxury-page-header', sticky && 'luxury-page-header-sticky', centered && 'is-centered', className)}>
      {onBack ? (
        <button type="button" className="luxury-icon-button" onClick={onBack} aria-label={backLabel}>
          <BackIcon className="h-5 w-5" />
        </button>
      ) : <span className="luxury-header-spacer" aria-hidden="true" />}
      <div className="luxury-page-heading">
        {eyebrow && <div className="luxury-page-eyebrow">{eyebrow}</div>}
        <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {trailing ?? <span className="luxury-header-spacer" aria-hidden="true" />}
    </header>
  )
}

export function LuxuryPanel({
  children,
  className,
  elevated = true,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode; elevated?: boolean }) {
  return (
    <section className={join('luxury-panel', elevated && 'is-elevated', className)} {...props}>
      {children}
    </section>
  )
}

export function LuxurySectionHeading({
  title,
  subtitle,
  badge,
  className,
  id,
}: {
  title: ReactNode
  subtitle?: ReactNode
  badge?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <div className={join('luxury-section-heading', className)}>
      <div className="min-w-0">
        <h2 id={id}>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {badge && <div className="luxury-section-badge">{badge}</div>}
    </div>
  )
}

export function LuxuryProgress({
  value,
  max,
  label,
  valueText,
  className,
}: {
  value: number
  max: number
  label: string
  valueText?: string
  className?: string
}) {
  const safeMax = Math.max(1, max)
  const safeValue = Math.max(0, Math.min(value, safeMax))
  return (
    <div
      className={join('luxury-progress', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={safeValue}
      aria-valuetext={valueText}
    >
      <span style={{ width: `${Math.min(100, (safeValue / safeMax) * 100)}%` }} />
    </div>
  )
}

export function LuxuryAudioOrb({
  label,
  helper,
  disabled,
  active = false,
  className,
  children,
  buttonRef,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  helper?: string
  active?: boolean
  buttonRef?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={join('luxury-audio-orb', active && 'is-active', className)}
      disabled={disabled}
      aria-label={label}
      {...props}
    >
      <span className="luxury-audio-orb-icon" aria-hidden="true">
        {children ?? <SpeakerIcon />}
      </span>
      <span className="luxury-audio-orb-label">{label}</span>
      {helper && <small>{helper}</small>}
    </button>
  )
}

export function LuxuryChoice({
  selected = false,
  correct = false,
  wrong = false,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean
  correct?: boolean
  wrong?: boolean
}) {
  return (
    <button
      type="button"
      className={join(
        'luxury-choice',
        selected && 'is-selected',
        correct && 'is-correct',
        wrong && 'is-wrong',
        className,
      )}
      {...props}
    >
      <span className="luxury-choice-copy">{children}</span>
      <span className="luxury-choice-mark" aria-hidden="true" />
    </button>
  )
}

export function LuxuryMetricGrid({
  items,
  className,
}: {
  items: Array<{ label: ReactNode; value: ReactNode }>
  className?: string
}) {
  return (
    <div className={join('luxury-metric-grid', className)}>
      {items.map((item, index) => (
        <div className="luxury-metric" key={index}>
          <b>{item.value}</b>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export function LuxurySheetFrame({
  children,
  className,
  frameRef,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; frameRef?: Ref<HTMLDivElement> }) {
  return (
    <div ref={frameRef} className={join('luxury-sheet-frame', className)} {...props}>
      <span className="luxury-sheet-handle" aria-hidden="true" />
      {children}
    </div>
  )
}

export function LuxuryDivider({ className }: { className?: string }) {
  return <div className={join('luxury-divider', className)} aria-hidden="true"><span /></div>
}
