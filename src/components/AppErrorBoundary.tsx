import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Ghesse render failure', error, info.componentStack)
    }
  }

  private reload = () => {
    window.location.reload()
  }

  private goHome = () => {
    window.location.hash = '#/'
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="runtime-error-shell" role="alert" aria-live="assertive">
        <section className="runtime-error-card">
          <div className="runtime-error-mark" aria-hidden="true">!</div>
          <h1>نمایش این صفحه با مشکل روبه‌رو شد</h1>
          <p>
            پیشرفت ذخیره‌شدهٔ تو پاک نشده است. می‌توانی برنامه را دوباره بارگذاری کنی؛
            اگر همین صفحه دوباره مشکل داشت، به مسیر یادگیری برگرد.
          </p>
          <div className="runtime-error-actions">
            <button type="button" className="btn-ink px-4 py-3" onClick={this.reload}>
              بارگذاری دوباره
            </button>
            <button type="button" className="btn-paper px-4 py-3" onClick={this.goHome}>
              بازگشت به مسیر
            </button>
          </div>
        </section>
      </main>
    )
  }
}
