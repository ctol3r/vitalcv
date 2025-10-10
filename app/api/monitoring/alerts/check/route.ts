import { NextRequest, NextResponse } from 'next/server'
import { runPeriodicChecks } from '@/lib/monitoring/alerts'

/**
 * GET /api/monitoring/alerts/check
 *
 * Run periodic alert checks
 *
 * This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions)
 * every 5-15 minutes to check for alert conditions
 *
 * Can be protected with a secret token for security
 */

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Run all periodic checks
    await runPeriodicChecks()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Alert checks completed',
    })
  } catch (error) {
    console.error('Alert check error:', error)
    return NextResponse.json(
      { error: 'Failed to run alert checks' },
      { status: 500 }
    )
  }
}
