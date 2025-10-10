/**
 * Web Vitals Provider
 *
 * Client component that initializes Core Web Vitals tracking
 */

'use client'

import { useEffect } from 'react'
import { initWebVitals } from '@/lib/monitoring/web-vitals'

export function WebVitalsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Web Vitals tracking on mount
    initWebVitals()
  }, [])

  return <>{children}</>
}
