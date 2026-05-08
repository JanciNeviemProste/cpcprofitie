import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations('common');
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{t('appName')}</h1>
        <p className="text-muted-foreground">{t('tagline')}</p>
      </div>
    </main>
  );
}
