import type { ReactNode } from 'react'

export interface Scene {
  /** Persian description of what the picture shows, read by screen readers. */
  alt: string
  /** Draws the scene on an 800×420 canvas. */
  draw: () => ReactNode
}
