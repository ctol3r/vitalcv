import Link from 'next/link';

export default function PreviewIndex() {
  return (
    <main className="px-8 py-10">
      <h1 className="text-2xl font-semibold">Preview</h1>
      <ul className="mt-6 space-y-2 text-lg">
        <li>
          <Link href="/preview/verifier" className="underline">
            Verifier Preview
          </Link>
        </li>
      </ul>
    </main>
  );
}
