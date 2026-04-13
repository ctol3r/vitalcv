'use client';

/**
 * DeveloperPreview — API preview section for the developer audience.
 * Shows a live-style API response and code blocks.
 */

import { ApiResponsePreview } from '@/components/ui/api-response-preview';
import { CodeBlock } from '@/components/ui/code-block';
import { ScrollSection, ScrollItem } from '@/components/motion/ScrollSection';
import { Terminal } from 'lucide-react';

const API_RESPONSE = `{
  "npi": "1234567890",
  "provider": {
    "name": "Sarah Chen, MD",
    "specialty": "Internal Medicine",
    "status": "active"
  },
  "readiness": {
    "score": 92,
    "band": "GREEN",
    "checks": {
      "nppes_identity": { "status": "verified", "source": "NPPES", "checked_at": "2026-04-11T08:30:00Z" },
      "oig_exclusion": { "status": "clear", "source": "OIG/LEIE", "checked_at": "2026-04-11T08:30:01Z" },
      "state_license": { "status": "verified", "source": "FSMB", "checked_at": "2026-04-10T14:22:00Z" },
      "board_cert": { "status": "pending", "source": "ABMS", "checked_at": null }
    }
  },
  "meta": {
    "api_version": "v1",
    "response_time_ms": 127
  }
}`;

const CURL_EXAMPLE = `$ curl -X GET https://api.vitalcv.com/v1/readiness/1234567890 \\
  -H "Authorization: Bearer vcv_sk_live_..." \\
  -H "Content-Type: application/json"`;

export function DeveloperPreview() {
  return (
    <section className="border-t border-[var(--vt-border)] px-6 py-24 bg-[var(--vt-surface-dim)]">
      <div className="mx-auto max-w-5xl">
        <ScrollSection className="space-y-10">
          {/* Header */}
          <ScrollItem>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-1.5 mb-5">
                <Terminal className="h-3.5 w-3.5 text-[var(--vt-accent)]" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
                  For Developers
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--vt-text-primary)] leading-tight">
                One API call.{' '}
                <span className="text-[var(--vt-accent)]">
                  Source-backed readiness.
                </span>
              </h2>
              <p className="mt-4 text-[var(--vt-text-muted)] max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
                Check provider readiness against NPPES, OIG/LEIE, and state
                boards with a single REST call. No batch files, no FTP, no fax
                machines.
              </p>
            </div>
          </ScrollItem>

          {/* Code blocks */}
          <ScrollItem>
            <div className="grid gap-6 lg:grid-cols-2">
              <CodeBlock
                code={CURL_EXAMPLE}
                language="bash"
                title="Request"
              />
              <ApiResponsePreview
                method="GET"
                endpoint="/v1/readiness/1234567890"
                statusCode={200}
                responseTime="127ms"
                body={API_RESPONSE}
              />
            </div>
          </ScrollItem>
        </ScrollSection>
      </div>
    </section>
  );
}
