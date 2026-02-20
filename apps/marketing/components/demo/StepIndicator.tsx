type Step = {
  number: number;
  label: string;
};

const STEPS: Step[] = [
  { number: 1, label: 'Identify' },
  { number: 2, label: 'Verify' },
  { number: 3, label: 'Credential' },
];

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Demo progress" className="flex items-center gap-3">
      {STEPS.map((step, i) => {
        const isDone = step.number < current;
        const isActive = step.number === current;

        return (
          <div key={step.number} className="flex items-center gap-3">
            {i > 0 && (
              <div
                className={`hidden h-px w-8 sm:block ${
                  isDone ? 'bg-foreground' : 'bg-border'
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <span
                aria-current={isActive ? 'step' : undefined}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  isDone
                    ? 'bg-foreground text-background'
                    : isActive
                      ? 'border-2 border-foreground text-foreground'
                      : 'border border-border text-muted'
                }`}
              >
                {isDone ? '✓' : step.number}
              </span>
              <span
                className={`text-sm ${
                  isActive ? 'font-semibold text-foreground' : 'text-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
