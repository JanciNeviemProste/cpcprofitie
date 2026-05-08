import { AiListingForm } from '@/components/ai/ai-listing-form';

export const metadata = { title: 'AI Inzerát' };

export default function AiListingPage() {
  return (
    <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">AI generovanie inzerátu</h1>
        <p className="text-muted-foreground text-sm">
          Zadajte parametre vozidla — Claude Haiku 4.5 vygeneruje titulok a popis za pár sekúnd.
        </p>
      </div>

      <div className="mt-8">
        <AiListingForm />
      </div>
    </div>
  );
}
