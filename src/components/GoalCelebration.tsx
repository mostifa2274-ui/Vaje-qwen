import { useEffect } from 'react'
import { streakMessage } from '../engine/activity'
import { FlameIcon } from './Icons'

const SHOW_MS = 5_000

/** A brief, dismissible note when the day's goal is reached. */
export default function GoalCelebration({ streak, onClose }: { streak: number; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, SHOW_MS)
    return () => window.clearTimeout(timer)
  }, [onClose])
  return (
    <div className="goal-toast luxury-goal-toast" role="status" data-testid="goal-celebration">
      <span className="goal-toast-flame" aria-hidden="true"><FlameIcon className="h-6 w-6" /></span>
      <div className="min-w-0 flex-1">
        <b>هدف امروز کامل شد!</b>
        <span>{streakMessage(streak)}</span>
      </div>
      <button type="button" className="goal-toast-close" onClick={onClose} aria-label="بستن">×</button>
    </div>
  )
}
