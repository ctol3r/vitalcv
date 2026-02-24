export default function VerifyLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-2xl px-4 py-10 space-y-5">
        <div className="h-6 w-52 rounded-md bg-muted/50 animate-shimmer" />
        <div className="space-y-3">
          <div className="h-8 w-full rounded-2xl bg-muted/60 animate-shimmer" />
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div className="h-24 rounded-2xl bg-muted/60 animate-shimmer" />
            <div className="h-24 rounded-2xl bg-muted/60 animate-shimmer" />
          </div>
          <div className="h-36 rounded-2xl bg-muted/60 animate-shimmer" />
        </div>
      </div>
    </main>
  );
}
