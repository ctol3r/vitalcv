import { writeFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Save to /tmp/issue.json for the helper script
    const issueData = {
      credentialId: data.credentialId,
      jwt: data.jwt,
      timestamp: data.timestamp,
      type: data.type,
      issuer: data.issuer,
    };

    const filePath = '/tmp/issue.json';
    await writeFile(filePath, JSON.stringify(issueData, null, 2));

    return NextResponse.json({ success: true, filePath });
  } catch (error) {
    console.error('Failed to save issue data:', error);
    return NextResponse.json({ error: 'Failed to save issue data' }, { status: 500 });
  }
}
