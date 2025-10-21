"use client"

import { useState, useEffect, useCallback } from "react"

interface SessionAnalytics {
  credentialsIssued: number
  verificationsPerformed: number
  revocationsExecuted: number
}

const STORAGE_KEY = "vitalcv_session_analytics"

function getSessionAnalytics(): SessionAnalytics {
  if (typeof window === "undefined") {
    return {
      credentialsIssued: 0,
      verificationsPerformed: 0,
      revocationsExecuted: 0,
    }
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error("Failed to parse session analytics:", error)
  }

  return {
    credentialsIssued: 0,
    verificationsPerformed: 0,
    revocationsExecuted: 0,
  }
}

function saveSessionAnalytics(analytics: SessionAnalytics) {
  if (typeof window === "undefined") return

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(analytics))
  } catch (error) {
    console.error("Failed to save session analytics:", error)
  }
}

export function useSessionAnalytics() {
  const [analytics, setAnalytics] = useState<SessionAnalytics>(getSessionAnalytics)

  useEffect(() => {
    setAnalytics(getSessionAnalytics())
  }, [])

  const incrementIssued = useCallback(() => {
    setAnalytics((prev) => {
      const updated = { ...prev, credentialsIssued: prev.credentialsIssued + 1 }
      saveSessionAnalytics(updated)
      return updated
    })
  }, [])

  const incrementVerifications = useCallback(() => {
    setAnalytics((prev) => {
      const updated = { ...prev, verificationsPerformed: prev.verificationsPerformed + 1 }
      saveSessionAnalytics(updated)
      return updated
    })
  }, [])

  const incrementRevocations = useCallback(() => {
    setAnalytics((prev) => {
      const updated = { ...prev, revocationsExecuted: prev.revocationsExecuted + 1 }
      saveSessionAnalytics(updated)
      return updated
    })
  }, [])

  const resetAnalytics = useCallback(() => {
    const reset: SessionAnalytics = {
      credentialsIssued: 0,
      verificationsPerformed: 0,
      revocationsExecuted: 0,
    }
    setAnalytics(reset)
    saveSessionAnalytics(reset)
  }, [])

  return {
    analytics,
    incrementIssued,
    incrementVerifications,
    incrementRevocations,
    resetAnalytics,
  }
}
