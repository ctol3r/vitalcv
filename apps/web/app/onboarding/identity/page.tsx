'use client';

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionInput } from '@/components/onboarding/ActionInput';

export default function IdentityPage() {
  const [contact, setContact] = useState('');
  const router = useRouter();

  const handleAction = () => {
    if (contact.length > 5) {
      router.push('/onboarding/fetching');
    }
  };

  return (
    <ActionInput
      label="Confirm your identity."
      value={contact}
      onChange={setContact}
      onAction={handleAction}
      isValid={contact.length > 5}
      placeholder="Email or phone"
      type="text"
    />
  );
}
