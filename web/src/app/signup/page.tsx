import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Create account · Calorie Tracker' };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
