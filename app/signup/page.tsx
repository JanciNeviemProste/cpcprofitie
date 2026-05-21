import { redirect } from 'next/navigation';

// English alias for /register — many users guess `/signup` first.
export default function SignupPage() {
  redirect('/register');
}
