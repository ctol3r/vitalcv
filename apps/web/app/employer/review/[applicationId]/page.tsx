import React from 'react';

export default async function EmployerReviewPage(props: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await props.params;
  return (
    <div className="p-8 text-foreground bg-background">
      <h1 className="text-2xl font-bold mb-2">Employer review</h1>
      <p className="text-sm text-muted-foreground">
        Review the current proof, then choose the right next step for this application.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Application ID: {applicationId}</p>
      
      <div className="grid gap-4 mt-4">
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Identity summary</h2>
          <p>Verified</p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Current checks</h2>
          <ul>
            <li>Identity: CHECKED</li>
            <li>Sanctions: CLEAR</li>
            <li>Licensure: ACCESS REQUIRED</li>
            <li>Enrollment: ENROLLED</li>
          </ul>
        </div>
        <div className="flex gap-4 mt-6">
          <button className="px-4 py-2 bg-trust-green text-white rounded">Accept as head start</button>
          <button className="px-4 py-2 bg-amber-500 text-white rounded">Request updated data</button>
          <button className="px-4 py-2 bg-destructive text-white rounded">Flag for review</button>
        </div>
      </div>
    </div>
  );
}
