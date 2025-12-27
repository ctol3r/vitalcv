import { AuditTimeline } from './audit';

export default async function CredentialAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Credential Audit Trail</h1>
        <p className="text-sm text-muted-foreground">
          Trace issuance, verification, and consent activity for credential {id}.
        </p>
      </div>
      <AuditTimeline credentialId={id} />
    </main>
  );
}
