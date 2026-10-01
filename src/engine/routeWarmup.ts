import { examDefinition } from './gates'
import type { NextAction } from './analytics'

export type WarmupTarget = 'review' | 'book-test' | 'exam' | 'read' | 'prep' | 'none'

/** Which lazy screen the home screen is likely to open. Rest and completion stay on the map. */
export function warmupTarget(action: NextAction): WarmupTarget {
  if (action.kind === 'review' || action.kind === 'certification') return 'review'
  if (action.kind === 'exam') return examDefinition(action.examId)?.book ? 'book-test' : 'exam'
  if (action.kind === 'chapter') return action.prepared ? 'read' : 'prep'
  return 'none'
}
