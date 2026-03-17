import type { Metadata } from 'next';
import { GraphWorkspacePage } from './GraphWorkspacePage';

export const metadata: Metadata = {
  title: 'Relationship Graph | VitalCV',
  description: 'Dedicated trust and evidence relationship graph workspace.',
};

export default function GraphPage() {
  return <GraphWorkspacePage />;
}
