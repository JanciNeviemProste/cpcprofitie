export default function MarketingLoading() {
  return (
    <div className="container mx-auto px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="bg-muted/40 mx-auto h-8 w-32 animate-pulse rounded" />
        <div className="bg-muted/40 mx-auto h-14 w-full animate-pulse rounded" />
        <div className="bg-muted/30 mx-auto h-6 w-3/4 animate-pulse rounded" />
      </div>
      <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted/30 h-32 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}
