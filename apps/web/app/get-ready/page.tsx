import type { Metadata } from 'next';
import GetReadySurface from './GetReadySurface';

export const metadata: Metadata = {
  title: 'Connect your NPI · VitalCV',
  description:
    'Bind your NPI to your VitalCV workspace. VitalCV reads your public NPPES registry record to start your clinician career wallet — license and exclusion checks run separately with their own receipts.',
};

export default function GetReadyPage() {
  return <GetReadySurface />;
}
