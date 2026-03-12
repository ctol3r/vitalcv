/**
 * /auth/error — Auth failure landing page
 *
 * Shown when Clerk middleware cannot resolve a user's role.
 * Typically means: new user with no VitalCV record + backend unreachable,
 * or a JWT with a role that couldn't be mapped.
 */
import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="max-w-md w-full mx-auto px-6 text-center">
        <div className="mb-6 text-4xl">🔐</div>
        <h1 className="text-2xl font-semibold text-white mb-3">
          We couldn&apos;t sign you in
        </h1>
        <p className="text-zinc-400 mb-8 leading-relaxed">
          We weren&apos;t able to verify your account. This can happen if your
          session expired or your account hasn&apos;t been set up yet.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/sign-in"
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-6 transition-colors"
          >
            Try signing in again
          </Link>
          <Link
            href="/"
            className="w-full rounded-lg border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-white font-medium py-3 px-6 transition-colors"
          >
            Back to home
          </Link>
        </div>
        <p className="mt-8 text-sm text-zinc-600">
          Still stuck?{' '}
          <a
            href="mailto:support@vitalcv.com"
            className="text-emerald-500 hover:text-emerald-400"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
