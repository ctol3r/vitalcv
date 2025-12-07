import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || "http://localhost:4000";

export async function sendFeedback(
  traceId: string,
  helpful: boolean,
  used: string[]
): Promise<void> {
  await axios.post(`${BASE}/api/agent/feedback`, {
    traceId,
    helpful,
    used,
  });
}
