import { Sparkles } from 'lucide-react';

export const metadata = { title: 'AI Inzerát' };

export default function AiListingPage() {
  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">AI generovanie inzerátu</h1>
        <p className="text-muted-foreground text-sm">
          Zadajte parametre vozidla a Claude vygeneruje predajný titulok a popis.
        </p>
      </div>

      <div className="border-primary/30 from-primary/10 mt-10 flex items-start gap-4 rounded-xl border bg-gradient-to-br to-transparent p-6">
        <div className="bg-primary/20 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">Pripravujeme</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Tento modul je vo Fáze 6 implementačného plánu. Form na zadanie parametrov a streaming
            výstup z Vercel AI Gateway (anthropic/claude-haiku-4-5) sa pridá po dokončení Stripe
            paywallu pre per-plán quota counter.
          </p>
        </div>
      </div>
    </div>
  );
}
