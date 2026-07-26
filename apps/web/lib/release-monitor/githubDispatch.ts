/**
 * Fire a GitHub `repository_dispatch` event to kick the release-verify workflow.
 *
 * This is the bridge between the Railway webhook (received in-container) and the
 * external GitHub Actions runner that actually performs the verification. The
 * GitHub token lives server-side in the web service env (GITHUB_DISPATCH_TOKEN),
 * never in the Railway webhook URL. `fetch` is injected for tests.
 */

import { GITHUB_REPO } from '@/lib/platform/deployment-integrity';

export type FetchLike = typeof fetch;

export interface GithubDispatchInput {
  token: string;
  /** owner/repo — defaults to the canonical GITHUB_REPO. */
  repo?: string;
  /** repository_dispatch event_type the workflow listens for. */
  eventType?: string;
  clientPayload?: Record<string, unknown>;
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  detail: string;
}

export const RELEASE_VERIFY_EVENT_TYPE = 'release-verify';

export async function dispatchReleaseVerify(
  input: GithubDispatchInput,
  fetchImpl: FetchLike = fetch,
): Promise<DispatchResult> {
  const repo = input.repo ?? GITHUB_REPO;
  const eventType = input.eventType ?? RELEASE_VERIFY_EVENT_TYPE;
  const url = `https://api.github.com/repos/${repo}/dispatches`;

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${input.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'vitalcv-release-monitor',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: eventType, client_payload: input.clientPayload ?? {} }),
      signal: AbortSignal.timeout(8000),
    });

    // GitHub returns 204 No Content on a successful dispatch.
    if (res.status === 204) return { ok: true, status: 204, detail: 'dispatched' };
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, detail: `github dispatch ${res.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, status: 0, detail: `github dispatch error: ${(err as Error).message}` };
  }
}
