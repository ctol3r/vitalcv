const REQUIRED_HOURS = Number(process.env.MATE_REQUIRED_HOURS ?? 8);

const ACCEPTED_CATEGORIES = new Set([
  'addiction medicine',
  'pain management',
  'opioid prescribing',
  'substance use disorder',
  'behavioral health integration',
]);

export interface MateTrainingSummary {
  totalHours: number;
  categories: string[];
  breakdown?: Record<string, number>;
}

export interface MateValidationResult {
  mateCompliant: boolean;
  missingHours: number;
  invalidCategories: string[];
  acceptedCategories: string[];
  totalHours: number;
}

export function validateMateTraining(summary: MateTrainingSummary): MateValidationResult {
  const totalHours = Number(summary.totalHours ?? 0);
  const normalizedCategories = (summary.categories ?? []).map((category) =>
    category.trim().toLowerCase(),
  );

  const accepted = normalizedCategories.filter((category) => ACCEPTED_CATEGORIES.has(category));
  const invalidCategories = normalizedCategories.filter(
    (category) => category && !ACCEPTED_CATEGORIES.has(category),
  );

  const mateCompliant = totalHours >= REQUIRED_HOURS && accepted.length > 0;
  const missingHours = mateCompliant ? 0 : Math.max(REQUIRED_HOURS - totalHours, 0);

  return {
    mateCompliant,
    missingHours,
    invalidCategories,
    acceptedCategories: Array.from(new Set(accepted)),
    totalHours,
  };
}











