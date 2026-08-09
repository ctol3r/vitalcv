import type { Metadata } from 'next';
import { RecognitionSurface } from '@/components/recognition/RecognitionSurface';

export const metadata: Metadata = {
  title: 'Recognition',
  description:
    'Your recognition record — employer acceptances recorded against your source-backed evidence, with what each acceptance means.',
};

export default function HolderRecognitionPage() {
  return <RecognitionSurface />;
}
