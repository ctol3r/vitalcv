'use client';

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionInput } from '@/components/onboarding/ActionInput';

export default function NPIEntryPage() {
  const [npi, setNpi] = useState('');
  const router = useRouter();

  const handleAction = () => {
    if (npi.length === 10) {
      router.push('/onboarding/identity');
    }
  };

  return (
    <ActionInput
      label="What is your NPI number?"
      value={npi}
      onChange={setNpi}
      onAction={handleAction}
      isValid={npi.length === 10}
      placeholder="1234567890"
      type="text"
      maxLength={10}
      pattern="\d*"
    />
  );
}
