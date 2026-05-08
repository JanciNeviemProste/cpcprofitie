import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="from-primary/15 absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b to-transparent blur-3xl"
      />
      <header className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="from-primary to-chart-2 flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white">
            C
          </span>
          <span className="text-base font-semibold tracking-tight">CPCProfit</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
