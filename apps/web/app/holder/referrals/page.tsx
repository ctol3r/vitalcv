import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Clinician Home — VitalCV',
  description: 'Clinician referrals are not part of the pilot release surface.',
};

export default function HolderReferralsPage() {
  redirect('/holder/home');
}
