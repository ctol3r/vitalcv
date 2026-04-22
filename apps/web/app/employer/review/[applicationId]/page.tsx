import React from 'react';
import ConsoleWrapper from './ConsoleWrapper';

export const dynamic = 'force-dynamic';

export default async function EmployerReviewPage(props: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await props.params;
  
  return <ConsoleWrapper applicationId={applicationId} />;
}
