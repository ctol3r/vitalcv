// app/lib/agentClient.ts
import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || "http://localhost:4000/api/agent";

// Get auth token from localStorage (pilot only - replace with proper session management)
function getAuthHeaders() {
  const headers: any = { 'Content-Type': 'application/json' };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('vitalcv_jwt');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

export async function solveTask(task: string, input: any, scopes: string[] = []) {
  try {
    const { data } = await axios.post(
      `${BASE}/solve`,
      { task, input, scopeHints: scopes },
      { headers: getAuthHeaders() }
    );
    return data;
  } catch (error: any) {
    if (error.response?.status === 401 && error.response?.data?.error === 'auth_required_for_sensitive') {
      throw new Error('AUTH_REQUIRED');
    }
    throw error;
  }
}

export async function searchMcp(q: string, scopes: string[] = []) {
  const { data } = await axios.get(`${BASE}/mcp/search`, {
    params: { q, scopes: scopes.join(",") },
    headers: getAuthHeaders()
  });
  return data;
}

