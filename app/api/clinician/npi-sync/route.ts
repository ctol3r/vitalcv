import { type NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { npi } = body

    if (!npi) {
      return NextResponse.json({ error: "NPI number is required" }, { status: 400 })
    }

    // Validate NPI format (10 digits)
    const npiRegex = /^\d{10}$/
    if (!npiRegex.test(npi)) {
      return NextResponse.json({ error: "Invalid NPI format. Must be 10 digits." }, { status: 400 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(`${BACKEND_URL}/lookup/npi/${npi}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to sync NPI data" }))
        return NextResponse.json(
          {
            error: errorData.error || `Backend error: ${response.status}`,
            allowManualEntry: response.status === 408 || response.status === 504,
          },
          { status: response.status },
        )
      }

      const data = await response.json()
      return NextResponse.json(
        {
          message: "NPI data synchronized successfully",
          lastSynced: new Date().toISOString(),
          npiData: data,
        },
        { status: 200 },
      )
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          {
            error: "NPI lookup timeout - please enter data manually or try again",
            allowManualEntry: true,
          },
          { status: 408 },
        )
      }
      throw fetchError
    }
  } catch (error) {
    console.error("NPI sync error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync NPI data",
        allowManualEntry: true,
      },
      { status: 500 },
    )
  }
}
