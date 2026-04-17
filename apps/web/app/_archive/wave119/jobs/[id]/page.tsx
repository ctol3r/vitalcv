import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  // Mock data for the static product requirement
  const job = {
    title: 'Clinical Director',
    organization: 'Example Health',
    location: 'Remote',
    description: 'We are seeking a Clinical Director to oversee operations, ensure compliance, and lead our clinical staff.',
    requirements: [
      'Active Medical License',
      'NPI Type 1',
      'No OIG exclusions',
      'PECOS enrollment',
    ],
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="border border-border rounded-2xl p-8 bg-card">
        <h1 className="text-3xl font-bold">{job.title}</h1>
        <p className="text-muted-foreground mt-2 text-lg">{job.organization} · {job.location}</p>
        
        <div className="mt-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold border-b border-border pb-2 mb-4">Job Description</h2>
            <p className="text-foreground/80 leading-relaxed">{job.description}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b border-border pb-2 mb-4">Requirements</h2>
            <ul className="list-disc pl-5 space-y-2 text-foreground/80">
              {job.requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-10 bg-muted/50 border border-border p-6 rounded-xl flex flex-col items-center text-center">
          <h3 className="text-lg font-semibold mb-2">Check readiness for this role</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Enter your NPI to see instantly if you meet the requirements and identify any missing credentials before you apply.
          </p>
          <Link href={`/?npi=&job=${id}`} className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-semibold hover:bg-emerald-400 transition-colors">
            Check My Readiness
          </Link>
          
          <div className="mt-8 w-full text-left">
             <h4 className="font-semibold text-sm mb-3">Example Match Explanation</h4>
             <div className="bg-background border border-border rounded-lg p-4 space-y-3">
               <div className="flex justify-between items-center text-sm">
                 <span>Active Medical License</span>
                 <span className="text-amber-500 font-medium">⚠ Missing</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span>No OIG exclusions</span>
                 <span className="text-emerald-500 font-medium">✔ Clear</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span>PECOS enrollment</span>
                 <span className="text-emerald-500 font-medium">✔ Verified</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
