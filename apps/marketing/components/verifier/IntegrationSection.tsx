/**
 * IntegrationSection — shows the verification API contract.
 *
 * Renders a mock API request/response pair in monospace.
 * The response shape matches the real evidence bundle format
 * so developers can evaluate the integration surface immediately.
 */

const apiRequest = `GET /api/vcv/verify/1234567890
Authorization: DPoP <access_token>
DPoP: <dpop_proof>`;

const apiResponse = `{
  "npi": "1234567890",
  "status": "verified",
  "credentials": [
    {
      "type": "medical_license",
      "value": "MD-123456",
      "source": "CA Medical Board",
      "status": "active",
      "verified_at": "2026-02-14T12:00:00Z"
    },
    {
      "type": "board_certification",
      "value": "Internal Medicine",
      "source": "ABIM",
      "status": "active",
      "verified_at": "2026-02-14T12:00:00Z"
    }
  ],
  "evidence": {
    "signature": "ES256",
    "hash": "sha256:a1b2c3d4e5f6...",
    "issued_at": "2026-02-14T12:00:00Z",
    "issuer": "did:web:vitalcv.com"
  }
}`;

export function IntegrationSection() {
  return (
    <section className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Integration
        </h2>
        <p className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          One endpoint. Structured output.
        </p>
        <p className="mt-4 max-w-xl text-base text-muted">
          Integrate credential verification into existing workflows with a
          single API call. DPoP-bound tokens ensure every request is
          sender-constrained.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Request */}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-background px-4 py-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Request
              </p>
            </div>
            <pre className="overflow-x-auto bg-background p-4 font-mono text-sm leading-relaxed text-foreground">
              {apiRequest}
            </pre>
          </div>

          {/* Response */}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-background px-4 py-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Response
              </p>
            </div>
            <pre className="overflow-x-auto bg-background p-4 font-mono text-sm leading-relaxed text-foreground">
              {apiResponse}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
