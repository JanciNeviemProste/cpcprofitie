import { UpdatePasswordForm } from '@/components/auth/update-password-form';

export const metadata = { title: 'Nové heslo' };

export default function UpdatePasswordPage() {
  return (
    <div className="bg-card/40 border-border/60 w-full max-w-md rounded-2xl border p-8 shadow-2xl backdrop-blur">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Nastavte si nové heslo</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Po uložení budete prihlásený.
        </p>
      </div>
      <div className="mt-8">
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
