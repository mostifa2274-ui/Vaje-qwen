import { createContext, useContext } from 'react'

// Shared vocabulary for Ghesse's storybook illustrations: a warm sketchbook
// palette, soft light and a little paper grain.

export const INK = '#2b2a26'
export const PAPER = '#fbf5ec'
export const CRIMSON = '#b82347'
export const GOLD = '#d9a441'

/** Gradient/filter ids are prefixed per drawing so two artworks never collide. */
export const ArtPrefix = createContext('art')

export function useArtId(): (name: string) => string {
  const prefix = useContext(ArtPrefix)
  return name => `${prefix}-${name}`
}

export function useArtUrl(): (name: string) => string {
  const id = useArtId()
  return name => `url(#${id(name)})`
}

/** Ink outline shared by every drawn shape. */
export function outline(width = 3, color = INK) {
  return { stroke: color, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
}
