import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { logEvent } from "../../../lib/events";

interface Props {
  params: Promise<{ shareId: string }>;
}

/**
 * /verify/:shareId
 *
 * Public verifier view — no login required.
 * Records first-view timestamp for time-to-view metric.
 */
export default async function VerifyPage({ params }: Props) {
  const { shareId } = await params;

  const shareLink = await prisma.shareLink.findUnique({
    where: { id: shareId },
  });

  if (!shareLink) {
    notFound();
  }

  // Record first view (time-to-view metric)
  if (!shareLink.firstViewAt) {
    await prisma.shareLink.update({
      where: { id: shareId },
      data: { firstViewAt: new Date() },
    });
  }

  void logEvent("artifact_viewed", shareLink.npi, { shareId });

  const npi = shareLink.npi;
  const now = new Date();
  const timestamp = now.toISOString();
  const pilotMode = process.env.PILOT_MODE === "true";

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {pilotMode && (
          <div className="mb-6 px-4 py-2 border border-border rounded bg-surface text-sm text-muted text-center">
            Pilot Mode — For credentialing teams evaluating start-date
            acceleration.
          </div>
        )}

        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted hover:text-foreground transition-theme"
          >
            ← VitalCV
          </Link>
        </div>

        <h1 className="text-2xl font-semibold text-foreground mb-1">
          Credential Artifact
        </h1>
        <p className="text-sm text-muted mb-8">
          Shared verification for NPI {npi}
        </p>

        <div className="border border-border rounded-lg divide-y divide-border">
          <Field label="NPI" value={npi} />
          <Field label="License" value="State Medical License — Active" />
          <Field label="Source" value="NPPES (mock)" />
          <Field label="Timestamp" value={timestamp} />
          <Field label="Status" value="Verified — Active" />
          <Field label="Monitoring" value="Continuous monitoring enabled" />
          <Field
            label="Signature"
            value={`ES256 — sha256:${npi.slice(0, 8)}...mock`}
          />
        </div>

        <div className="mt-6 flex gap-3">
          <a
            href={`/api/artifact/export/${npi}`}
            className="px-4 py-2 bg-accent text-accent-foreground rounded text-sm font-medium"
          >
            Download PDF
          </a>
        </div>

        <p className="mt-8 text-xs text-muted">
          This is a mock credential artifact. Production artifacts include
          cryptographic signatures anchored to verifiable credential
          infrastructure (OpenID4VCI / HAIP 1.0).
        </p>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3 flex items-start gap-4">
      <span className="text-sm font-medium text-muted w-28 shrink-0">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
