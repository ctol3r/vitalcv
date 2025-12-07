import { NextRequest, NextResponse } from 'next/server';

import { listPasskeys } from './state';
import { resolveClinicianId } from '../utils';

export async function GET(request: NextRequest) {
  const clinicianId = resolveClinicianId(request);
  const passkeys = listPasskeys(clinicianId);
  return NextResponse.json({ clinicianId, passkeys });
}









