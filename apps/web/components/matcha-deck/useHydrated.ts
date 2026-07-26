'use client'

import { useEffect, useState } from 'react'

/**
 * True only after the component has hydrated on the client. The workspace
 * surfaces render synchronously from server data, so their DOM (including
 * interactive controls) exists in the SSR HTML before React attaches event
 * handlers. A readiness marker driven by this hook lets a browser test wait
 * for real interactivity instead of racing hydration — mirroring the deck's
 * post-load `data-mdk-loaded` marker.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}
