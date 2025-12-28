'use client'

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"

const envPilot =
  process.env.NEXT_PUBLIC_PILOT_MODE === "true" ||
  process.env.NEXT_PUBLIC_PILOT_MODE === "1" ||
  process.env.NEXT_PUBLIC_PILOT_MODE?.toLowerCase?.() === "yes"

export function usePilotMode() {
  const searchParams = useSearchParams()

  const pilotEnabled = useMemo(() => {
    const flag = searchParams?.get("pilot") || ""
    const normalized = flag.toLowerCase()
    return (
      envPilot ||
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "on"
    )
  }, [searchParams])

  const hospitalLabel = pilotEnabled ? "Pilot Health System" : "Demo Hospital"
  const clinicianLabel = pilotEnabled ? "Pilot Clinician" : "Demo Clinician"

  return { pilotEnabled, hospitalLabel, clinicianLabel }
}
