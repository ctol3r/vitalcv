export interface EmployerApplicationReviewContinuityInput {
  continuity?: {
    reviewHref?: string | null;
  } | null;
}

export function resolveEmployerApplicationReviewLink(
  application: EmployerApplicationReviewContinuityInput,
): {
  href: string;
  label: string;
  isFallback: boolean;
} {
  const reviewHref = application.continuity?.reviewHref?.trim() ?? '';

  if (reviewHref.length > 0) {
    return {
      href: reviewHref,
      label: 'Open review',
      isFallback: false,
    };
  }

  return {
    href: '/review/request',
    label: 'Request review',
    isFallback: true,
  };
}
