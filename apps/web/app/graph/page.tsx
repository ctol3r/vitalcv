import { redirect } from 'next/navigation';

export const metadata = { title: 'Trust Graph Intelligence | VitalCV' };

/** /graph redirects to /intelligence — graph is an embedded panel */
export default function GraphPage() {
  redirect('/intelligence');
}
