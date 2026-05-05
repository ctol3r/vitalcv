import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PersonaLandingPage } from '@/components/personas/PersonaLandingPage';
import { getPersonaLandingContent } from '@/lib/personas/landingContent';

const SLUG = 'payer';
const content = getPersonaLandingContent(SLUG);

export const metadata: Metadata = content
  ? {
      title: content.title,
      description: content.description,
    }
  : {};

export default function ForPayerPage() {
  if (!content) notFound();
  return <PersonaLandingPage content={content} />;
}
