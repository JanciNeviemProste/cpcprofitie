import Link from 'next/link';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata = { title: 'Obnovenie hesla' };

export default function ResetPasswordPage() {
  return (
    <div className="bg-card/40 border-border/60 w-full max-w-md rounded-2xl border p-8 shadow-2xl backdrop-blur">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Zabudnuté heslo?</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Pošleme vám e-mail s linkom na obnovenie hesla.
        </p>
      </div>

      <div className="mt-8">
        <ResetPasswordForm />
      </div>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Spomenuli ste si?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Prihlásiť sa
        </Link>
      </p>
    </div>
  );
}
