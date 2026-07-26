import { redirect } from 'next/navigation';

/**
 * /signup is a legacy alias. Real account creation lives at /sign-up
 * (Clerk). The old "signup foundation" plan shell rendered here was a
 * dead end — nothing linked to it and it created no account.
 */
export default function SignupAliasPage() {
  redirect('/sign-up');
}
