'use client';

type Props = {
  defaultValue: number[];
  min: number;
  max: number;
  step: number;
  onValueChange: (val: number[]) => void;
};

export function Slider({ defaultValue, min, max, step, onValueChange }: Props) {
  const value = defaultValue[0];
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      defaultValue={value}
      onChange={(e) => onValueChange([Number(e.target.value)])}
      className="h-2 w-full cursor-pointer rounded bg-neutral-200 accent-neutral-900 dark:bg-neutral-800"
    />
  );
}
