import Breadcrumb from '@/components/ui/Breadcrumb';

/**
 * VerifierBreadcrumb — minimal wrapper for the standard verifier route breadcrumb.
 * Root is always "Employer Dashboard → /verifier/home". Pass only the leaf label.
 *
 * Usage:
 *   <VerifierBreadcrumb label="Candidates" />
 */
export default function VerifierBreadcrumb({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <Breadcrumb
      items={[
        { label: 'Employer Dashboard', href: '/verifier/home' },
        { label },
      ]}
      className={className}
    />
  );
}
