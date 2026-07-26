import type { Metadata } from 'next';
import SettingsSurface from './SettingsSurface';

export const metadata: Metadata = {
  title: 'Settings · VitalCV',
  description: 'Account, identity binding, professional profile, and sharing settings for your clinician workspace.',
};

// Auth is enforced by the /holder layout (server-side Clerk gate).
export default function HolderSettingsPage() {
  return <SettingsSurface />;
}
