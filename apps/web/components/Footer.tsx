export default function Footer() {
  return (
    <footer className="mt-24 border-t border-neutral-200 pt-10 pb-12 sm:mt-32">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-400">VitalCV</p>
        <p className="text-xs text-neutral-400">
          Synthetic data over production code paths.
        </p>
      </div>
    </footer>
  );
}
