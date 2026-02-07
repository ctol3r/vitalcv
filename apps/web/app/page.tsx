export default function HomePage() {
  return (
    <main className="mx-auto my-12 max-w-[880px] p-6">
      <h1 className="mb-3 text-[42px] font-bold">
        VitalCV turns credentialing into a reusable, start-ready trust state.
      </h1>

      <p className="mb-6 text-lg">
        Verify once. Reuse everywhere. Clinicians start in days, not months.
      </p>

      <ul className="mb-8 list-inside list-disc text-base leading-relaxed">
        <li>Recognition → Acceptance → Start (enforced in code)</li>
        <li>Employers never chase documents or re-verify</li>
        <li>Audit-backed, revocation-aware trust</li>
      </ul>

      <a
        href="/verifier"
        className="inline-block rounded-lg bg-black px-[22px] py-[14px] font-semibold text-white no-underline"
      >
        View Live Demo
      </a>
    </main>
  );
}
