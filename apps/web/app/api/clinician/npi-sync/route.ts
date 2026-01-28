import type { RecognitionEvent } from '@domain-common/employmentContracts';
import {
  assertRecognitionEventValid,
  CanonicalPathViolation,
} from '@domain-common/employmentGuards';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * ANTIGRAVITY-COMPLIANT NPI SYNC
 *
 * This endpoint verifies NPI via NPPES.
 * On failure: clinician is BLOCKED. No manual entry.
 *
 * DELETED (per ANTIGRAVITY.md):
 * - allowManualEntry flag (created parallel unverified path)
 * - Timeout fallback to manual entry
 *
 * If NPPES lookup fails, the response is an error.
 * The UI does not offer a manual entry workaround.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { npi, recognition } = body;

    if (!recognition) {
      return NextResponse.json(
        {
          error:
            'RecognitionEvent is required. Canonical Recognition → Acceptance → Start must be provided.',
          blocked: true,
        },
        { status: 400 },
      );
    }

    try {
      assertRecognitionEventValid(recognition as RecognitionEvent);
    } catch (error) {
      const message =
        error instanceof CanonicalPathViolation
          ? error.message
          : 'Invalid RecognitionEvent. Canonical path enforcement failed.';
      return NextResponse.json(
        {
          error: message,
          blocked: true,
        },
        { status: 400 },
      );
    }

    if (!npi) {
      return NextResponse.json(
        { error: 'NPI number is required. VitalCV requires verified identity.' },
        { status: 400 },
      );
    }

    // Validate NPI format (10 digits)
    const npiRegex = /^\d{10}$/;
    if (!npiRegex.test(npi)) {
      return NextResponse.json(
        { error: 'Invalid NPI format. Must be 10 digits.' },
        { status: 400 },
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Extended timeout

    try {
      const response = await fetch(`${BACKEND_URL}/lookup/npi/${npi}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to verify NPI' }));
        // NO allowManualEntry - verification failed means BLOCKED
        return NextResponse.json(
          {
            error:
              errorData.error ||
              `NPI verification failed. Cannot proceed without verified identity.`,
            blocked: true,
          },
          { status: response.status },
        );
      }

      const data = await response.json();

      const recognitionId = (recognition as RecognitionEvent).recognitionId;

      return NextResponse.json(
        {
          message: 'NPI verified successfully',
          lastSynced: new Date().toISOString(),
          npiData: data,
          recognitionId,
          verified: true,
        },
        { status: 200 },
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        // NO allowManualEntry - timeout means BLOCKED, not workaround
        return NextResponse.json(
          {
            error: 'NPI verification timeout. Please try again. Manual entry is not permitted.',
            blocked: true,
          },
          { status: 408 },
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('NPI sync error:', error);
    // NO allowManualEntry - error means BLOCKED
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'NPI verification failed. Cannot proceed without verified identity.',
        blocked: true,
      },
      { status: 500 },
    );
  }
}
