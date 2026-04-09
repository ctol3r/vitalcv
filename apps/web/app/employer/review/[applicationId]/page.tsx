import React from 'react';

export default async function EmployerReviewPage(props: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await props.params;
  return (
    <div className="p-8 text-foreground bg-background">
      <h1 className="text-2xl font-bold mb-4">Application Review</h1>
      <p>ID: {applicationId}</p>
      
      <div className="grid gap-4 mt-4">
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Identity Snapshot</h2>
          <p>Verified</p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Lane States</h2>
          <ul>
            <li>Identity: CHECKED</li>
            <li>Sanctions: CLEAR</li>
            <li>Licensure: ACCESS REQUIRED</li>
            <li>Enrollment: ENROLLED</li>
          </ul>
        </div>
        <div className="flex gap-4 mt-6">
          <button className="px-4 py-2 bg-trust-green text-white rounded">Accept as head start</button>
          <button className="px-4 py-2 bg-amber-500 text-white rounded">Request missing info</button>
          <button className="px-4 py-2 bg-destructive text-white rounded">Reject</button>
        </div>
      </div>
    </div>
  );
}
