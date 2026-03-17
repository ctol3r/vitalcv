import { redirect } from 'next/navigation';

/**
 * /ask redirects to /intelligence — the copilot is embedded
 * in the intelligence console and investigation workbench.
 */
export default function AskPage() {
  redirect('/intelligence');
}
