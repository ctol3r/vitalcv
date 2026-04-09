import PassportEntityClient from './PassportEntityClient';

export const dynamic = 'force-dynamic';

export default async function PassportEntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    role?: string;
    roleTitle?: string;
    employer?: string;
    employerName?: string;
  }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <PassportEntityClient
      entityId={id}
      roleContext={{
        roleId: resolvedSearchParams.role ?? null,
        roleTitle: resolvedSearchParams.roleTitle ?? null,
        employerSlug: resolvedSearchParams.employer ?? null,
        employerName: resolvedSearchParams.employerName ?? null,
      }}
    />
  );
}
