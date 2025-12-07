import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { action: string } }) {
    const action = params.action;
    if (action !== 'status') {
         return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    try {
        const res = await fetch(`${backendUrl}/api/infra/status`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
             const text = await res.text();
             try {
                return NextResponse.json(JSON.parse(text), { status: res.status });
             } catch {
                return NextResponse.json({ error: text }, { status: res.status });
             }
        }

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (e) {
        console.error("Proxy error:", e);
        return NextResponse.json({ error: 'Backend error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: { action: string } }) {
    const action = params.action;

    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body = {};
    try {
        body = await request.json();
    } catch (e) {
        // Body might be empty
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

    try {
        const res = await fetch(`${backendUrl}/api/infra/${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
             const text = await res.text();
             try {
                return NextResponse.json(JSON.parse(text), { status: res.status });
             } catch {
                return NextResponse.json({ error: text }, { status: res.status });
             }
        }

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (e) {
        console.error("Proxy error:", e);
        return NextResponse.json({ error: 'Backend error' }, { status: 500 });
    }
}


