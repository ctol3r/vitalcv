export const runtime = 'nodejs';

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      service: 'web',
    },
    { status: 200 },
  );
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

