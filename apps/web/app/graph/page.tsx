import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Trust Graph Intelligence | VitalCV',
};

/**
 * /graph redirects to /intelligence — the graph is embedded
 * in the intelligence console as a panel, not a standalone page.
 */
export default function GraphPage() {
  redirect('/intelligence');
}
