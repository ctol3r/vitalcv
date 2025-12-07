import { TrustGraph } from '@/components/trust/TrustGraph';

export default function TrustGraphPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Trust Graph Visualizer</h1>
        <p className="text-muted-foreground">
          Explore the social trust network between clinicians, issuers, and organizations.
        </p>
      </div>

      <TrustGraph />
    </div>
  );
}


