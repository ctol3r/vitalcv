import Link from 'next/link';

const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA;
const deployTime = process.env.NEXT_PUBLIC_DEPLOY_TIME;

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 px-6 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-semibold text-foreground">VitalCV</p>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-muted">
          <Link href="/how-it-works" className="transition-theme hover:text-foreground">
            How it works
          </Link>
          <Link href="/security" className="transition-theme hover:text-foreground">
            Security
          </Link>
          <Link href="/demo" className="transition-theme hover:text-foreground">
            Demo
          </Link>
          <Link href="/progress" className="transition-theme hover:text-foreground">
            Progress
          </Link>
          <Link href="/contact" className="transition-theme hover:text-foreground">
            Contact
          </Link>
        </nav>
        <div className="text-sm text-muted">
          <p>© {year} VitalCV. Production-ready OpenID4VCI trust stack.</p>
          {(commitSha || deployTime) && (
            <p className="mt-1 font-mono text-xs text-muted/60">
              {commitSha && <span>build {commitSha.slice(0, 7)}</span>}
              {commitSha && deployTime && <span> · </span>}
              {deployTime && <span>{deployTime}</span>}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
