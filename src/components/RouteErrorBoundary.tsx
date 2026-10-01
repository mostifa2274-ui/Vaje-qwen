import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError, shouldAutoReload } from '../engine/recovery'

interface Props {
  children: ReactNode
  onHome: () => void
}

interface State {
  error: unknown
  reloading: boolean
}

function sessionStore(): Storage | undefined {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

/**
 * Keeps a failing screen from taking the whole app down. A screen whose script
 * cannot be fetched (offline, or replaced by a deploy) reloads once to pick up
 * the current build; anything else offers a retry and the way home. The app
 * keys this boundary by route, so moving to another screen clears it.
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Ghesse screen failure', error, info.componentStack)
    if (isChunkLoadError(error) && shouldAutoReload(sessionStore(), navigator.onLine, Date.now())) {
      this.setState({ reloading: true })
      window.location.reload()
    }
  }

  private retry = () => {
    if (isChunkLoadError(this.state.error)) window.location.reload()
    else this.setState({ error: null })
  }

  render() {
    const { error, reloading } = this.state
    if (!error) return this.props.children
    if (reloading) {
      return (
        <div className="app-page" role="status" aria-live="polite">
          <div className="app-task-header px-4 py-4">
            <p className="font-extrabold">در حال به‌روزرسانی برنامه…</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>نسخهٔ تازه بارگذاری می‌شود؛ پیشرفت پاک نمی‌شود.</p>
          </div>
        </div>
      )
    }
    const missingScript = isChunkLoadError(error)
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    return (
      <section className="runtime-error-card luxury-error-card mx-auto mt-10" role="alert" data-testid="route-error">
        <div className="runtime-error-mark" aria-hidden="true">!</div>
        <h1>{missingScript ? 'این بخش باز نشد' : 'نمایش این بخش با مشکل روبه‌رو شد'}</h1>
        <p>
          {missingScript && offline
            ? 'این بخش هنوز روی این دستگاه ذخیره نشده است. به اینترنت وصل شو و دوباره تلاش کن.'
            : missingScript
              ? 'فایل این بخش بارگیری نشد. دوباره تلاش کن تا تازه‌ترین نسخهٔ برنامه بارگیری شود.'
              : 'پیشرفت ذخیره‌شدهٔ تو پاک نشده است. دوباره تلاش کن یا به مسیر یادگیری برگرد.'}
        </p>
        <div className="runtime-error-actions">
          <button type="button" className="btn-ink px-4 py-3" onClick={this.retry}>دوباره تلاش کن</button>
          <button type="button" className="btn-paper px-4 py-3" onClick={this.props.onHome}>بازگشت به مسیر</button>
        </div>
      </section>
    )
  }
}
