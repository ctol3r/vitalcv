import { redirect } from 'next/navigation';

/**
 * /ask previously exposed an internal intelligence entry point.
 * Public traffic is routed back to the canonical wedge entry.
 */
export default function AskPage() {
  redirect('/');
}
