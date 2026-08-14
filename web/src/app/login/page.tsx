import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Sign in · Calorie Tracker' };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
