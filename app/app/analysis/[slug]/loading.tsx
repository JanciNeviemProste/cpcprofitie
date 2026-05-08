export default function AnalysisLoading() {
  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <div className="bg-muted/30 h-4 w-24 animate-pulse rounded" />
        <div className="bg-muted/40 h-9 w-48 animate-pulse rounded" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-border/40 bg-card/30 h-24 animate-pulse rounded-xl border" />
        ))}
      </div>
      <div className="border-border/40 bg-card/30 mt-10 h-80 animate-pulse rounded-xl border" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="border-border/40 bg-card/30 h-72 animate-pulse rounded-xl border" />
        <div className="border-border/40 bg-card/30 h-72 animate-pulse rounded-xl border" />
      </div>
    </div>
  );
}
