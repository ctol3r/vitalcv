/**
 * Simple Health Check Endpoint
 *
 * GET /api/health
 * Lightweight health check optimized for container orchestration
 * Used by Docker HEALTHCHECK, Kubernetes liveness/readiness probes
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }

  return NextResponse.json(health, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
