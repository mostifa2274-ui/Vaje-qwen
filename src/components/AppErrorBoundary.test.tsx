import { describe, expect, it } from 'vitest'
import AppErrorBoundary from './AppErrorBoundary'

describe('AppErrorBoundary', () => {
  it('switches to recovery UI after a render error', () => {
    expect(AppErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true })
  })
})
